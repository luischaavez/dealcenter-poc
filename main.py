"""
DealCenter Pipeline — PoC entry point.

Usage:
  python main.py                          # Full run
  python main.py --dry-run                # Skip AI; show filtered projects
  python main.py --limit 50              # Cap at 50 ingested projects
  python main.py --dodge path/to/file.xlsx  # Include Dodge Excel import

Pipeline stages:
  1a Ingest CC    — fetch from ConstructConnect
  1b Ingest Dodge — parse Excel (if --dodge provided or DODGE_EXCEL_PATH set)
  1.5 Dedup       — cross-source deduplication
  2  Hard Filter  — client-side safety nets
  2.5 Memory Check — ledger lookup: new / cached / changed
  3  AI Qualify   — Haiku on new+changed projects only
  4  Score & Rank — composite 0-100 score
  5  Output       — JSON files + SQLite
"""

import argparse
import os
from datetime import datetime

from config import SEARCH_STATES, SEARCH_DAYS_BACK, OUTPUT_DIR
from client import ConstructConnectClient
from dodge_client import DodgeClient
from dedup import deduplicate
from filters import apply_hard_filters
from qualifier import qualify_project
from scorer import score_project
from formatter import print_leaderboard, save_results, save_web_output
from ledger import check_project, update_project, save_run, save_leads, get_todays_dodge_upload


