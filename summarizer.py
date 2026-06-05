"""
Executive summary generator — uses Claude Sonnet to produce polished, narrative
sales briefs for the top-ranked leads.

Called only on the final short list (top 20) AFTER scoring and ranking, so the
higher per-call cost is negligible:
  - Haiku qualification: ~$0.001 × N projects  (bulk, cheap)
  - Sonnet summaries:    ~$0.01  × 20 leads     (top list only, ~$0.20 total)

The system prompt is prompt-cached so it's billed once per batch run.
"""

import anthropic
from config import ANTHROPIC_API_KEY, SUMMARY_MODEL

_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

_SYSTEM_PROMPT = """You are a sales intelligence writer for FullTilt Dumpster Services (FTDS), a Utah-based company that rents roll-off dumpsters (~$300/mo), portable toilets (~$150/mo), and concrete washout containers (~$400/mo) to General Contractors on active commercial construction sites.

Your job: write a concise, compelling sales brief that a FTDS rep can read in under 60 seconds and immediately know why to call, who to call, and what to say.

FORMAT — three short paragraphs, no bullet points, no headers:

Paragraph 1 — The Opportunity: What the project is, its size and location, what stage it's in, and why FTDS should care. Mention specific dollar figures and dates. Convey urgency naturally.

Paragraph 2 — The Pitch: Which FTDS services are needed, how many units, for how long, and the total revenue opportunity in concrete numbers. Name the General Contractor if one is identified.

Paragraph 3 — The Action: Exactly who to contact, what to say, and when. Be specific — "Call the project superintendent at [Company] this week before bid award" is better than "reach out soon."

Style: Direct, confident, third-person ("FTDS should…", "The GC will need…"). No corporate filler. Each paragraph: 2–3 sentences. Total: 130–170 words.
"""


def generate_summary(project: dict, ai_result: dict, score_result: dict) -> str:
    """
    Generate a polished 3-paragraph sales brief for one qualified lead using Sonnet.

    Args:
        project:      Raw project dict from the ConstructConnect API
        ai_result:    Qualification result from qualifier.py (Haiku)
        score_result: Scoring result from scorer.py

    Returns:
        Plain text string — three paragraphs, ~150 words.
        Returns empty string on any error (caller handles gracefully).
    """
    address = project.get("address") or {}
    revenue = ai_result.get("revenue_estimate") or {}

    # Build a focused context block — only the fields Sonnet needs
    user_content = f"""Write a FTDS sales brief for this construction lead:

PROJECT:   {project.get('title', 'N/A')}
STATUS:    {project.get('projectStatus', 'N/A')}
VALUE:     ${project.get('projectValue', 0):,.0f}  ({', '.join(project.get('projectValueRange') or [])})
LOCATION:  {address.get('city', '')}, {address.get('state', '')}
CATEGORY:  {', '.join(project.get('categories') or [])}
BID DATE:  {project.get('bidDate') or 'Not set'}
START:     {project.get('startDate') or 'Not set'}
COMPANIES: {', '.join(project.get('companyNameList') or []) or 'Not yet identified'}

SERVICES NEEDED:    {', '.join(ai_result.get('services_needed') or [])}
WHY ACTIONABLE:     {ai_result.get('why_actionable', '')}
RECOMMENDED ACTION: {ai_result.get('recommended_action', '')}
ACTIONABILITY:      {score_result.get('final_score', 0)}/100

REVENUE ESTIMATE:
  Monthly:  ${revenue.get('monthly_low', 0):,.0f} – ${revenue.get('monthly_high', 0):,.0f}
  Total:    ${revenue.get('total_low', 0):,.0f} – ${revenue.get('total_high', 0):,.0f}
  Duration: {revenue.get('duration_months', 0)} months
  Basis:    {revenue.get('assumptions', '')}
"""

    response = _client.messages.create(
        model=SUMMARY_MODEL,
        max_tokens=512,
        system=[
            {
                "type": "text",
                "text": _SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},  # Cache across the top-20 batch
            }
        ],
        messages=[{"role": "user", "content": user_content}],
    )

    return response.content[0].text.strip()
