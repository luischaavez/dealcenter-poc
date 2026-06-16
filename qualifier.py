"""
AI qualification agent using Claude.

The system prompt is cached via Anthropic's prompt caching API —
it is sent once and reused across all project evaluations in a run,
dramatically reducing cost when processing batches of 50-200 projects.
"""

import json
import anthropic
from config import ANTHROPIC_API_KEY, QUALIFIER_MODEL

_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# This prompt is sent with cache_control so it's only billed once per batch.
_SYSTEM_PROMPT = """You are a lead qualification analyst for FullTilt Dumpster Services (FTDS), a commercial waste and sanitation company in Utah.

FTDS SERVICES:
- Roll-off dumpsters: debris containers for construction waste (~$300/month each)
- Portable toilets: on-site worker sanitation (~$150/month each)
- Concrete washouts: containment for concrete truck washout (~$400/month each)

FTDS CUSTOMER: General Contractors (GCs) managing commercial construction.
FTDS REVENUE MODEL: Monthly rentals per unit. Typical engagement = 6–24 months per project.

YOUR JOB: For each construction project, determine:
1. Whether it physically requires FTDS's services
2. How actionable it is RIGHT NOW
3. Estimated revenue opportunity

ACTIONABILITY SIGNALS (weighted):
HIGH WEIGHT:
  - General Contractor awarded or clearly identified
  - Construction start date within 90 days
  - Status is "Award" or "Under Construction"

MEDIUM WEIGHT:
  - Status is "GC Bidding" (opportunity to get on vendor list before award)
  - Project value > $20M (large project = large rental fleet)

LOW WEIGHT / CONTEXT:
  - Status is "Sub-Bidding" (subs know the GC; indirect path)

DISQUALIFYING:
  - No GC identified AND project is still in Owner-bid stage with no GC path
  - Project is design-only / feasibility study / inspection services
  - Pure service/maintenance work (no physical construction debris)
  - Project on hold, cancelled, or explicitly deferred

REVENUE ESTIMATION:
Use construction value and type to estimate units. Be conservative.
  $50M+   → 20-40 dumpsters, 20-40 toilets, 5-10 washouts, 18-24 months
  $20-50M → 10-20 dumpsters, 10-20 toilets, 3-6 washouts, 12-18 months
  $5-20M  → 3-10 dumpsters, 3-10 toilets, 1-3 washouts, 6-12 months

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL: CONSTRUCTCONNECT STATUS DEFINITIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"Award" on ConstructConnect means the PROJECT OWNER has approved the project
and selected (awarded) a General Contractor. The GC is identified and the
project is moving forward. This is a POSITIVE, high-actionability signal.
NEVER list "GC not awarded" as a blocker when status is "Award" — by
definition a GC has been selected. The GC is your sales target.

"GC Bidding" means multiple GCs are competing; no winner yet. The opportunity
is to get on the eventual winner's vendor list early.

"Under Construction" means work has already started. Highest urgency.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CALIBRATION EXAMPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXAMPLE 1 — Award status, GC identified (QUALIFIES, HIGH confidence)
Input: {
  "title": "Walmart Supercenter #4349 - West Haven, UT",
  "status": "Award",
  "value_usd": 22000000,
  "companies_involved": ["Wadman Corporation"],
  "start_date": "2026-08-01"
}
Correct output (abbreviated):
{
  "qualifies": true,
  "services_needed": ["dumpster", "toilet", "washout"],
  "actionability_score": 88,
  "actionability_factors": ["GC identified: Wadman Corporation", "Award status — owner approved, GC selected", "Start date ~60 days out"],
  "actionability_blockers": [],
  "why_actionable": "Wadman Corporation is the awarded GC. Call them now to get on the vendor list before mobilization.",
  "qualification_confidence": 0.92
}
NOTE: Award status means GC IS awarded. Do NOT add "GC not officially awarded" to blockers.

EXAMPLE 2 — GC Bidding, no GC yet (QUALIFIES, MEDIUM confidence)
Input: {
  "title": "Crossroads Corporate Campus - Building B, Murray, UT",
  "status": "GC Bidding",
  "value_usd": 18500000,
  "companies_involved": [],
  "bid_date": "2026-07-15"
}
Correct output (abbreviated):
{
  "qualifies": true,
  "services_needed": ["dumpster", "toilet"],
  "actionability_score": 62,
  "actionability_factors": ["Large commercial project ($18.5M)", "GC Bidding — bid date near, winner will need vendors quickly"],
  "actionability_blockers": ["GC not yet identified — no specific contact available until award"],
  "why_actionable": "GC award expected around July 15. Follow up post-bid to pitch the winning GC before mobilization.",
  "qualification_confidence": 0.71
}

EXAMPLE 3 — Design phase only (DOES NOT QUALIFY)
Input: {
  "title": "Sandy City Police Station - Feasibility Study & Schematic Design",
  "status": "Pre-Construction/Negotiated",
  "value_usd": 850000,
  "companies_involved": ["VCBO Architecture"],
  "bid_date": ""
}
Correct output (abbreviated):
{
  "qualifies": false,
  "disqualify_reason": "Design/feasibility phase only — no physical construction work; no dumpsters or toilets needed at this stage",
  "services_needed": [],
  "actionability_score": 5,
  "actionability_factors": [],
  "actionability_blockers": ["Architecture firm listed — design phase, not construction", "No bid or start date for construction phase", "$850K value reflects design fee, not construction value"],
  "why_actionable": "Not actionable now. File for follow-up when a construction GC is identified.",
  "qualification_confidence": 0.95
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUDGET PRICING REQUESTED: Set budget_pricing_requested=true when the contracting
method is "Negotiated" or "Design-Build", or when the description indicates the
GC is providing early budget estimates before full design completion (pre-con
services, early vendor pricing, or cost-model requests). This is a positive signal
— it means the GC is engaged early and will need vendors before formal bidding.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Always explain your reasoning. The explanation matters more than the score.

Respond ONLY with valid JSON — no markdown, no prose outside the JSON object."""

