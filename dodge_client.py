"""
Dodge Construct data importer — supports CSV exports from apps.construction.com.

Usage:
    from dodge_client import DodgeClient
    projects = DodgeClient.load("path/to/export.csv")   # CSV
    projects = DodgeClient.load("path/to/export.xlsx")  # Excel
"""

import csv
import re
from pathlib import Path


# ── Stage priority mapping ─────────────────────────────────────────────────────
# Dodge ACTION STAGE(S) can be compound: "Bid Results Start", "GC Bidding Construction Documents"
# We check tokens in priority order and return the most advanced stage found.
#
# Priority (highest to lowest):
#   1. construction / start / notice of completion  → Under Construction
#   2. bid results                                  → GC Bidding (bids in, pre-award)
#   3. gc bidding                                   → GC Bidding
#   4. sub bidding                                  → Sub-Bidding
#   5. bidding / pre-qualification                  → GC Bidding
#   6. everything else                              → Pre-Construction/Negotiated

_STAGE_PRIORITY = [
    (["construction", "start", "notice of completion"], "Under Construction"),
    (["bid results"],                                   "GC Bidding"),
    (["gc bidding"],                                    "GC Bidding"),
    (["sub bidding"],                                   "Sub-Bidding"),
    (["bidding", "pre-qualification"],                  "GC Bidding"),
]
_STAGE_DEFAULT = "Pre-Construction/Negotiated"


def _map_stage(raw_stage: str) -> str:
    """Map a Dodge ACTION STAGE(S) value (possibly compound) to a CC status."""
    lower = raw_stage.lower()
    for tokens, cc_status in _STAGE_PRIORITY:
        if any(token in lower for token in tokens):
            return cc_status
    return _STAGE_DEFAULT


# ── Value helpers ──────────────────────────────────────────────────────────────
_MAX_REASONABLE_VALUE = 1_000_000_000  # cap Dodge's "999999999999999" sentinel


def _parse_value(raw: str) -> float:
    if not raw or raw.strip().upper() in ("N/A", ""):
        return 0.0
    cleaned = re.sub(r"[^\d.]", "", raw)
    try:
        v = float(cleaned)
        return min(v, _MAX_REASONABLE_VALUE)
    except ValueError:
        return 0.0


def _midpoint(low: float, high: float) -> float:
    if high <= 0:
        return low
    if low <= 0:
        return high
    return (low + high) / 2


def _value_range_label(value: float) -> str:
    if value <= 0:
        return "Not Available"
    if value < 500_000:
        return "Under $500k"
    if value < 1_000_000:
        return "$500k - $1 Million"
    if value < 5_000_000:
        return "$1 Million - $5 Million"
    if value < 10_000_000:
        return "$5 Million - $10 Million"
    if value < 100_000_000:
        return "$10 Million - $100 Million"
    return "$100 Million +"


# ── Date normalization ─────────────────────────────────────────────────────────
def _normalize_date(raw: str) -> str:
    """Convert MM/DD/YYYY → YYYY-MM-DD. Returns '' for N/A or blank."""
    if not raw or raw.strip().upper() in ("N/A", ""):
        return ""
    raw = raw.split("@")[0].strip()  # strip time part if present
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", raw)
    if m:
        return f"{m.group(3)}-{m.group(1).zfill(2)}-{m.group(2).zfill(2)}"
    return raw


# ── ID cleaning ────────────────────────────────────────────────────────────────
def _clean_id(raw: str) -> str:
    """Strip leading/trailing apostrophes that Dodge wraps around numbers."""
    return raw.strip().strip("'")


# ── Field extraction ───────────────────────────────────────────────────────────
_NA = {"n/a", "na", "", "none"}


def _field(row: dict, key: str) -> str:
    """Return field value, converting 'N/A' variants to empty string."""
    val = (row.get(key) or "").strip()
    return "" if val.lower() in _NA else val


def _companies(row: dict) -> list[str]:
    """Extract all named company roles from the row."""
    roles = ["GC: Company Name", "Owner: Company Name", "Architect: Company Name",
             "Construction Manager: Company Name"]
    seen, result = set(), []
    for role in roles:
        name = _field(row, role)
        if name and name not in seen:
            seen.add(name)
            result.append(name)
    return result


