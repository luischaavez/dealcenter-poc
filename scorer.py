"""
Opportunity scoring — factor-based composite score aligned with FTDS sales model.

Score = sum of weights for all factors present on this project, capped at 100.
Weights are loaded from scoring_weights.json and can be tuned by FTDS users
without a code change.

Ron's target display format:
  Total Opportunity Score = 84
      GC Awarded                    (+25)
      Budget Pricing Requested      (+20)
      Construction Starts in 7 Days (+15)
      Project Updated 3 Days Ago    (+9)

Factors that require CRM data (existing customer, known contacts) always earn 0
until a CRM integration is wired up. Their weights still appear in scoring_weights.json
so users can see the full factor list and configure their eventual contribution.
"""

import json
from datetime import datetime, date as date_type
from pathlib import Path

_WEIGHTS_FILE = Path(__file__).parent / "scoring_weights.json"


def _load_weights() -> dict:
    """Load factor weights keyed by factor id. Falls back gracefully if file is missing."""
    try:
        data = json.loads(_WEIGHTS_FILE.read_text())
        return {f["id"]: f["weight"] for f in data.get("factors", [])}
    except Exception:
        return {}


def _parse_date(date_str: str):
    if not date_str:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(date_str[:10], fmt[:10]).date()
        except ValueError:
            continue
    return None


def _days_until(date_str: str):
    d = _parse_date(date_str)
    if d is None:
        return None
    return (d - date_type.today()).days


def _days_since(date_str: str):
    d = _parse_date(date_str)
    if d is None:
        return None
    return (date_type.today() - d).days


def _evaluate_factors(project: dict, ai_result: dict, weights: dict) -> list:
    """
    Evaluate each scoring factor against available project data and AI result.
    Returns a list of earned factor dicts: {id, label, points}.
    """
    earned = []

    def earn(factor_id: str, label: str):
        pts = weights.get(factor_id, 0)
        if pts:
            earned.append({"id": factor_id, "label": label, "points": pts})

    # ── GC Awarded ────────────────────────────────────────────────────────────
    status = project.get("projectStatus", "")
    if status in ("Award", "Under Construction"):
        earn("gc_awarded", "GC Awarded")

    # ── Existing Customer Awarded / Bidding (requires CRM) ────────────────────
    # Placeholder — always 0 until CRM integration surfaces these signals.

    # ── Known Contact Involved (requires CRM) ─────────────────────────────────
    # Placeholder — always 0 until CRM integration provides contact matching.

    # ── Budget Pricing Requested (AI detected) ────────────────────────────────
    if ai_result.get("budget_pricing_requested"):
        earn("budget_pricing_requested", "Budget Pricing Requested")

    # ── Construction Start Approaching (within 60 days, or just started) ──────
    days = _days_until(project.get("startDate", ""))
    if days is not None and -30 <= days <= 60:
        if days < 0:
            label = f"Construction Started {-days} {'Day' if -days == 1 else 'Days'} Ago"
        else:
            label = f"Construction Starts in {days} {'Day' if days == 1 else 'Days'}"
        earn("construction_start_approaching", label)

    # ── Project Value > $50M ──────────────────────────────────────────────────
    value = project.get("projectValue") or 0
    if value >= 50_000_000:
        earn("high_value", f"Project Value ${value / 1_000_000:.0f}M (> $50M)")

    # ── Project Updated Within the Last 7 Days ────────────────────────────────
    since = _days_since(project.get("lastUpdatedDate", ""))
    if since is not None and since <= 7:
        earn("recently_updated", f"Project Updated {since} {'Day' if since == 1 else 'Days'} Ago")

    return earned


def score_project(project: dict, ai_result: dict) -> dict:
    """
    Compute a 0-100 opportunity score from weighted factors.

    Score = sum of weights for all present factors, capped at 100.
    Weights are read from scoring_weights.json on every call so changes
    take effect without restarting the pipeline.
    """
    weights = _load_weights()
    earned  = _evaluate_factors(project, ai_result, weights)
    total   = min(sum(f["points"] for f in earned), 100)

    return {
        "final_score":     float(total),
        "score_breakdown": earned,
        "score_factors":   [f"{f['label']} (+{f['points']})" for f in earned],
        "blockers":        ai_result.get("actionability_blockers") or [],
        "gateway_provider": ai_result.get("_gateway_provider", "anthropic"),
    }
