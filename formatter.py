"""
Output formatting: console display, executive summaries, and file persistence.

Two output modes:
  - Text summaries  → human-readable .txt for internal use
  - Web JSON        → clean structured .json consumed by the demo UI
"""

import html as html_module
import json
import os
from datetime import datetime


# ── Shared helpers ────────────────────────────────────────────────────────────

def _fmt_currency(value) -> str:
    if not value:
        return "Not disclosed"
    return f"${value:,.0f}"


def _value_label(value) -> str:
    """Short human-readable label: $50M, $700K, Undisclosed."""
    if not value or value == 0:
        return "Undisclosed"
    if value >= 1_000_000_000:
        return f"${value / 1_000_000_000:.1f}B"
    if value >= 1_000_000:
        v = value / 1_000_000
        return f"${v:.0f}M" if v == int(v) else f"${v:.1f}M"
    if value >= 1_000:
        return f"${value / 1_000:.0f}K"
    return f"${value:,.0f}"


def _clean(text) -> str:
    """Unescape HTML entities and strip whitespace."""
    if not text:
        return ""
    return html_module.unescape(str(text)).strip()


def _flatten_list(value) -> list:
    """Ensure a field that may be a string or list comes back as a clean list."""
    if not value:
        return []
    if isinstance(value, list):
        return [_clean(v) for v in value if v]
    return [_clean(value)] if value else []


_STATUS_TIER = {
    "Award":                       "hot",
    "Under Construction":          "hot",
    "Sub-Bidding":                 "warm",
    "GC Bidding":                  "warm",
    "Pre-Construction/Negotiated": "warm",
    "Post-Bid":                    "watch",
    "Final Planning":              "watch",
    "Design":                      "watch",
    "Conceptual":                  "watch",
}


# ── Plain-text output (internal) ─────────────────────────────────────────────

def format_executive_summary(project: dict, ai_result: dict, score_result: dict) -> str:
    """Generate a plain-text Opportunity Executive Summary for one qualified lead."""
    address = project.get("address") or {}
    location = f"{address.get('city', '')}, {address.get('state', '')} {address.get('zipcode', '')}".strip(", ")
    services = ", ".join(s.title() for s in (ai_result.get("services_needed") or []))

    lines = [
        "=" * 65,
        "  OPPORTUNITY EXECUTIVE SUMMARY",
        f"  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "=" * 65,
        "",
        f"  PROJECT   {project.get('title', 'N/A')}",
        f"  STATUS    {project.get('projectStatus', 'N/A')}",
        f"  VALUE     {_fmt_currency(project.get('projectValue'))}  ({project.get('projectValueRange', '')})",
        f"  LOCATION  {location}",
        f"  TYPE      {project.get('categories', 'N/A')}",
        "",
        f"  Actionability Score: {score_result['final_score']} / 100",
        "",
        "  WHY ACTIONABLE",
        "  " + "─" * 55,
        f"  {ai_result.get('why_actionable', '')}",
        "",
        "  CONTRIBUTING FACTORS",
        "  " + "─" * 55,
    ]
    for factor in score_result.get("score_factors", []):
        lines.append(f"    ✓  {factor}")
    if score_result.get("blockers"):
        lines += ["", "  BLOCKERS / RISKS", "  " + "─" * 55]
        for blocker in score_result["blockers"]:
            lines.append(f"    ⚠  {blocker}")
    lines += [
        "",
        "  SERVICES NEEDED",
        "  " + "─" * 55,
        f"    {services or 'N/A'}",
        "",
        "  COMPANIES INVOLVED",
        "  " + "─" * 55,
        f"    {project.get('companyNameList', 'Not yet identified')}",
        "",
        "  RECOMMENDED ACTION",
        "  " + "─" * 55,
        f"    {ai_result.get('recommended_action', '')}",
        "",
        "  SOURCE",
        "  " + "─" * 55,
        f"    ConstructConnect ID: {project.get('projectId', project.get('id', 'N/A'))}",
        f"    URL: {project.get('projectUrl', 'N/A')}",
        "=" * 65,
    ]
    return "\n".join(lines)


def print_leaderboard(top_leads: list) -> None:
    """Print a ranked table of top leads to stdout."""
    print(f"\n{'═' * 65}")
    print(f"  TOP {len(top_leads)} ACTIONABLE LEADS")
    print(f"{'═' * 65}")
    for i, r in enumerate(top_leads, 1):
        p = r["project"]
        s = r["score_result"]
        ai = r["ai_result"]
        city = (p.get("address") or {}).get("city", "")
        print(f"\n  #{i}  [{s['final_score']:5.1f}/100]  {p.get('title', 'N/A')[:52]}")
        print(f"       {p.get('projectStatus', '?'):28}  {_fmt_currency(p.get('projectValue')):>14}  {city}")
        print(f"       {ai.get('why_actionable', '')[:70]}")
    print()


def save_results(results: list, output_dir: str = "output") -> tuple:
    """Write leads_TIMESTAMP.json (full) and summaries_TIMESTAMP.txt (human)."""
    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    json_path = os.path.join(output_dir, f"leads_{timestamp}.json")
    with open(json_path, "w") as f:
        json.dump(results, f, indent=2, default=str)

    txt_path = os.path.join(output_dir, f"summaries_{timestamp}.txt")
    qualified = sorted(
        [r for r in results if r.get("ai_result", {}).get("qualifies")],
        key=lambda x: x.get("score_result", {}).get("final_score", 0),
        reverse=True,
    )
    with open(txt_path, "w") as f:
        f.write(f"DealCenter — Opportunity Summaries\n")
        f.write(f"Run: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Qualified leads: {len(qualified)}\n\n")
        for r in qualified:
            f.write(format_executive_summary(r["project"], r["ai_result"], r["score_result"]))
            f.write("\n\n")

    print(f"\n  JSON results : {json_path}")
    print(f"  Summaries    : {txt_path}")
    return json_path, txt_path


