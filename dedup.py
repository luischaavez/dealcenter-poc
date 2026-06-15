"""
Cross-source deduplication for ConstructConnect + Dodge Construct projects.

Both CC and Dodge use apps.construction.com as their underlying platform,
so their project IDs are identical. Dedup strategy:

  Pass 1 — Exact ID match (definitive, zero false positives)
  Pass 2 — Fuzzy fingerprint for projects only in one source
            (city/state + title Jaccard + value bucket + bid-month)

Public API:
    deduplicate(cc_projects, dodge_projects)
        → list[dict]   (merged list, duplicates annotated)
"""

import re
from difflib import SequenceMatcher

# ── Value bucketing ────────────────────────────────────────────────────────────
_VALUE_BUCKETS = [0, 500_000, 1_000_000, 5_000_000, 10_000_000, 100_000_000, float("inf")]


def _value_bucket(value: float) -> int:
    for i, upper in enumerate(_VALUE_BUCKETS[1:], 1):
        if value < upper:
            return i
    return len(_VALUE_BUCKETS)


def _buckets_close(v1: float, v2: float) -> bool:
    """True if the two values are in the same or adjacent bucket."""
    if v1 <= 0 or v2 <= 0:
        return True  # at least one unknown — don't penalize
    return abs(_value_bucket(v1) - _value_bucket(v2)) <= 1


# ── Title normalization ────────────────────────────────────────────────────────
_STOP_WORDS = {
    "the", "a", "an", "of", "and", "or", "for", "in", "at", "on",
    "building", "project", "construction", "center", "complex",
    "new", "renovation", "addition", "phase", "lot", "parcel",
}


def _title_tokens(title: str) -> set[str]:
    words = re.sub(r"[^a-z0-9 ]", " ", title.lower()).split()
    return {w for w in words if w not in _STOP_WORDS and len(w) >= 3}


def _title_similarity(t1: str, t2: str) -> float:
    tok1 = _title_tokens(t1)
    tok2 = _title_tokens(t2)
    if not tok1 or not tok2:
        return 0.0
    intersection = tok1 & tok2
    union = tok1 | tok2
    return len(intersection) / len(union)  # Jaccard


# ── Date helpers ───────────────────────────────────────────────────────────────
def _bid_month(project: dict) -> str | None:
    date = project.get("bidDate") or ""
    if len(date) >= 7:
        return date[:7]  # "YYYY-MM"
    return None


# ── Location helpers ───────────────────────────────────────────────────────────
def _location_key(project: dict) -> tuple[str, str]:
    addr = project.get("address") or {}
    city  = (addr.get("city") or "").strip().lower()
    state = (addr.get("state") or "").strip().upper()
    return city, state


# ── Core matching ──────────────────────────────────────────────────────────────
def _are_duplicates(p1: dict, p2: dict, title_threshold: float = 0.35) -> bool:
    """
    True if p1 and p2 are likely the same real-world project.

    Rule: same city/state  AND  at least 2 of 3 secondary signals match.
    """
    loc1 = _location_key(p1)
    loc2 = _location_key(p2)

    # City+State must match (or both be unknown)
    if loc1[0] and loc2[0] and loc1 != loc2:
        return False
    if not loc1[0] and not loc2[0]:
        return False  # both unknown — not enough info

    # Count secondary signal matches
    matches = 0

    # Signal 1: title similarity
    if _title_similarity(p1.get("title", ""), p2.get("title", "")) >= title_threshold:
        matches += 1

    # Signal 2: value proximity
    if _buckets_close(p1.get("projectValue", 0), p2.get("projectValue", 0)):
        matches += 1

    # Signal 3: bid month agreement
    m1, m2 = _bid_month(p1), _bid_month(p2)
    if m1 and m2 and m1 == m2:
        matches += 1
    elif m1 is None or m2 is None:
        # Can't compare — don't penalize, give half-credit
        matches += 0.5

    return matches >= 2


