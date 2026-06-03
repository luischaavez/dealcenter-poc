# DealCenter PoC — Lead Qualification Pipeline

Proof of concept for **DealCenter**, an Enterprise Opportunity Intelligence Platform that continuously monitors construction project databases and surfaces only the opportunities that deserve attention from the FullTilt Dumpster Services (FTDS) sales team.

> *"DealCenter monitors opportunities. TrashLab manages opportunities."*
> — DEALCENTER REQUIREMENTS 20260531

---

## Background

### The Business Problem

ConstructConnect and Dodge Construction Central return thousands of construction project records for any given market. For Utah alone, the last 90 days produces ~1,937 active projects. The challenge is not a lack of information — it is determining:

- Which opportunities **matter**
- **Why** they matter
- Whether they are **actionable** now
- Whether FTDS has **existing relationships** involved
- **When** they should move into active pursuit

This pipeline solves that problem by reducing 1,937 records to a ranked list of 20–50 actionable leads, each with an Opportunity Executive Summary ready to hand to the sales team.

### FullTilt Dumpster Services

FTDS rents three categories of equipment to **General Contractors** on commercial construction sites:

| Service | Unit Rate | Notes |
|---|---|---|
| Roll-off dumpsters | ~$300/month | Construction debris removal |
| Portable toilets | ~$150/month | On-site worker sanitation |
| Concrete washouts | ~$400/month | Containment for concrete truck washout |

Revenue is **recurring monthly rental** per unit deployed. A typical large project ($50M+) generates $150K–$500K in total revenue over 18–24 months. The GC is always the customer — FTDS does not sell directly to project owners.

### What DealCenter Is Not

Per the requirements document, DealCenter is explicitly **not**:

