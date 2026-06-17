import os
from dotenv import load_dotenv

load_dotenv(override=True)  # override=True ensures .env values win over shell env vars

# --- API Credentials ---
CONSTRUCTCONNECT_API_KEY = os.getenv("CONSTRUCTCONNECT_API_KEY")
CONSTRUCTCONNECT_BASE_URL = "https://api.io.constructconnect.com/search/v1"
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

# --- Intake Thresholds ---
# Minimum project value to even consider.
# Utah market data: bulk of projects are $100K-$500K; $5M+ is top 19%.
# $500K gives a good signal-to-noise balance (60% of projects, ~$2K-$15K revenue/yr each).
MIN_PROJECT_VALUE = int(os.getenv("MIN_PROJECT_VALUE", "500000"))

# --- API-level pre-filters (ConstructConnect exact values) ---
# These are pushed directly to the CC API to reduce download volume before we even
# run client-side filtering. Values must match CC's taxonomy exactly.
#
# Rule: if the API supports it natively → filter there. Client-side filters
# then serve as a safety net ("belt and suspenders"), not the primary gate.

# Exact `categories` field values from CC's taxonomy (what appears in project responses).
# Used in filters.category — projects must match AT LEAST ONE of these.
TARGET_CC_CATEGORIES = [
    "Medical", "Health Care",                          # Healthcare
    "Educational",                                      # Education
    "Industrial",                                       # Industrial / Logistics
    "Multi-Residential", "Senior Living / Assisted Care", "Mixed Use",  # Multifamily
    "Retail", "Office", "Hotel / Motel / Resort",      # Commercial
    "Municipal", "Fire / Police",                       # Civic / Government
    "Roads / Highways",                                 # Infra with large on-site crews
]

# Pre-calculated projectValueRange strings the API accepts.
# "Not Available" = undisclosed budget — kept because large projects often don't
# publish a budget until GC bidding starts. Excluding them would miss big wins.
TARGET_VALUE_RANGES = [
    "$500k - $1 Million",
    "$1 Million - $5 Million",
    "$5 Million - $10 Million",
    "$10 Million - $100 Million",
    "$100 Million +",
    "Not Available",
]

# --- Target Building Types (client-side fallback) ---
# Used by filters.py for partial/keyword matching on subCategories, buildingUsesString,
# and any field the API category filter doesn't cover. Broader than TARGET_CC_CATEGORIES.
TARGET_CATEGORY_KEYWORDS = [
    # Healthcare
    "hospital", "medical", "health care", "healthcare", "clinic", "surgery center",
    # Education
    "educational", "school", "university", "college", "education", "campus",
    # Industrial / Logistics
    "industrial", "manufacturing", "warehouse", "distribution", "data center",
    # Multi-family residential
    "multi-residential", "apartment", "multi-family", "multifamily", "senior living",
    "mixed use", "mixed-use",
    # Commercial
    "retail", "office", "shopping", "hotel", "hospitality",
    # Civic / Government
    "municipal", "government", "courthouse", "fire / police", "fire station",
    # Infrastructure with large on-site crews
    "roads / highways", "highway", "road", "bridge",
]

# --- Project Status: Active Pursuit Window ---
# Statuses where outreach to GC makes sense.
# Also pushed to the API via filters.status.
ACTIVE_STATUSES = {
    "GC Bidding",
    "Sub-Bidding",
    "Pre-Construction/Negotiated",
    "Award",
    "Under Construction",
}

# --- Actionability: Start date urgency window ---
START_DATE_URGENT_DAYS = 90     # "Starts within 90 days" = high urgency

# --- AI Models ---
# Haiku: fast + cheap, used for bulk qualification (~$0.001/project)
QUALIFIER_MODEL = "claude-haiku-4-5"
# Sonnet: higher quality, used for final executive summaries
SUMMARY_MODEL = "claude-sonnet-4-5"

# --- Model Gateway ---
# Tier 2: OpenRouter (commercial models, OpenAI-compatible API)
# Cron expression for automatic pipeline runs — uncomment and install apscheduler to enable.
# See api.py lifespan() for the scheduler setup.
# PIPELINE_CRON_SCHEDULE = os.getenv("PIPELINE_CRON_SCHEDULE", "0 7 * * *")  # 7 AM UTC daily

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
# Comma-separated list of models in fallback order. OR tries each in sequence
# if the previous one is unavailable, rate-limited, or errors out.
OPENROUTER_MODELS = os.getenv(
    "OPENROUTER_MODELS",
    "google/gemini-2.0-flash-001,anthropic/claude-haiku-4-5,meta-llama/llama-3.3-70b-instruct",
).split(",")
# Tier 3: Ollama (local inference, always available)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL", "llama3.2:3b")

# --- Search Parameters ---
SEARCH_STATES = os.getenv("SEARCH_STATES", "UT").split(",")
SEARCH_DAYS_BACK = int(os.getenv("SEARCH_DAYS_BACK", "90"))

# --- Output ---
OUTPUT_DIR = "output"
MAX_LEADS_PER_RUN = int(os.getenv("MAX_LEADS_PER_RUN", "20"))