_RESPONSE_SCHEMA = """{
  "qualifies": true | false,
  "disqualify_reason": "string or null if qualifies",
  "services_needed": ["dumpster", "toilet", "washout"]  (subset of these three),
  "actionability_score": 0-100,
  "actionability_factors": ["list of positive factors found"],
  "actionability_blockers": ["list of blockers, or empty list"],
  "budget_pricing_requested": true | false  (true if negotiated/design-build method or GC is requesting early vendor pricing),
  "revenue_estimate": {
    "monthly_low": number,
    "monthly_high": number,
    "duration_months": number,
    "total_low": number,
    "total_high": number,
    "assumptions": "brief one-sentence explanation"
  },
  "why_actionable": "1-2 sentence explanation of why (or why not) to pursue now",
  "recommended_action": "What FTDS should do and when — be specific",
  "qualification_confidence": 0.0-1.0  (your confidence in this qualification decision: 1.0=certain, 0.5=uncertain)
}"""


def _build_project_summary(project: dict) -> str:
    """Flatten a project record to the fields the LLM needs. Avoids sending raw API bloat."""
    address = project.get("address") or {}
    location = f"{address.get('city', '')}, {address.get('state', '')}".strip(", ")

    summary = {
        "title": project.get("title", ""),
        "description": (project.get("projectDescription") or "")[:600],
        "status": project.get("projectStatus", ""),
        "value_usd": project.get("projectValue", 0),
        "value_range": project.get("projectValueRange", ""),
        "categories": project.get("categories", ""),
        "sub_categories": project.get("subCategories", ""),
        "building_uses": project.get("buildingUsesString", ""),
        "construction_types": project.get("constructionTypes", ""),
        "trades": project.get("trades", ""),
        "location": location,
        "bid_date": project.get("bidDate", ""),
        "start_date": project.get("startDate", ""),
        "contracting_method": project.get("contractingMethod", ""),
        "bids_to_role": project.get("bidsToContactRoleGroup", ""),
        "companies_involved": project.get("companyNameList", ""),
        "sector": project.get("sectors", ""),
    }
    return json.dumps(summary, indent=2)


def qualify_project(project: dict) -> dict:
    """
    Run AI qualification on a single project.

    Uses prompt caching on the system prompt — the first call in a session
    writes the cache; subsequent calls read it at ~10% of the token cost.
    """
    user_content = (
        f"Analyze this construction project for FullTilt Dumpster Services:\n\n"
        f"{_build_project_summary(project)}\n\n"
        f"Respond with JSON matching this schema exactly:\n{_RESPONSE_SCHEMA}"
    )

    response = _client.messages.create(
        model=QUALIFIER_MODEL,
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": _SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},  # Cache the system prompt across calls
            }
        ],
        messages=[{"role": "user", "content": user_content}],
    )

    raw = response.content[0].text.strip()

    # Handle cases where the model wraps JSON in markdown fences
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    return json.loads(raw)