# ── Group builder ──────────────────────────────────────────────────────────────
def _find_groups(projects: list[dict]) -> list[list[int]]:
    """
    Union-Find grouping of projects that are likely duplicates.
    Returns a list of groups, each group is a list of indices into `projects`.
    """
    parent = list(range(len(projects)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x, y):
        parent[find(x)] = find(y)

    # O(n²) — acceptable for PoC sizes (< 5000 projects)
    for i in range(len(projects)):
        for j in range(i + 1, len(projects)):
            # Only compare across sources to avoid collapsing within-source entries
            src_i = projects[i].get("source", "CC")
            src_j = projects[j].get("source", "CC")
            if src_i != src_j and _are_duplicates(projects[i], projects[j]):
                union(i, j)

    groups: dict[int, list[int]] = {}
    for i in range(len(projects)):
        root = find(i)
        groups.setdefault(root, []).append(i)

    return list(groups.values())


# ── Annotation helpers ─────────────────────────────────────────────────────────
def _annotate_match(cc_project: dict, dodge_project: dict, match_type: str) -> None:
    """Mark a CC project as confirmed by Dodge."""
    cc_project["source"]                    = "CC+Dodge"
    cc_project["_dedup_confirmed"]          = True
    cc_project["_dedup_match_type"]         = match_type  # "exact_id" | "fuzzy"
    cc_project["_dedup_confidence_bonus"]   = 10
    cc_project["_dodge_stage_raw"]          = dodge_project.get("_dodge_stage_raw", "")
    cc_project["_dodge_value_low"]          = dodge_project.get("_dodge_value_low", 0)
    cc_project["_dodge_value_high"]         = dodge_project.get("_dodge_value_high", 0)
    # Enrich companies list with any names Dodge has that CC doesn't
    cc_companies = set(cc_project.get("companyNameList") or [])
    for name in (dodge_project.get("companyNameList") or []):
        if name and name not in cc_companies:
            (cc_project["companyNameList"] or []).append(name)


# ── Public API ─────────────────────────────────────────────────────────────────
def deduplicate(
    cc_projects: list[dict],
    dodge_projects: list[dict],
) -> list[dict]:
    """
    Merge CC and Dodge projects, deduplicate cross-source matches.

    Pass 1 (exact ID): Since both sources use apps.construction.com, project IDs
    are identical. Exact matches are definitive with zero false positives.

    Pass 2 (fuzzy): For projects only in one source, fall back to multi-signal
    fingerprint matching (city/state + title Jaccard + value bucket + bid-month).

    For each match:
      - CC project is kept as representative (more structured data)
      - Annotated with _dedup_confirmed, _dedup_match_type, _dedup_confidence_bonus=10
      - Dodge company names not already in CC are merged in

    Unmatched Dodge projects are appended at the end.
    """
    if not dodge_projects:
        for p in cc_projects:
            p.setdefault("source", "CC")
        return cc_projects

    for p in cc_projects:
        p.setdefault("source", "CC")
    for p in dodge_projects:
        p.setdefault("source", "Dodge")

    # Index CC projects by ID for O(1) lookup
    cc_by_id: dict[str, dict] = {
        p["projectId"]: p for p in cc_projects if p.get("projectId")
    }
    dodge_matched: set[str] = set()
    exact_matches = 0

    # ── Pass 1: Exact ID match ─────────────────────────────────────────
    for dp in dodge_projects:
        did = dp.get("projectId", "")
        if did and did in cc_by_id:
            _annotate_match(cc_by_id[did], dp, "exact_id")
            dodge_matched.add(did)
            exact_matches += 1

    # ── Pass 2: Fuzzy match for remaining Dodge projects ───────────────
    unmatched_cc = [p for p in cc_projects if not p.get("_dedup_confirmed")]
    unmatched_dodge = [p for p in dodge_projects if p.get("projectId") not in dodge_matched]
    fuzzy_matches = 0

    for dp in unmatched_dodge:
        for cp in unmatched_cc:
            if _are_duplicates(cp, dp):
                _annotate_match(cp, dp, "fuzzy")
                unmatched_cc.remove(cp)
                dodge_matched.add(dp.get("projectId", ""))
                fuzzy_matches += 1
                break

    # ── Build result ───────────────────────────────────────────────────
    dodge_only = [p for p in dodge_projects if p.get("projectId") not in dodge_matched]
    result = cc_projects + dodge_only

    matched_total = exact_matches + fuzzy_matches
    print(
        f"[dedup] {len(cc_projects)} CC + {len(dodge_projects)} Dodge → "
        f"{len(result)} merged  "
        f"({exact_matches} exact-ID + {fuzzy_matches} fuzzy matches, "
        f"{len(dodge_only)} Dodge-only added)"
    )

    return result