- A CRM (TrashLab is the system of record)
- An email generator or outreach automation tool
- A proposal generator
- A replacement for TrashLab's deal, task, and pipeline management

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   CONSTRUCTCONNECT API                          │
│  POST /search/v1/ProjectLeads?x-api-key=***                     │
│  ~1,937 projects · Utah · last 90 days                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ paginated (100/page)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 1 — INGEST                          client.py            │
│  • Paginate through all results                                 │
│  • Yield one project dict at a time                             │
│  • Optional max_projects cap for testing                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │ ~1,937 projects
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 2 — HARD FILTER                     filters.py           │
│  5 rule-based checks · no AI · ~0ms/project                     │
│  Typical pass rate: 20–25%                                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │ ~200–400 candidates
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 3 — AI QUALIFICATION                qualifier.py         │
│  Claude Haiku · prompt caching · ~$0.001/project               │
│  Structured JSON output per project                             │
│  Typical pass rate: 60–70% of filtered candidates               │
└──────────────────────────┬──────────────────────────────────────┘
                           │ qualified leads
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 4 — SCORE & RANK                    scorer.py            │
│  Composite 0–100 score · no AI                                  │
│  Combines AI output with date/value signals                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │ ranked list
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 5 — OUTPUT                          formatter.py         │
│  Console leaderboard + Opportunity Executive Summaries          │
│  output/leads_TIMESTAMP.json                                    │
│  output/summaries_TIMESTAMP.txt                                 │
└─────────────────────────────────────────────────────────────────┘
```

### File Map

| File | Responsibility |
|---|---|
| `main.py` | Pipeline orchestrator, CLI entry point |
| `config.py` | All thresholds and parameters (reads from `.env`) |
| `client.py` | ConstructConnect API wrapper with pagination |
| `filters.py` | Hard filter rules (no AI) |
| `qualifier.py` | Claude AI qualification agent |
| `scorer.py` | Composite scoring logic |
| `formatter.py` | Executive summary generation and file output |
| `diagnose.py` | Standalone diagnostic: value/status/category distributions |

---

## Pipeline Stages in Detail

### Stage 1 — Ingest (`client.py`)

Paginates through the ConstructConnect search API using a POST request with a JSON payload. Key parameters:

```python
{
  "limit": 100,
  "offset": <incremented per page>,
  "sort": "lastUpdatedDate",
  "sortDir": "desc",
  "filters": {
    "dates": [{"value": -90, "type": "LastUpdatedDate"}],
    "contentType": "CuratedProject, ItbProject",
    "states": ["UT"]
  }
}
```

The API key is passed as a query parameter (`?x-api-key=***`), not a header. Results are in the `docs` array of the response (not `projectLeads` as the field name might suggest).

A 300ms courtesy delay is inserted between pages to avoid rate limiting.

---

### Stage 2 — Hard Filter (`filters.py`)

Five rules applied in sequence, each operating purely on structured fields. No LLM involved. A project must pass **all five** to proceed.

#### Rule 1 — Construction Category
```
projectCategory must contain "construction"
```
Excludes **"Service Maintenance and Supply"** projects — janitorial contracts, HVAC maintenance agreements, inspection services. These generate no construction debris and have no GC involved.

In the Utah sample: 32/300 projects (11%) were service/maintenance.

#### Rule 2 — Minimum Project Value
```
projectValue >= $500,000  OR  projectValue == 0 (undisclosed)
```
Projects with no disclosed value are allowed through — large projects sometimes have confidential budgets. Projects explicitly below $500K are excluded because the expected FTDS revenue ($2K–$8K/year) does not justify the sales cost.

> **Note on threshold calibration:** The requirements document cites "$50M" as an example intake criterion, but that reflects the top tier of the Utah market (only 3% of projects). The $500K floor captures 60% of projects while still excluding the long tail of tiny jobs.

In the Utah sample: 107/300 projects (36%) fell below $500K.

#### Rule 3 — Active Status
```
projectStatus ∈ {GC Bidding, Sub-Bidding, Pre-Construction/Negotiated, Award, Under Construction}
```
Status represents where the project sits in the construction lifecycle. The actionable window for FTDS is roughly "a GC is about to be selected or has just been selected."

| Status | Meaning | FTDS opportunity |
|---|---|---|
| GC Bidding | Owner is collecting GC bids | Get on GC's vendor list before award |
| Sub-Bidding | GC is collecting subcontractor bids | GC is identified; direct outreach |
| Pre-Construction/Negotiated | GC selected, finalizing scope | Ideal outreach window |
| Award | GC formally awarded | Urgent — start is imminent |
| Under Construction | Work has begun | Still opportunity; may not have vendor |
| Post-Bid | Bidding closed, evaluating | Too late to influence vendor selection |
| Bid Results | Winner announced, others notified | Too late |
| Design / Conceptual | No GC exists yet | Too early |

In the Utah sample: 82/300 projects (27%) were in terminal statuses (Post-Bid + Bid Results).

#### Rule 4 — Target Building Type
```
categories OR subCategories OR buildingUsesString OR title
must contain at least one target keyword
```
FTDS needs projects that involve physical vertical construction — buildings that generate debris and require on-site sanitation. Target categories (matched against actual ConstructConnect category values):

- **Healthcare:** Medical, Health Care, Hospital, Clinic
- **Education:** Educational, School, University, Campus
- **Industrial/Logistics:** Industrial, Manufacturing, Warehouse, Distribution, Data Center
- **Multi-family:** Multi-Residential, Apartment, Mixed Use, Senior Living
- **Commercial:** Retail, Office, Hotel, Hospitality
- **Civic:** Municipal, Government, Courthouse, Fire / Police
- **Infrastructure with large crews:** Roads / Highways, Bridge *(portable toilets for workers)*

> **Important API quirk:** The `categories` field is a **list**, not a string. `filters.py` flattens all category fields into a single lowercase string before keyword matching.

In the Utah sample: 102/300 projects (34%) matched no target category.

#### Rule 5 — Not Pure Infrastructure
```
Project must not be ONLY underground/linear infrastructure
```
Water/sewer mains, irrigation canals, fiber runs, and pipeline projects have no above-ground construction debris and minimal on-site crews. These are excluded unless the project also includes a building component.

Roads/Highways are **not** excluded here because large paving crews require portable toilets.

> **Why there is no "GC must be identified" rule:**
> Early analysis assumed we should require a General Contractor to be named in the `bidsToContactRoleGroup` field. Diagnostic data showed this is "Owner" for **84% of Utah projects** — even during GC Bidding stage. That is correct: the owner is still receiving GC bids; the GC hasn't been assigned yet. Filtering on this field would remove the most actionable window in the pipeline. The AI agent handles GC-presence scoring in Stage 3 instead.

---

### Stage 3 — AI Qualification (`qualifier.py`)

Each project that passes hard filters is evaluated by Claude using a structured prompt. The model returns a JSON object with qualification decision, services needed, actionability score, revenue estimate, and recommended action.

#### Prompt Caching

The system prompt (~600 tokens) is sent with `cache_control: ephemeral`. After the first call, the cached prompt is reused for all subsequent calls in the same run, reducing input token cost by ~90% for everything after the first project. This is the primary cost-control mechanism for batch processing.

```python
system=[{
    "type": "text",
    "text": SYSTEM_PROMPT,
    "cache_control": {"type": "ephemeral"}
}]
```

#### What the AI Evaluates

The model receives a flattened project summary (title, description truncated to 600 chars, status, value, categories, trades, CSI codes, dates, companies) and determines:

1. **Does this project physically require FTDS services?**
   - Is there actual construction debris? (not just design or inspection)
   - Will workers be on-site for extended periods? (toilet need)
   - Is there concrete work? (washout need)

2. **What signals point to actionability right now?**
   Per the requirements document, actionability signals include:
   - General contractor awarded
   - Construction start approaching
   - Existing customer awarded or bidding (not yet implemented — requires TrashLab data)
   - Known contacts involved (not yet implemented — requires TrashLab data)

3. **What is the estimated revenue opportunity?**
   Unit estimates by project scale:
   - $50M+: 20–40 dumpsters, 20–40 toilets, 5–10 washouts, 18–24 months
   - $20–50M: 10–20 dumpsters, 10–20 toilets, 3–6 washouts, 12–18 months
   - $5–20M: 3–10 dumpsters, 3–10 toilets, 1–3 washouts, 6–12 months

4. **What should the FTDS sales team do next, and when?**

#### AI Output Schema

```json
{
  "qualifies": true,
  "disqualify_reason": null,
  "services_needed": ["dumpster", "toilet", "washout"],
  "actionability_score": 0-100,
  "actionability_factors": ["list of positive signals found"],
  "actionability_blockers": ["list of risks or concerns"],
  "revenue_estimate": {
    "monthly_low": 9000,
    "monthly_high": 14400,
    "duration_months": 18,
    "total_low": 162000,
    "total_high": 259200,
    "assumptions": "..."
  },
  "why_actionable": "One-to-two sentence explanation.",
  "recommended_action": "Specific next step with timing."
}
```

#### Model Selection

| Use | Model | Reason |
|---|---|---|
| Bulk qualification | `claude-haiku-4-5` | Fast (~1s/project), cheap (~$0.001/project), sufficient for structured extraction |
| Executive summaries | `claude-sonnet-4-5` | Higher reasoning quality for final output (future enhancement) |

---

### Stage 4 — Score & Rank (`scorer.py`)

The final 0–100 composite score combines the AI's actionability judgment with rule-based signals that the AI cannot directly measure (exact date arithmetic, revenue thresholds).

#### Score Breakdown

```
Final Score = AI Component + Status Component + Urgency Component + Revenue Component
            =   (0–50 pts) +    (0–20 pts)   +    (0–15 pts)    +    (0–15 pts)
