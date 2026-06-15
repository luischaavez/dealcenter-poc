"""
Final scoring: combines AI actionability score with rule-based signals
that the AI can't see directly (dates, value math).
"""

from datetime import datetime, date as date_type


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


def score_project(project: dict, ai_result: dict) -> dict:
    """
    Compute a 0-100 composite score.

    Points breakdown:
      AI actionability score  → up to 50 pts (scaled 0.5×)
      Project status          → up to 20 pts
      Start date urgency      → up to 15 pts
      Revenue opportunity     → up to 15 pts
    """
    score = 0.0
    factors = []

    # ── AI component (0–50 pts) ──────────────────────────────────────────
    ai_score = ai_result.get("actionability_score", 0)
    score += ai_score * 0.5

    # ── Status component (0–20 pts) ──────────────────────────────────────
    STATUS_PTS = {
        "Under Construction": 20,
        "Award":               20,
        "Sub-Bidding":         15,
        "GC Bidding":          12,
        "Pre-Construction/Negotiated": 10,
        "Post-Bid":             5,
    }
    status = project.get("projectStatus", "")
    status_pts = STATUS_PTS.get(status, 0)
    score += status_pts
    if status_pts:
        factors.append(f"Status '{status}' (+{status_pts})")

    # ── Start date urgency (0–15 pts) ────────────────────────────────────
    days = _days_until(project.get("startDate", ""))
    if days is not None:
        if 0 <= days <= 30:
            score += 15
            factors.append(f"Starts in {days} days — critical window (+15)")
        elif 31 <= days <= 90:
            score += 10
            factors.append(f"Starts in {days} days (+10)")
        elif 91 <= days <= 180:
            score += 5
            factors.append(f"Starts in ~{days//30} months (+5)")
        elif days < 0:
            factors.append(f"Start date passed {-days} days ago (may already be on-site)")
            score += 8  # Already under construction = still an opportunity

    # ── Revenue opportunity (0–15 pts) ──────────────────────────────────
    revenue = ai_result.get("revenue_estimate") or {}
    total_high = revenue.get("total_high", 0) or 0
    if total_high >= 500_000:
        score += 15
        factors.append(f"Revenue potential ${total_high:,.0f} (+15)")
    elif total_high >= 150_000:
        score += 10
        factors.append(f"Revenue potential ${total_high:,.0f} (+10)")
    elif total_high >= 50_000:
        score += 5
        factors.append(f"Revenue potential ${total_high:,.0f} (+5)")

    return {
        "final_score": round(min(score, 100.0), 1),
        "score_factors": factors + (ai_result.get("actionability_factors") or []),
        "blockers": ai_result.get("actionability_blockers") or [],
        "confidence": _compute_confidence(project, ai_result),
    }


def _compute_confidence(project: dict, ai_result: dict) -> float:
    """
    Compute a 0-100 confidence score for the qualification decision.

    Combines AI self-reported confidence with objective data completeness signals.
    High confidence = we're certain this lead is correctly qualified.
    Low confidence = borderline case; flag for human review.
    """
    # AI self-reported confidence (max 60 pts)
    ai_conf = float(ai_result.get("qualification_confidence") or 0.7)
    conf = ai_conf * 60

    # GC identified → we know who to call (+20 pts)
    companies = project.get("companyNameList") or []
    if isinstance(companies, list) and len(companies) > 0:
        conf += 20
    elif isinstance(companies, str) and companies.strip():
        conf += 20

    # Known project value (+10 pts)
    value = project.get("projectValue") or 0
    value_range = project.get("projectValueRange") or ""
    if value > 0 or (value_range and "Not Available" not in value_range):
        conf += 10

    # Has at least one date (bid or start) (+10 pts)
    if project.get("bidDate") or project.get("startDate"):
        conf += 10

    return round(min(conf, 100.0), 1)
