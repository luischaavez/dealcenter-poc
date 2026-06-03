"""
Diagnostic script: fetch a sample of projects and show
value/status/category distributions — helps calibrate filter thresholds
without spending AI credits.

Usage:
  python diagnose.py              # Sample 200 projects
  python diagnose.py --limit 500  # Larger sample
"""

import argparse
import sys
from collections import Counter
from config import SEARCH_STATES, SEARCH_DAYS_BACK
from client import ConstructConnectClient

VALUE_BUCKETS = [
    (0,          "    $0  (not disclosed / zero)"),
    (1,          "   <$100K"),
    (100_000,    " $100K–$500K"),
    (500_000,    " $500K–$1M"),
    (1_000_000,  "   $1M–$5M"),
    (5_000_000,  "   $5M–$20M"),
    (20_000_000, "  $20M–$50M"),
    (50_000_000, "      >$50M"),
]


def bucket(value) -> str:
    v = value or 0
    label = VALUE_BUCKETS[0][1]
    for threshold, lbl in VALUE_BUCKETS:
        if v >= threshold:
            label = lbl
    return label


def run(limit: int):
    print(f"\nDIAGNOSTIC — ConstructConnect sample ({limit} projects, {SEARCH_STATES})\n")
    cc = ConstructConnectClient()
    projects = list(cc.fetch_all(max_projects=limit))
    print(f"\nTotal fetched: {len(projects)}\n")

    # ── Project Value distribution ────────────────────────────────────
    value_dist = Counter(bucket(p.get("projectValue")) for p in projects)
    print("PROJECT VALUE DISTRIBUTION")
    print("─" * 45)
    for _, lbl in VALUE_BUCKETS:
        count = value_dist.get(lbl, 0)
        bar = "█" * (count * 40 // max(value_dist.values(), default=1))
        print(f"  {lbl}  {count:4d}  {bar}")

    # ── Status distribution ───────────────────────────────────────────
    status_dist = Counter(p.get("projectStatus", "Unknown") for p in projects)
    print("\nPROJECT STATUS DISTRIBUTION")
    print("─" * 45)
    for status, count in status_dist.most_common():
        bar = "█" * (count * 40 // max(status_dist.values()))
        print(f"  {status:<35} {count:4d}  {bar}")

    # ── Category distribution (field is a list) ───────────────────────
    cat_dist: Counter = Counter()
    for p in projects:
        cats = p.get("categories") or []
        if isinstance(cats, list):
            for c in cats:
                cat_dist[str(c)] += 1
        else:
            cat_dist[str(cats)] += 1
    print("\nTOP 20 CATEGORIES (multi-value field)")
    print("─" * 55)
    for cat, count in cat_dist.most_common(20):
        print(f"  {count:4d}  {cat}")

    # ── projectCategory (Construction vs Service) ─────────────────────
    pcat_dist: Counter = Counter()
    for p in projects:
        v = p.get("projectCategory") or "Unknown"
        if isinstance(v, list):
            for item in v:
                pcat_dist[str(item)] += 1
        else:
            pcat_dist[str(v)] += 1
    print("\nPROJECT CATEGORY (Construction vs Service)")
    print("─" * 45)
    for pcat, count in pcat_dist.most_common():
        print(f"  {count:4d}  {pcat}")

    # ── bidsToContactRoleGroup ────────────────────────────────────────
    bids_dist: Counter = Counter()
    for p in projects:
        v = p.get("bidsToContactRoleGroup") or "Unknown"
        if isinstance(v, list):
            for item in v:
                bids_dist[str(item)] += 1
        else:
            bids_dist[str(v)] += 1
    print("\nBIDS TO CONTACT ROLE")
    print("─" * 45)
    for role, count in bids_dist.most_common(10):
        print(f"  {count:4d}  {role}")

    # ── What would pass at different value thresholds? ─────────────────
    print("\nFILTER SENSITIVITY — value threshold vs. projects that pass")
    print("─" * 55)
    thresholds = [0, 100_000, 250_000, 500_000, 1_000_000, 2_000_000, 5_000_000]
    for t in thresholds:
        passing = sum(1 for p in projects if (p.get("projectValue") or 0) >= t)
        pct = passing * 100 // len(projects) if projects else 0
        print(f"  >= ${t:>10,.0f}   {passing:4d} projects  ({pct}%)")

    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=200, metavar="N")
    args = parser.parse_args()
    run(args.limit)
