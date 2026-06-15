"""
Dodge Construct Excel importer.

Dodge Data & Analytics exports project data as .xlsx files. Column names vary
slightly between export types, so this parser uses flexible name matching.

Usage:
    from dodge_client import DodgeClient
    projects = DodgeClient.load_excel("path/to/dodge_export.xlsx")
    # Returns list of dicts in the same internal format as ConstructConnect projects
"""

import re
from pathlib import Path

import openpyxl

# ── Column aliases (case-insensitive, partial match allowed) ──────────────────
# Maps internal field → list of possible Dodge column header substrings.
_COLUMN_MAP = {
    "dodge_id":        ["dodge project", "project number", "project id", "project #"],
    "title":           ["project name", "name"],
    "description":     ["description", "notes", "project notes"],
    "status":          ["action", "stage", "status", "project stage"],
    "category":        ["primary category", "category", "market segment", "project type"],
    "sub_category":    ["sub category", "subcategory", "secondary category"],
    "building_use":    ["building use", "building type", "use type"],
    "city":            ["city"],
    "state":           ["state"],
    "zip":             ["zip", "postal"],
    "value":           ["total value", "project value", "total project cost", "estimated value", "value"],
    "bid_date":        ["bid date", "bid due"],
    "start_date":      ["start date", "construction start", "est. start"],
    "completion_date": ["completion date", "est. completion"],
    "owner":           ["owner name", "owner"],
    "architect":       ["architect", "engineer", "a/e"],
    "gc":              ["general contractor", "gc name", "gc", "prime contractor"],
    "contracting":     ["contracting method", "delivery method", "contract type"],
}

# ── Dodge stage → ConstructConnect status mapping ─────────────────────────────
_STATUS_MAP = {
    "bid":              "GC Bidding",
    "bidding":          "GC Bidding",
    "gc bidding":       "GC Bidding",
    "pre-bid":          "Pre-Construction/Negotiated",
    "pre bid":          "Pre-Construction/Negotiated",
    "planning":         "Pre-Construction/Negotiated",
    "design":           "Pre-Construction/Negotiated",
    "pre-construction": "Pre-Construction/Negotiated",
    "negotiated":       "Pre-Construction/Negotiated",
    "awarded":          "Award",
    "award":            "Award",
    "sub-bidding":      "Sub-Bidding",
    "sub bidding":      "Sub-Bidding",
    "under construction": "Under Construction",
    "construction":       "Under Construction",
    "started":            "Under Construction",
    "in progress":        "Under Construction",
}


def _match_header(header: str, aliases: list[str]) -> bool:
    h = header.lower().strip()
    return any(alias in h for alias in aliases)


def _detect_columns(headers: list[str]) -> dict[str, int]:
    """Map internal field names to column indices in the sheet."""
    col_idx: dict[str, int] = {}
    for i, header in enumerate(headers):
        for field, aliases in _COLUMN_MAP.items():
            if field not in col_idx and _match_header(header, aliases):
                col_idx[field] = i
    return col_idx


def _parse_value(raw) -> float:
    """Parse a currency/numeric string to float."""
    if raw is None:
        return 0.0
    if isinstance(raw, (int, float)):
        return float(raw)
    s = re.sub(r"[^\d.]", "", str(raw))
    try:
        return float(s)
    except ValueError:
        return 0.0


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


def _normalize_status(raw_status: str) -> str:
    key = (raw_status or "").lower().strip()
    return _STATUS_MAP.get(key, raw_status or "Pre-Construction/Negotiated")


def _row_to_project(row: tuple, col_idx: dict[str, int], row_num: int) -> dict | None:
    """Convert a spreadsheet row to an internal project dict."""
    def get(field):
        idx = col_idx.get(field)
        if idx is None:
            return None
        val = row[idx]
        return str(val).strip() if val is not None else None

    title = get("title")
    if not title:
        return None  # skip empty rows

    value = _parse_value(get("value"))
    gc = get("gc") or ""
    owner = get("owner") or ""
    architect = get("architect") or ""

    companies = [c for c in [gc, owner, architect] if c]

    raw_status = get("status") or ""
    cc_status = _normalize_status(raw_status)

    dodge_id = get("dodge_id") or f"dodge_{row_num}"

    return {
        # Identifier — prefixed so it never collides with a CC projectId
        "projectId":              f"dodge:{dodge_id}",
        "source":                 "Dodge",
        "title":                  title,
        "projectDescription":     get("description") or "",
        "projectStatus":          cc_status,
        "projectValue":           value,
        "projectValueRange":      _value_range_label(value),
        "categories":             get("category") or "",
        "subCategories":          get("sub_category") or "",
        "buildingUsesString":     get("building_use") or "",
        "constructionTypes":      "",
        "trades":                 "",
        "address": {
            "city":  get("city") or "",
            "state": get("state") or "",
            "zip":   get("zip") or "",
        },
        "bidDate":                get("bid_date") or "",
        "startDate":              get("start_date") or "",
        "contractingMethod":      get("contracting") or "",
        "bidsToContactRoleGroup": "",
        "companyNameList":        companies,
        # Metadata for dedup
        "_dodge_raw_status":      raw_status,
        "_dodge_owner":           owner,
        "_dodge_gc":              gc,
    }


class DodgeClient:
    @staticmethod
    def load_excel(path: str | Path, sheet_name: str | None = None) -> list[dict]:
        """
        Parse a Dodge Construct Excel export and return a list of project dicts
        in the same format as ConstructConnectClient.fetch_all().

        Args:
            path: Path to the .xlsx file.
            sheet_name: Specific sheet to read. Defaults to the first sheet.

        Returns:
            List of project dicts. Rows with empty titles are skipped.
        """
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = wb[sheet_name] if sheet_name else wb.active

        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []

        # First non-empty row is the header
        headers = [str(h).strip() if h is not None else "" for h in rows[0]]
        col_idx = _detect_columns(headers)

        if not col_idx:
            raise ValueError(
                f"Could not detect any known columns in '{path}'. "
                f"Found headers: {headers[:10]}"
            )

        projects = []
        for row_num, row in enumerate(rows[1:], start=2):
            project = _row_to_project(row, col_idx, row_num)
            if project:
                projects.append(project)

        wb.close()
        print(f"[dodge] Loaded {len(projects)} projects from '{path}' "
              f"(detected columns: {sorted(col_idx.keys())})")
        return projects