```

**AI Component — up to 50 points**

The AI's `actionability_score` (0–100) is scaled by 0.5×. This ensures the AI's holistic judgment contributes significantly but cannot alone push a project to the top of the list without supporting signals.

```
AI pts = ai_result["actionability_score"] × 0.5
```

**Status Component — up to 20 points**

Fixed rule-based signal. Status is the single most reliable indicator of timing.

| Status | Points | Reasoning |
|---|---|---|
| Award | 20 | GC selected, start imminent |
| Under Construction | 20 | Already on-site; still an opportunity |
| Sub-Bidding | 15 | GC identified and collecting subs |
| GC Bidding | 12 | Active solicitation; right time to engage |
| Pre-Construction/Negotiated | 10 | GC locked in, planning phase |
| Post-Bid | 5 | Late, but not impossible |

**Urgency Component — up to 15 points**

Date arithmetic against `startDate`. Projects starting sooner are more urgent.

| Start Date | Points | Reasoning |
|---|---|---|
| 0–30 days | 15 | Critical window — mobilize now |
| 31–90 days | 10 | Standard urgency |
| 91–180 days | 5 | Plan ahead |
| Already passed | 8 | Likely already on-site; may still need vendor |
| Not disclosed | 0 | No urgency signal |

**Revenue Component — up to 15 points**

Based on the AI's `revenue_estimate.total_high`.

| Estimated Revenue | Points |
|---|---|
| ≥ $500,000 | 15 |
| ≥ $150,000 | 10 |
| ≥ $50,000 | 5 |

#### Score Example — Walmart Supercenter New / West Haven

| Component | Detail | Points |
|---|---|---|
| AI (78 × 0.5) | GC named, large new construction, all three services | 39.0 |
| Status: Award | Project formally awarded | 20.0 |
| Start date passed | Construction likely underway | 8.0 |
| Revenue $259K | Large new Supercenter | 10.0 |
| **Total** | | **79.0 / 100** |

#### What the Score Does Not Yet Include

Two high-weight signals from the requirements document are **not implemented** in v1 because they require TrashLab data:

| Missing Signal | Expected Weight | Requires |
|---|---|---|
| GC is an existing FTDS customer | +20 pts (estimated) | TrashLab customer export |
| Known FTDS contacts (PM, estimator, super) involved | +15 pts (estimated) | TrashLab contact export |

Once TrashLab data is available, these signals will substantially reorder the ranking. A medium-sized project with a known GC customer will outrank a large project with no existing relationship.

---

### Stage 5 — Output (`formatter.py`)

Two files written to `output/` after each run:

**`leads_TIMESTAMP.json`**
Full structured data for all 300+ ingested projects, including:
- Raw project dict from ConstructConnect
- AI qualification result (or error if AI failed)
- Score result (for qualified projects)

Used for debugging, auditing AI decisions, and future deduplication logic.

**`summaries_TIMESTAMP.txt`**
Human-readable Opportunity Executive Summaries for all qualified projects, sorted by score descending. Per the requirements document:

> *"We increasingly believe [the Opportunity Executive Summary] may be the primary output of DealCenter."*

Each summary contains:
- Project overview (name, status, value, location, type)
- Actionability score with contributing factors
- Blockers and risks
- Services needed
- Estimated revenue opportunity with assumptions
- Companies involved (owner, GC, architect, engineer)
- Recommended action with timing
- Source link to ConstructConnect project page

---

## Configuration

All parameters are read from `.env`. Copy `.env.example` to get started:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `CONSTRUCTCONNECT_API_KEY` | required | API key passed as `?x-api-key=` query param |
| `ANTHROPIC_API_KEY` | required | Claude API key for AI qualification |
| `MIN_PROJECT_VALUE` | `500000` | Minimum project value to ingest. Set to `0` to include all. |
| `SEARCH_STATES` | `UT` | Comma-separated state codes: `UT,NV,ID` |
| `SEARCH_DAYS_BACK` | `90` | Look-back window for `lastUpdatedDate` filter |
| `MAX_LEADS_PER_RUN` | `20` | Top N leads to surface in the final output |

---

## Usage

### Setup

```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure credentials
cp .env.example .env
# Edit .env and add your API keys
```

### Running the Pipeline

```bash
# Full run — all projects in the configured window
python main.py