# ── Row → project dict ─────────────────────────────────────────────────────────
def _row_to_project(row: dict) -> dict | None:
    title = _field(row, "TITLE")
    if not title:
        return None
    if _field(row, "REPORT TYPE").lower() == "item only":
        return None  # bid items, not full projects

    dodge_id = _clean_id(_field(row, "DODGE REPORT NUMBER") or "")
    low_val  = _parse_value(_field(row, "LOW VALUE(S)"))
    high_val = _parse_value(_field(row, "HIGH VALUE(S)"))
    value    = _midpoint(low_val, high_val)

    cc_status  = _map_stage(_field(row, "ACTION STAGE(S)"))
    city       = _field(row, "CITY").title()
    state      = _field(row, "STATE")
    zip_code   = _clean_id(_field(row, "ZIP CODE"))
    bid_date   = _normalize_date(_field(row, "BID DATE"))
    start_date = _normalize_date(_field(row, "TARGET START DATE"))
    source_url = _field(row, "URL LINK TO PROJECT")

    return {
        "projectId":          dodge_id,
        "source":             "Dodge",
        "title":              title,
        "projectDescription": _field(row, "STATUS"),
        "projectStatus":      cc_status,
        "projectValue":       value,
        "projectValueRange":  _value_range_label(value),
        "categories":         _field(row, "PROJECT TYPE(S)"),
        "subCategories":      _field(row, "TYPE OF CONSTRUCTION"),
        "buildingUsesString": "",
        "constructionTypes":  _field(row, "FRAMING TYPE"),
        "trades":             "",
        "address": {
            "city":  city,
            "state": state,
            "zip":   zip_code,
        },
        "bidDate":                bid_date,
        "startDate":              start_date,
        "contractingMethod":      _field(row, "PROJECT DELIVERY SYSTEM"),
        "bidsToContactRoleGroup": "",
        "companyNameList":        _companies(row),
        "_dodge_url":             source_url,
        "_dodge_stage_raw":       _field(row, "ACTION STAGE(S)"),
        "_dodge_value_low":       low_val,
        "_dodge_value_high":      high_val,
    }


# ── CSV loader ─────────────────────────────────────────────────────────────────
def _load_csv(path: Path) -> list[dict]:
    projects = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=2):
            project = _row_to_project(row)
            if project:
                projects.append(project)
    return projects


# ── Excel loader ───────────────────────────────────────────────────────────────
def _load_excel(path: Path) -> list[dict]:
    try:
        import openpyxl
    except ImportError:
        raise ImportError("openpyxl is required for Excel import: pip install openpyxl")

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    if not rows:
        return []

    headers = [str(h).strip() if h is not None else "" for h in rows[0]]
    projects = []
    for i, row_vals in enumerate(rows[1:], start=2):
        row = dict(zip(headers, [str(v).strip() if v is not None else "" for v in row_vals]))
        project = _row_to_project(row)
        if project:
            projects.append(project)
    return projects


# ── Public API ─────────────────────────────────────────────────────────────────
class DodgeClient:
    @staticmethod
    def load(path: str | Path) -> list[dict]:
        """
        Load a Dodge Construct export (.csv or .xlsx) and return project dicts
        in the same internal format as ConstructConnectClient.fetch_all().

        Dodge IDs (12-digit REPORT NUMBERs) and CC IDs (7-digit integers) are
        incompatible namespaces — cross-source dedup uses fuzzy matching only.
        """
        path = Path(path)
        if not path.exists():
            raise FileNotFoundError(f"Dodge export not found: {path}")

        suffix = path.suffix.lower()
        if suffix == ".csv":
            projects = _load_csv(path)
        elif suffix in (".xlsx", ".xls"):
            projects = _load_excel(path)
        else:
            raise ValueError(f"Unsupported file type '{suffix}'. Use .csv or .xlsx")

        # Summary of what we loaded
        by_status: dict[str, int] = {}
        for p in projects:
            s = p["projectStatus"]
            by_status[s] = by_status.get(s, 0) + 1

        print(f"[dodge] Loaded {len(projects)} projects from '{path.name}'")
        for status, count in sorted(by_status.items(), key=lambda x: -x[1]):
            print(f"         {count:4d}  {status}")

        return projects
