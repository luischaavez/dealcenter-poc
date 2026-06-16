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
  4.5 Summaries  — Sonnet sales briefs for top 20
  5  Output       — JSON files + SQLite
"""

import argparse
import os
from datetime import datetime

from config import SEARCH_STATES, SEARCH_DAYS_BACK, MAX_LEADS_PER_RUN, OUTPUT_DIR
from client import ConstructConnectClient
from dodge_client import DodgeClient
from dedup import deduplicate
from filters import apply_hard_filters
from qualifier import qualify_project
from scorer import score_project
from formatter import print_leaderboard, save_results, save_web_output
from summarizer import generate_summary
from ledger import check_project, update_project, save_run, save_leads


def run_pipeline(dry_run: bool = False, limit: int = None, dodge_path: str = None) -> list:
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
    print("STAGE 1a  Ingesting from ConstructConnect...")
    cc = ConstructConnectClient()
    cc_projects = list(
        cc.fetch_all(
            states=SEARCH_STATES,
            days_back=SEARCH_DAYS_BACK,
            max_projects=limit,
        )
    )
    print(f"  Ingested: {len(cc_projects):,} CC projects\n")

    # ── Stage 1b: Ingest from Dodge Excel (optional) ───────────────────
    dodge_projects = []
    effective_dodge_path = dodge_path or os.environ.get("DODGE_EXCEL_PATH")
    if effective_dodge_path:
        print(f"STAGE 1b  Importing Dodge Excel: {effective_dodge_path}...")
        try:
            dodge_projects = DodgeClient.load(effective_dodge_path)
            print(f"  Imported: {len(dodge_projects):,} Dodge projects\n")
        except Exception as exc:
            print(f"  WARNING: Dodge import failed — {exc}\n")
    else:
        print("STAGE 1b  Dodge import skipped (no --dodge path or DODGE_EXCEL_PATH)\n")

    # ── Stage 1.5: Cross-source deduplication ─────────────────────────
    if dodge_projects:
        print("STAGE 1.5  Cross-source deduplication...")
        all_projects = deduplicate(cc_projects, dodge_projects)
        print()
    else:
        all_projects = cc_projects

    print(f"  Total after dedup: {len(all_projects):,} projects\n")

    # ── Stage 2: Hard Filter ───────────────────────────────────────────
    print("STAGE 2  Applying hard filters...")
    passed = []
    fail_counts: dict[str, int] = {}

    for project in all_projects:
        ok, failures = apply_hard_filters(project)
        if ok:
            passed.append(project)
        else:
            for reason in failures:
                fail_counts[reason] = fail_counts.get(reason, 0) + 1

    print(f"  Passed : {len(passed)} / {len(all_projects)}")
    if fail_counts:
        print("  Top disqualifiers:")
        for reason, n in sorted(fail_counts.items(), key=lambda x: -x[1])[:6]:
            print(f"    {n:4d}  {reason}")
    print()

    if dry_run:
        print(f"DRY RUN — top {min(15, len(passed))} projects after hard filter:\n")
        for p in passed[:15]:
            print(
                f"  {p.get('projectStatus', '?'):28}  "
                f"${p.get('projectValue', 0):>14,.0f}  "
                f"{p.get('title', 'N/A')[:50]}"
            )
        print(f"\n  ({len(passed)} total would proceed to AI qualification)\n")
        return []

    if not passed:
        print("No projects passed hard filters. Exiting.")
        return []

    # ── Stage 2.5: Memory Check ────────────────────────────────────────
    print("STAGE 2.5  Checking project ledger...")

    to_qualify   = []  # list of (project, alert)
    from_cache   = []  # list of result dicts with cached ai/score results

    for project in passed:
        alert, cached = check_project(project)

        if alert is None:
            # Known, unchanged — re-score with current data (cheap) but skip Haiku
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
    print()

    # ── Stage 3: AI Qualification ──────────────────────────────────────
    fresh_results = []
    qualified_fresh = 0

    if to_qualify:
        print(f"STAGE 3  AI qualification ({len(to_qualify)} new/changed projects)...")
        print("  (System prompt cached after first call — subsequent calls are cheaper)\n")

        for i, (project, alert) in enumerate(to_qualify, 1):
            title_short = (project.get("title") or "N/A")[:50]
            alert_tag   = f"[{alert}]" if alert != "new" else "[new]"
            print(f"  [{i:3d}/{len(to_qualify)}]  {title_short:<50} {alert_tag:<17}", end="  ", flush=True)
            try:
                ai_result    = qualify_project(project)
                score_result = score_project(project, ai_result)

                # Determine alert_detail for status changes
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
                print(f"ERROR  {exc}")
                fresh_results.append({"project": project, "error": str(exc),
                                      "alert": alert, "alert_detail": None})
    else:
        print("STAGE 3  AI qualification — all projects cached, skipping.\n")

    # Merge cached + fresh results
    results = from_cache + fresh_results
    qualified_count = sum(1 for r in results if r.get("ai_result", {}).get("qualifies"))

    if to_qualify:
        cached_qualifying = sum(1 for r in from_cache if r.get("ai_result", {}).get("qualifies"))
        print(f"\n  Qualified (fresh): {qualified_fresh} / {len(to_qualify)}")
        print(f"  Qualified (cached): {cached_qualifying}")
        print(f"  Total qualified:    {qualified_count}\n")

    # ── Update ledger for all processed projects ───────────────────────
    print("  Updating project ledger...")
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
    print()

    # ── Stage 4: Score & Rank ──────────────────────────────────────────
    print("STAGE 4  Ranking qualified leads...")
    qualified = [r for r in results if r.get("ai_result", {}).get("qualifies")]
    qualified.sort(key=lambda x: x["score_result"]["final_score"], reverse=True)
    top_leads = qualified[:MAX_LEADS_PER_RUN]

    # Stamp rank onto each result dict (used by save_leads and formatter)
    for i, r in enumerate(top_leads, 1):
        r["rank"] = i

    print(f"  Top {len(top_leads)} leads selected\n")

    # ── Stage 4.5: Sonnet Executive Summaries ─────────────────────────
    print(f"STAGE 4.5  Generating sales briefs (Sonnet) for top {len(top_leads)} leads...")
    print("  (System prompt cached after first call — subsequent calls are cheaper)\n")

    for i, r in enumerate(top_leads, 1):
        title_short = (r["project"].get("title") or "N/A")[:50]
        # Re-use existing summary if project was cached AND summary exists
        if r.get("alert") is None and r.get("narrative_summary"):
            print(f"  [{i:2d}/{len(top_leads)}]  {title_short:<52}  (cached)")
            continue
        print(f"  [{i:2d}/{len(top_leads)}]  {title_short:<52}", end="  ", flush=True)
        try:
            r["narrative_summary"] = generate_summary(
                r["project"], r["ai_result"], r["score_result"]
            )
            print("✓")
        except Exception as exc:
            print(f"ERROR  {exc}")
            r["narrative_summary"] = ""

    print()

    # ── Stage 5: Output ────────────────────────────────────────────────
    print("STAGE 5  Generating output...")
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

    # Persist run + leads to SQLite
    save_run(run_id, run_stats)
    save_leads(run_id, top_leads)
    print(f"  SQLite           : dealcenter.db  (runs + leads + ledger)")

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
