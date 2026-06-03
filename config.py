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

# --- Target Building Types (FullTilt's target market) ---
# These generate construction debris + require on-site sanitation
TARGET_CATEGORY_KEYWORDS = [
    # Healthcare — ConstructConnect uses: "Medical", "Health Care"
    "hospital", "medical", "health care", "healthcare", "clinic", "surgery center",
    # Education — CC uses: "Educational"
    "educational", "school", "university", "college", "education", "campus",
    # Industrial / Logistics — CC uses: "Industrial"
    "industrial", "manufacturing", "warehouse", "distribution", "data center",
    # Multi-family residential — CC uses: "Multi-Residential"
    "multi-residential", "apartment", "multi-family", "multifamily", "senior living",
    "mixed use", "mixed-use",
    # Commercial — CC uses: "Retail", "Office"
    "retail", "office", "shopping", "hotel", "hospitality",
    # Civic / Government — CC uses: "Municipal", "Fire / Police"
    "municipal", "government", "courthouse", "fire / police", "fire station",
    # Infrastructure with large on-site crews (toilets apply) — CC uses: "Roads / Highways"
    "roads / highways", "highway", "road", "bridge",
]

# --- Project Status: Active Pursuit Window ---
# Statuses where outreach to GC makes sense
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

# --- Search Parameters ---
SEARCH_STATES = os.getenv("SEARCH_STATES", "UT").split(",")
SEARCH_DAYS_BACK = int(os.getenv("SEARCH_DAYS_BACK", "90"))

# --- Output ---
OUTPUT_DIR = "output"
MAX_LEADS_PER_RUN = int(os.getenv("MAX_LEADS_PER_RUN", "20"))