def run_pipeline(
    dry_run: bool = False,
    limit: int = None,
    dodge_path: str = None,
    on_progress=None,
) -> list:
    """
    on_progress: optional callable(stage: str, current: int | None, total: int | None)
                 called at each stage boundary so callers (e.g. the API thread) can
                 surface live progress without polling stdout.
    """
    def _stage(label: str, current: int | None = None, total: int | None = None) -> None:
        print(f"\n{'─' * 55}")
        print(f"  {label}" + (f"  ({current}/{total})" if total else ""))
        print(f"{'─' * 55}")
        if on_progress:
            on_progress(label, current, total)

    print(f"\n{'═' * 65}")
    print("  DEALCENTER PIPELINE")
    print(f"  States: {', '.join(SEARCH_STATES)}  |  Last {SEARCH_DAYS_BACK} days")
    if dry_run:
        print("  Mode: DRY RUN (no AI qualification)")
    if limit:
        print(f"  Ingest cap: {limit} projects")
    if dodge_path:
        print(f"  Dodge Excel: {dodge_path}")
    print(f"{'═' * 65}\n")

    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    # ── Stage 1a: Ingest from ConstructConnect ─────────────────────────
    _stage("Ingesting from ConstructConnect…")
    cc_projects = []
    try:
        cc = ConstructConnectClient()
        cc_projects = list(
            cc.fetch_all(
                states=SEARCH_STATES,
                days_back=SEARCH_DAYS_BACK,
                max_projects=limit,
            )
        )
        print(f"  Ingested: {len(cc_projects):,} CC projects")
    except Exception as exc:
        print(f"  WARNING: ConstructConnect unavailable — {exc}")
        print("  Continuing without CC data.")

    # ── Stage 1b: Ingest from Dodge (optional) ────────────────────────
    # Priority: --dodge arg → DODGE_EXCEL_PATH env → today's upload in DB
    dodge_projects = []
    effective_dodge_path = dodge_path or os.environ.get("DODGE_EXCEL_PATH")

    if not effective_dodge_path:
        upload_record = get_todays_dodge_upload()
        if upload_record:
            from storage import download, is_configured
            if is_configured():
                ext = os.path.splitext(upload_record.filename)[1] or ".xlsx"
                tmp_path = f"/tmp/dodge_import{ext}"
                try:
                    download(upload_record.storage_key, tmp_path)
                    effective_dodge_path = tmp_path
                    print(f"\nStage 1b  Found today's Dodge upload: {upload_record.filename}")
                except Exception as exc:
                    print(f"\nStage 1b  WARNING: Could not download Dodge file — {exc}")
            else:
                print("\nStage 1b  Dodge upload found in DB but STORAGE_* vars not configured — skipping")
        else:
            print(f"\nStage 1b  No Dodge file for today — skipping")

    if effective_dodge_path:
        _stage(f"Importing Dodge: {effective_dodge_path}")
        try:
            dodge_projects = DodgeClient.load(effective_dodge_path)
            print(f"  Imported: {len(dodge_projects):,} Dodge projects")
        except Exception as exc:
            print(f"  WARNING: Dodge import failed — {exc}")

    if not cc_projects and not dodge_projects:
        print("\nNo projects ingested from any source — aborting.")
        return []

    # ── Stage 1.5: Cross-source deduplication ─────────────────────────
    if dodge_projects:
        _stage("Deduplicating CC + Dodge…")
        all_projects = deduplicate(cc_projects, dodge_projects)
    else:
        all_projects = cc_projects

    print(f"  Total: {len(all_projects):,} projects")

    # ── Stage 2: Hard Filter ───────────────────────────────────────────
    _stage("Applying hard filters…")
    passed = []
    fail_counts: dict[str, int] = {}

    for project in all_projects:
        ok, failures = apply_hard_filters(project)
        if ok:
            passed.append(project)
        else:
            for reason in failures:
                fail_counts[reason] = fail_counts.get(reason, 0) + 1

    print(f"  Passed: {len(passed)} / {len(all_projects)}")
    if fail_counts:
        print("  Top disqualifiers:")
        for reason, n in sorted(fail_counts.items(), key=lambda x: -x[1])[:6]:
            print(f"    {n:4d}  {reason}")

    if dry_run:
        print(f"\nDRY RUN — top {min(15, len(passed))} projects after hard filter:\n")
        for p in passed[:15]:
            print(
                f"  {p.get('projectStatus', '?'):28}  "
                f"${p.get('projectValue', 0):>14,.0f}  "
                f"{p.get('title', 'N/A')[:50]}"
            )
        print(f"\n  ({len(passed)} total would proceed to AI qualification)\n")
        return []

    if not passed:
        print("  No projects passed hard filters — aborting.")
        return []

    # ── Stage 2.5: Memory Check ────────────────────────────────────────
    _stage("Checking project ledger…")

    to_qualify = []
    from_cache = []

    for project in passed:
        alert, cached = check_project(project)
        if alert is None:
            ai_result    = cached["ai_result"]
            score_result = score_project(project, ai_result)
            from_cache.append({
                "project":      project,
                "ai_result":    ai_result,
                "score_result": score_result,
                "alert":        None,
                "alert_detail": None,
            })
        else:
            to_qualify.append((project, alert))

    new_count     = sum(1 for _, a in to_qualify if a == "new")
    changed_count = sum(1 for _, a in to_qualify if a != "new")
    cached_count  = len(from_cache)

    print(f"  New:            {new_count}")
    print(f"  Changed:        {changed_count}  (status/value/companies updated)")
    print(f"  Cached (no AI): {cached_count}")

    # ── Stage 3: AI Qualification ──────────────────────────────────────
    fresh_results  = []
    qualified_fresh = 0
    ai_errors      = 0

    if to_qualify:
        _stage("AI Qualification", current=0, total=len(to_qualify))

        for i, (project, alert) in enumerate(to_qualify, 1):
            if on_progress:
                on_progress("AI Qualification", i, len(to_qualify))
            title_short = (project.get("title") or "N/A")[:50]
            alert_tag   = f"[{alert}]" if alert != "new" else "[new]"
            print(f"  [{i:3d}/{len(to_qualify)}]  {title_short:<50} {alert_tag:<17}", end="  ", flush=True)
            try:
                ai_result    = qualify_project(project)
                score_result = score_project(project, ai_result)

                alert_detail = None
                if alert == "status_changed":
                    from database import get_db, Project as ProjectModel
                    with get_db() as session:
                        existing = session.get(ProjectModel, str(project.get("projectId") or ""))
                        if existing:
                            alert_detail = f"{existing.last_status} → {project.get('projectStatus', '')}"

                fresh_results.append({
                    "project":      project,
                    "ai_result":    ai_result,
                    "score_result": score_result,
                    "alert":        alert,
                    "alert_detail": alert_detail,
                })

                if ai_result.get("qualifies"):
                    qualified_fresh += 1
                    print(f"✓  score={score_result['final_score']}")
                else:
                    reason = (ai_result.get("disqualify_reason") or "")[:45]
                    print(f"✗  {reason}")

            except Exception as exc:
                ai_errors += 1
                print(f"ERROR  {exc}")
                fresh_results.append({"project": project, "error": str(exc),
                                      "alert": alert, "alert_detail": None})

        if ai_errors:
            print(f"\n  ⚠ {ai_errors} project(s) failed AI qualification and were skipped.")
    else:
        print("\n  Stage 3: all projects cached — skipping AI qualification.")

    results         = from_cache + fresh_results
    qualified_count = sum(1 for r in results if r.get("ai_result", {}).get("qualifies"))

    if to_qualify:
        cached_qualifying = sum(1 for r in from_cache if r.get("ai_result", {}).get("qualifies"))
        print(f"\n  Qualified (fresh):  {qualified_fresh} / {len(to_qualify)}")
        print(f"  Qualified (cached): {cached_qualifying}")
        print(f"  Total qualified:    {qualified_count}")

    # ── Update ledger ──────────────────────────────────────────────────
    _stage("Updating project ledger…")
    for r in results:
        if r.get("ai_result"):
            update_project(
                project      = r["project"],
                ai_result    = r["ai_result"],
                score_result = r.get("score_result", {}),
                run_id       = run_id,
                alert        = r.get("alert"),
                alert_detail = r.get("alert_detail"),
            )

    # ── Stage 4: Score & Rank ──────────────────────────────────────────
    _stage("Ranking qualified leads…")
    qualified = [r for r in results if r.get("ai_result", {}).get("qualifies")]
    qualified.sort(key=lambda x: x["score_result"]["final_score"], reverse=True)
    top_leads = qualified

    for i, r in enumerate(top_leads, 1):
        r["rank"] = i

    print(f"  {len(top_leads)} qualified leads ranked")

    # ── Stage 4.5: Sonnet Summaries (disabled — not used in current UI) ──
    # Uncomment to re-enable narrative sales brief generation via Sonnet.
    # for i, r in enumerate(top_leads, 1):
    #     if on_progress:
    #         on_progress("Generating sales briefs", i, len(top_leads))
    #     title_short = (r["project"].get("title") or "N/A")[:50]
    #     if r.get("alert") is None and r.get("narrative_summary"):
    #         print(f"  [{i:2d}/{len(top_leads)}]  {title_short:<52}  (cached)")
    #         continue
    #     print(f"  [{i:2d}/{len(top_leads)}]  {title_short:<52}", end="  ", flush=True)
    #     try:
    #         r["narrative_summary"] = generate_summary(
    #             r["project"], r["ai_result"], r["score_result"]
    #         )
    #         print("✓")
    #     except Exception as exc:
    #         print(f"ERROR  {exc}")
    #         r["narrative_summary"] = ""

    # ── Stage 5: Output ────────────────────────────────────────────────
    _stage("Saving output…")
    print_leaderboard(top_leads)
    save_results(results, output_dir=OUTPUT_DIR)

    run_stats = {
        "ingested":  len(all_projects),
        "filtered":  len(passed),
        "qualified": qualified_count,
        "surfaced":  len(top_leads),
        "states":    SEARCH_STATES,
        "days_back": SEARCH_DAYS_BACK,
    }
    save_web_output(results, run_stats, output_dir=OUTPUT_DIR)
    save_run(run_id, run_stats)
    save_leads(run_id, top_leads)
    print(f"  SQLite: dealcenter.db  (runs + leads + ledger)")

    return top_leads


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DealCenter Lead Qualification Pipeline")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Skip AI qualification; show filtered projects only",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        metavar="N",
        help="Limit number of projects ingested (useful for testing)",
    )
    parser.add_argument(
        "--dodge",
        type=str,
        default=None,
        metavar="PATH",
        help="Path to a Dodge Construct Excel export (.xlsx) to merge with CC data",
    )
    args = parser.parse_args()
    run_pipeline(dry_run=args.dry_run, limit=args.limit, dodge_path=args.dodge)
