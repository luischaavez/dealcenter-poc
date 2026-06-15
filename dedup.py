"""
Cross-source deduplication for ConstructConnect + Dodge Construct projects.

A project on CC and the same project on Dodge will have different IDs and
slightly different names, so we can't do exact matching. Instead we build a
multi-signal fingerprint and group projects that are likely the same.

Fingerprint signals (all normalized):
  1. City + State  (exact match required)
  2. Value bucket  (within one bucket step)
  3. Title tokens  (Jaccard similarity >= threshold)
  4. Bid-month     (same month, if both have one)

Two projects are considered duplicates when they share city/state AND at least
two of the other three signals match.

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


# ── Public API ─────────────────────────────────────────────────────────────────
def deduplicate(
    cc_projects: list[dict],
    dodge_projects: list[dict],
) -> list[dict]:
    """
    Merge CC and Dodge projects, deduplicate cross-source matches.

    For each matched pair:
      - The CC project is kept as the representative (more structured data)
      - It's annotated with `_dedup_confirmed=True` and `_dodge_id`
      - The Dodge duplicate is dropped from the output
      - Confidence boost (+10) is applied via `_dedup_confidence_bonus`

    Unmatched Dodge projects are included as-is.

    Returns:
        Merged list with dedup annotations. Order: CC first, then unmatched Dodge.
    """
    if not dodge_projects:
        for p in cc_projects:
            p.setdefault("source", "CC")
        return cc_projects

    for p in cc_projects:
        p.setdefault("source", "CC")
    for p in dodge_projects:
        p.setdefault("source", "Dodge")

    all_projects = cc_projects + dodge_projects
    groups = _find_groups(all_projects)

    result = []
    dodge_matched_ids: set[str] = set()

    cc_count = len(cc_projects)

    for group in groups:
        if len(group) == 1:
            continue  # singleton — handle below

        cc_indices  = [i for i in group if i < cc_count]
        dodge_indices = [i for i in group if i >= cc_count]

        if cc_indices and dodge_indices:
            # Cross-source match: keep CC representative, annotate it
            representative = all_projects[cc_indices[0]]
            dodge_ids = [
                all_projects[i].get("projectId", "") for i in dodge_indices
            ]
            representative["_dedup_confirmed"] = True
            representative["_dedup_dodge_ids"] = dodge_ids
            representative["_dedup_confidence_bonus"] = 10
            representative["source"] = "CC+Dodge"
            result.append(representative)
            for i in dodge_indices:
                dodge_matched_ids.add(all_projects[i].get("projectId", ""))
        else:
            # Same-source group (shouldn't happen, but handle gracefully)
            result.extend(all_projects[i] for i in group)

    # Add singletons
    for i, p in enumerate(all_projects):
        pid = p.get("projectId", "")
        if i < cc_count:
            # CC singleton — include if not already in result
            if not p.get("_dedup_confirmed"):
                result.append(p)
        else:
            # Dodge singleton — include only if not matched to a CC project
            if pid not in dodge_matched_ids:
                result.append(p)

    cc_final   = sum(1 for p in result if "CC" in p.get("source", ""))
    dodge_only = sum(1 for p in result if p.get("source") == "Dodge")
    matched    = sum(1 for p in result if p.get("source") == "CC+Dodge")

    print(
        f"[dedup] {len(cc_projects)} CC + {len(dodge_projects)} Dodge → "
        f"{len(result)} merged  "
        f"({matched} cross-source matches, {dodge_only} Dodge-only)"
    )

    return result
