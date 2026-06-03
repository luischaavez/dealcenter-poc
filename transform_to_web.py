"""
One-shot utility: convert an existing pipeline output JSON to web format.

Usage:
  python transform_to_web.py                              # auto-detects latest leads_*.json
  python transform_to_web.py output/leads_20260603.json  # explicit file
"""

import glob
import json
import os
import sys
from typing import Optional
from formatter import save_web_output

def find_latest_leads_file(output_dir: str = "output") -> Optional[str]:
    files = sorted(glob.glob(os.path.join(output_dir, "leads_*.json")))
    # Exclude web_ files
    files = [f for f in files if not os.path.basename(f).startswith("web_")]
    return files[-1] if files else None

def main():
    path = sys.argv[1] if len(sys.argv) > 1 else find_latest_leads_file()
    if not path or not os.path.exists(path):
        print("No leads JSON found. Run the pipeline first: python main.py --limit 300")
        sys.exit(1)

    print(f"Loading: {path}")
    with open(path) as f:
        results = json.load(f)

    qualified_count = sum(1 for r in results if r.get("ai_result", {}).get("qualifies"))
    filtered_count  = sum(1 for r in results if r.get("ai_result"))  # had AI run on it
    ingested_count  = len(results)

    run_stats = {
        "ingested":  ingested_count,
        "filtered":  filtered_count,
        "qualified": qualified_count,
        "surfaced":  min(qualified_count, 20),
        "states":    ["UT"],
        "days_back": 90,
    }

    out = save_web_output(results, run_stats)
    print(f"Done → {out}")

if __name__ == "__main__":
    main()