# Dry run — ingest + filter only, no AI cost
python main.py --dry-run

# Limit ingest for testing (recommended first run)
python main.py --limit 300

# Combine: test hard filters on 100 projects without spending AI credits
python main.py --dry-run --limit 100
```

### Diagnosing the Data

Before adjusting thresholds, run the diagnostic to understand the actual distribution in your market:

```bash
python diagnose.py             # Sample 200 projects
python diagnose.py --limit 500 # Larger sample
```

Output includes:
- Project value distribution by bucket
- Status distribution
- Top 20 categories (actual values from the API)
- bidsToContactRoleGroup breakdown
- Filter sensitivity table (how many projects pass at each value threshold)

---

## Cost Estimates

Based on Utah market data (300 projects sampled):

| Step | Unit cost | 300 projects | Full 1,937 |
|---|---|---|---|
| Hard filter | $0.00 | $0.00 | $0.00 |
| AI qualification (74 candidates) | ~$0.001 | ~$0.07 | ~$0.45 |
| **Total per run** | | **~$0.07** | **~$0.45** |

Prompt caching reduces the per-project AI cost by ~90% after the first call in a batch. Without caching, the same run would cost ~$0.70 for 300 projects.

---

## Sample Results

From a representative run (Utah, 90-day window, 300 projects):

```
300 ingested
 └─ 74 passed hard filters (25%)
     └─ 49 qualified by AI (66%)
         └─ Top 20 surfaced
