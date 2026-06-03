"""
DealCenter Pipeline — PoC entry point.

Usage:
  python main.py                      # Full run (ingest → filter → qualify → rank → output)
  python main.py --dry-run            # Skip AI; just show what passes hard filters
  python main.py --limit 50           # Cap at 50 ingested projects (for testing)
  python main.py --limit 50 --dry-run # Fast test: 50 projects, no AI cost
"""

import argparse
from config import SEARCH_STATES, SEARCH_DAYS_BACK, MAX_LEADS_PER_RUN, OUTPUT_DIR
from client import ConstructConnectClient
from filters import apply_hard_filters
from qualifier import qualify_project
from scorer import score_project
from formatter import print_leaderboard, save_results


def run_pipeline(dry_run: bool = False, limit: int = None) -> list:
    print(f"\n{'═' * 65}")
    print("  DEALCENTER PIPELINE")
    print(f"  States: {', '.join(SEARCH_STATES)}  |  Last {SEARCH_DAYS_BACK} days")
    if dry_run:
        print("  Mode: DRY RUN (no AI qualification)")
    if limit:
        print(f"  Ingest cap: {limit} projects")
    print(f"{'═' * 65}\n")

    # ── Stage 1: Ingest ────────────────────────────────────────────────
    print("STAGE 1  Ingesting from ConstructConnect...")
    cc = ConstructConnectClient()
    all_projects = list(
        cc.fetch_all(
            states=SEARCH_STATES,
            days_back=SEARCH_DAYS_BACK,
            max_projects=limit,
        )
    )
    print(f"  Ingested: {len(all_projects):,} projects\n")

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

    # ── Stage 3: AI Qualification ──────────────────────────────────────
    print(f"STAGE 3  AI qualification ({len(passed)} projects)...")
    print("  (System prompt cached after first call — subsequent calls are cheaper)\n")

    results = []
    qualified_count = 0

    for i, project in enumerate(passed, 1):
        title_short = (project.get("title") or "N/A")[:50]
        print(f"  [{i:3d}/{len(passed)}]  {title_short:<52}", end="  ", flush=True)
        try:
            ai_result = qualify_project(project)
            score_result = score_project(project, ai_result)
            results.append(
                {"project": project, "ai_result": ai_result, "score_result": score_result}
            )
            if ai_result.get("qualifies"):
                qualified_count += 1
                print(f"✓  score={score_result['final_score']}")
            else:
                reason = (ai_result.get("disqualify_reason") or "")[:50]
                print(f"✗  {reason}")
        except Exception as exc:
            print(f"ERROR  {exc}")
            results.append({"project": project, "error": str(exc)})

    print(f"\n  Qualified: {qualified_count} / {len(passed)}\n")

    # ── Stage 4: Score & Rank ──────────────────────────────────────────
    print("STAGE 4  Ranking qualified leads...")
    qualified = [r for r in results if r.get("ai_result", {}).get("qualifies")]
    qualified.sort(key=lambda x: x["score_result"]["final_score"], reverse=True)
    top_leads = qualified[:MAX_LEADS_PER_RUN]
    print(f"  Top {len(top_leads)} leads selected\n")

    # ── Stage 5: Output ────────────────────────────────────────────────
    print("STAGE 5  Generating output...")
    print_leaderboard(top_leads)
    save_results(results, output_dir=OUTPUT_DIR)

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
    args = parser.parse_args()
    run_pipeline(dry_run=args.dry_run, limit=args.limit)
