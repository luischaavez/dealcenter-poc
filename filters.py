"""
Hard filter rules — applied client-side after the API pre-filter stage.

Architecture note — two-layer filtering:
  Layer 1 (API, client.py):  status, projectCategory, category, projectValueRange
      Reduces the download payload by ~80% before any data touches this module.
  Layer 2 (client-side, here): belt-and-suspenders checks + logic the API can't express
      (partial keyword matching on subCategories, pure-infra detection, etc.)

The checks below that mirror Layer 1 (is_construction_category, has_active_status,
meets_value_threshold, matches_target_building_type) are intentionally kept as safety
nets — they catch edge cases where the API returns data outside the filter window and
make the behavior predictable even if the payload changes.

Key data findings from ConstructConnect Utah sample (300 projects):
  - `categories` is a LIST, not a string — must flatten before keyword search
  - `bidsToContactRoleGroup` is "Owner" for ~84% of projects in GC Bidding stage
    (the Owner is still receiving GC bids — the GC gets assigned later)
    → Don't filter on GC presence; use projectStatus to infer GC will appear
"""

from config import MIN_PROJECT_VALUE, TARGET_CATEGORY_KEYWORDS, ACTIVE_STATUSES

_TARGET_KW = [kw.lower() for kw in TARGET_CATEGORY_KEYWORDS]

# Projects whose ONLY category is pure linear infrastructure (no crews, no debris)
_PURE_INFRA_KW = [
    "water / sewer", "water/sewer", "pipeline", "dam", "waterway",
    "electric", "telecom", "fiber", "utility line",
]


def _flatten(value) -> str:
    """
    Safely convert any field (string, list, None) to a single lowercase string.
    ConstructConnect returns some fields as lists (e.g. `categories`).
    """
    if value is None:
        return ""
    if isinstance(value, list):
        return " ".join(str(item) for item in value).lower()
    return str(value).lower()


def _category_text(project: dict) -> str:
    """All category-related fields joined into one searchable string."""
    return " ".join([
        _flatten(project.get("categories")),
        _flatten(project.get("subCategories")),
        _flatten(project.get("buildingUsesString")),
        _flatten(project.get("title")),
    ])


# ── Individual checks ────────────────────────────────────────────────────────

def is_construction_category(project: dict) -> bool:
    """
    Exclude 'Service Maintenance and Supply' projects — no physical construction.
    [API mirror] Also sent as filters.projectCategory=["Construction"] — this is the
    client-side safety net.
    """
    raw = project.get("projectCategory") or ""
    cat = _flatten(raw)
    # Blank = assume construction (field may be absent on some records)
    return cat == "" or "construction" in cat


def meets_value_threshold(project: dict) -> bool:
    """
    Project value must meet the configured minimum.
    Projects with no value disclosed (projectValue=0) are allowed through —
    large projects often don't publish a budget until GC bidding starts.
    [API mirror] Also sent as filters.projectValueRange — this catches any
    numeric values that slip through the range buckets.
    """
    value = project.get("projectValue") or 0
    return value == 0 or value >= MIN_PROJECT_VALUE


def has_active_status(project: dict) -> bool:
    """
    Only pursue projects in stages where outreach makes sense.
    [API mirror] Also sent as filters.status — this is the client-side safety net.
    """
    return project.get("projectStatus", "") in ACTIVE_STATUSES


def matches_target_building_type(project: dict) -> bool:
    """
    Project must be a building type that generates construction debris and
    requires on-site sanitation.

    Uses keyword matching across categories + subCategories + buildingUsesString,
    which is broader than the API's exact-match category filter and catches
    edge cases like subCategories that don't map to a top-level target category.

    Note: `categories` comes back as a list from the API, so we flatten first.
    [API mirror] Also sent as filters.category (exact CC strings) — this adds
    partial/keyword matching on top.
    """
    combined = _category_text(project)
    return any(kw in combined for kw in _TARGET_KW)


def is_not_pure_infrastructure(project: dict) -> bool:
    """
    Exclude projects that are ONLY linear / buried infrastructure.
    Water/sewer mains, fiber runs, etc. — minimal above-ground crew,
    no construction debris requiring roll-offs.

    Roads/Highways are ALLOWED: large paving crews need portable toilets.
    """
    cats = _flatten(project.get("categories"))
    has_building_target = matches_target_building_type(project)
    is_only_utility = any(kw in cats for kw in _PURE_INFRA_KW) and not has_building_target
    return not is_only_utility


# ── Master gate ──────────────────────────────────────────────────────────────

def apply_hard_filters(project: dict) -> tuple:
    """
    Run all hard filters. Returns (passes: bool, failures: list[str]).

    Removed: has_gc_in_chain
      Reason: 84% of ConstructConnect projects show bidsToContactRoleGroup='Owner'
      during GC Bidding stage — that's the Owner soliciting GC bids, which is exactly
      when FullTilt needs to appear on the GC's radar. The GC gets assigned later.
      The AI qualifier handles GC-presence scoring for actionability.
    """
    checks = [
        (is_construction_category,     "Service/maintenance — no physical construction"),
        (meets_value_threshold,        f"Value below ${MIN_PROJECT_VALUE:,.0f} (and not undisclosed)"),
        (has_active_status,            f"Status '{project.get('projectStatus')}' outside active window"),
        (matches_target_building_type, "Building type not in FullTilt target categories"),
        (is_not_pure_infrastructure,   "Pure underground/linear infrastructure"),
    ]

    failures = [msg for fn, msg in checks if not fn(project)]
    return len(failures) == 0, failures
