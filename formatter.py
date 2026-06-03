"""
Output formatting: console display, executive summaries, and file persistence.
"""

import json
import os
from datetime import datetime


def _fmt_currency(value) -> str:
    if not value:
        return "Not disclosed"
    return f"${value:,.0f}"


def format_executive_summary(project: dict, ai_result: dict, score_result: dict) -> str:
    """Generate a plain-text Opportunity Executive Summary for one qualified lead."""

    address = project.get("address") or {}
    location = f"{address.get('city', '')}, {address.get('state', '')} {address.get('zipcode', '')}".strip(", ")

    revenue = ai_result.get("revenue_estimate") or {}
    rev_range = (
        f"${revenue.get('total_low', 0):,.0f} – ${revenue.get('total_high', 0):,.0f} "
        f"over {revenue.get('duration_months', 0)} months"
    )

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
        "  ESTIMATED REVENUE OPPORTUNITY",
        "  " + "─" * 55,
        f"    {rev_range}",
        f"    Basis: {revenue.get('assumptions', '')}",
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
        print(
            f"\n  #{i}  [{s['final_score']:5.1f}/100]  {p.get('title', 'N/A')[:52]}"
        )
        print(
            f"       {p.get('projectStatus', '?'):28}  "
            f"{_fmt_currency(p.get('projectValue')):>14}  {city}"
        )
        print(f"       {ai.get('why_actionable', '')[:70]}")
    print()


def save_results(results: list, output_dir: str = "output") -> tuple:
    """
    Persist pipeline results to disk.

    Writes:
      - leads_TIMESTAMP.json  → full structured data for all projects
      - summaries_TIMESTAMP.txt → executive summaries for qualified projects only
    """
    os.makedirs(output_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Full JSON dump
    json_path = os.path.join(output_dir, f"leads_{timestamp}.json")
    with open(json_path, "w") as f:
        json.dump(results, f, indent=2, default=str)

    # Text summaries for qualified leads
    txt_path = os.path.join(output_dir, f"summaries_{timestamp}.txt")
    qualified = [r for r in results if r.get("ai_result", {}).get("qualifies")]
    qualified_sorted = sorted(
        qualified,
        key=lambda x: x.get("score_result", {}).get("final_score", 0),
        reverse=True,
    )
    with open(txt_path, "w") as f:
        f.write(
            f"DealCenter — Opportunity Summaries\n"
            f"Run: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"Qualified leads: {len(qualified_sorted)}\n\n"
        )
        for r in qualified_sorted:
            f.write(
                format_executive_summary(r["project"], r["ai_result"], r["score_result"])
            )
            f.write("\n\n")

    print(f"\n  JSON results : {json_path}")
    print(f"  Summaries    : {txt_path}")
    return json_path, txt_path