```

Top 5 from that run:

| Rank | Project | Score | Status | Value |
|---|---|---|---|---|
| 1 | Walmart Supercenter #4349.3 / West Haven | 79 | Award | $50M |
| 2 | Creekstone Energy Solar Development | 79 | Under Construction | $17B |
| 3 | Bryce Canyon Holiday Inn Express | 76 | GC Bidding | $70M |
| 4 | Public Works Facility / Logan | 71 | Sub-Bidding | $54M |
| 5 | Parry Block / Salt Lake City | 71 | GC Bidding | $75M |

---

## Roadmap — Beyond the PoC

The requirements document outlines several capabilities not yet implemented:

### TrashLab Integration (highest priority)
Import customers, contacts, and previous project history from TrashLab to enable:
- **Relationship intelligence**: flag projects where the GC is an existing customer
- **Contact matching**: identify when known PMs, estimators, or supers are involved
- **Deal linkage**: link DealCenter opportunities to TrashLab deals when pursued

### Change Monitoring
> *"We believe one of the most valuable DealCenter functions may be identifying meaningful changes."*

Rather than reviewing every project on each run, surface only what changed:
- General contractor awarded (status change)
- Bid date moved
- Project value increased
- New contacts added
- Construction start date updated

This requires storing previous state and diffing on each run — a lightweight database (SQLite or JSON store) and a `diff.py` module.

### Deduplication Across Sources
The same project may appear in both ConstructConnect and Dodge Construction Central. Merge duplicate opportunity records into a single master record using fuzzy matching on title, location, and value.

### Opportunity Executive Summary as PDF
Generate each summary as a PDF file suitable for attachment to a TrashLab Deal record, enabling the manual handoff workflow described in the requirements document without requiring system integration.

---

## Key Design Decisions

**Why separate hard filter from AI qualification?**
The hard filter runs in microseconds per project and costs nothing. The AI call costs ~$0.001 and takes ~1 second. Running AI on all 1,937 projects would cost ~$2/run and take ~30 minutes. The hard filter removes ~75% of projects before the AI ever sees them.

**Why not filter on bidsToContactRoleGroup = "General Contractor"?**
In the Utah sample, 84% of projects showed "Owner" in this field — even during the GC Bidding stage. That field reflects who the current bid solicitation is directed to, not who the eventual GC will be. Filtering on it removes the most actionable stage in the pipeline.

**Why scale the AI score by 0.5×?**
Without scaling, an AI score of 100 alone would push the total to 100 before any date or status signals are added. The 0.5× scaling ensures that a project with strong AI conviction but a distant start date scores differently from one with the same AI score and a 2-week start date.

**Why allow projects with $0 value through the filter?**
Large projects sometimes have confidential budgets listed as zero in the database. Excluding them would miss high-value opportunities. The AI agent applies its own value judgment from the project description and context.