# ── Web JSON output (demo UI) ─────────────────────────────────────────────────

def _parse_companies(company_list) -> list:
    """Convert companyNameList (list or string) to [{name, city}] with clean text."""
    if not company_list:
        return []
    items = company_list if isinstance(company_list, list) else [s.strip() for s in str(company_list).split(",")]
    result = []
    for item in items:
        name = _clean(item)
        city = None
        if " - " in name:
            parts = name.rsplit(" - ", 1)
            name = parts[0].strip()
            city = parts[1].replace("(HQ)", "").replace("(Branch)", "").strip() or None
        if name:
            result.append({"name": name, "city": city})
    return result



def to_web_lead(rank: int, result: dict) -> dict:
    """Convert one pipeline result to a clean, UI-ready lead object."""
    project    = result["project"]
    ai         = result.get("ai_result", {})
    score_result = result.get("score_result", {})

    address  = project.get("address") or {}
    loc_data = project.get("location") or {}

    lat_lng = {}
    if isinstance(loc_data, dict):
        lat = loc_data.get("lat") or loc_data.get("latitude")
        lng = loc_data.get("lng") or loc_data.get("longitude") or loc_data.get("lon")
        if lat and lng:
            lat_lng = {"lat": float(lat), "lng": float(lng)}

    return {
        "id":    str(project.get("projectId") or project.get("id") or ""),
        "rank":  rank,
        "score": score_result.get("final_score", 0),
        "score_breakdown": score_result.get("score_breakdown", []),
        "project": {
            "title":              _clean(project.get("title")),
            "status":             project.get("projectStatus", ""),
            "status_tier":        _STATUS_TIER.get(project.get("projectStatus", ""), "watch"),
            "value":              project.get("projectValue") or 0,
            "value_label":        _value_label(project.get("projectValue")),
            "categories":         _flatten_list(project.get("categories")),
            "construction_types": _flatten_list(project.get("constructionTypes")),
            "location": {
                "city":  _clean(address.get("city")),
                "state": _clean(address.get("state")),
                "zip":   _clean(address.get("zipcode")),
                **lat_lng,
            },
            "dates": {
                "bid":          project.get("bidDate"),
                "start":        project.get("startDate"),
                "last_updated": project.get("lastUpdatedDate"),
            },
            "url": project.get("projectUrl") or "",
        },
        "companies": _parse_companies(project.get("companyNameList")),
        "qualification": {
            "services":           ai.get("services_needed") or [],
            "why_actionable":     _clean(ai.get("why_actionable")),
            "recommended_action": _clean(ai.get("recommended_action")),
            # AI-generated explanatory factors (separate from score math)
            "factors":  [_clean(f) for f in (ai.get("actionability_factors") or [])],
            "blockers": [_clean(b) for b in (ai.get("actionability_blockers") or [])],
        },
        "narrative_summary": _clean(result.get("narrative_summary", "")),

        # Ledger alert: what changed since the last run this project appeared in.
        # null  → known project, no changes
        # "new" → first time seen
        # "status_changed" → projectStatus changed (highest priority signal)
        # "updated"        → other key fields changed (value, companies, dates)
        "alert":        result.get("alert"),
        "alert_detail": result.get("alert_detail"),
    }


def save_web_output(results: list, run_stats: dict,
                    output_dir: str = "output",
                    ui_data_dir: str = "ui/data") -> str:
    """
    Write the UI-ready JSON:
      - output/web_TIMESTAMP.json  (archived copy)
      - ui/data/leads_latest.json  (what the demo always reads)
      - ui/data/manifest.json      (run history index)
    """
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(ui_data_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    qualified = sorted(
        [r for r in results if r.get("ai_result", {}).get("qualifies")],
        key=lambda x: x.get("score_result", {}).get("final_score", 0),
        reverse=True,
    )

    payload = {
        "run_id":       timestamp,
        "generated_at": datetime.now().isoformat(),
        "stats":        run_stats,
        "leads":        [to_web_lead(i + 1, r) for i, r in enumerate(qualified)],
    }

    # Archived copy
    archive_path = os.path.join(output_dir, f"web_{timestamp}.json")
    with open(archive_path, "w") as f:
        json.dump(payload, f, indent=2, default=str)

    # Live file (UI reads this)
    latest_path = os.path.join(ui_data_dir, "leads_latest.json")
    with open(latest_path, "w") as f:
        json.dump(payload, f, indent=2, default=str)

    # Manifest
    manifest_path = os.path.join(ui_data_dir, "manifest.json")
    manifest = {"runs": []}
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path) as f:
                manifest = json.load(f)
        except Exception:
            pass
    manifest["runs"].insert(0, {
        "id":           timestamp,
        "generated_at": payload["generated_at"],
        "file":         f"web_{timestamp}.json",
        "stats":        run_stats,
    })
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"  Web JSON     : {latest_path}")
    return latest_path
