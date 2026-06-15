"""
Ledger operations — the memory layer between pipeline runs.

Public API
──────────
  check_project(project)
      → (alert: str | None, cached: dict | None)
        alert = None            → project unchanged; cached result is valid
        alert = "new"           → first time seen; no cache
        alert = "status_changed"→ status changed; re-qualify
        alert = "updated"       → other fields changed; re-qualify

  update_project(project, ai_result, score_result, run_id, alert, alert_detail)
      → None  (upserts the projects ledger row)

  save_run(run_id, run_stats)
      → None  (inserts a runs row)

  save_leads(run_id, top_leads)
      → None  (inserts leads rows for this run)
"""

import hashlib
import json
from datetime import datetime
from typing import Optional, Tuple

from database import get_db, Project, Run, Lead


# ── Change detection ──────────────────────────────────────────────────────────

def _project_id(project: dict) -> str:
    return str(project.get("projectId") or project.get("id") or "")


def _project_hash(project: dict) -> str:
    """
    MD5 fingerprint of the fields that matter for re-qualification.
    If this hash changes between runs, we re-run Haiku on the project.
    Fields intentionally excluded: lastUpdatedDate, isViewed, isWatched
    (those change constantly but don't affect actionability).
    """
    key_fields = {
        "projectStatus":          project.get("projectStatus"),
        "projectValue":           project.get("projectValue"),
        "bidDate":                project.get("bidDate"),
        "startDate":              project.get("startDate"),
        "companyNameList":        sorted(project.get("companyNameList") or []),
        "contractingMethod":      project.get("contractingMethod"),
        "bidsToContactRoleGroup": project.get("bidsToContactRoleGroup"),
    }
    payload = json.dumps(key_fields, sort_keys=True, default=str).encode()
    return hashlib.md5(payload).hexdigest()


# ── Public: read ──────────────────────────────────────────────────────────────

def check_project(project: dict) -> Tuple[Optional[str], Optional[dict]]:
    """
    Determine whether a project needs AI qualification or can use cached results.

    Returns:
        (None, cached)             — no changes detected; use cached ai/score result
        ("new", None)              — first time; no cache available
        ("status_changed", None)   — status changed; re-qualify
        ("updated", None)          — other key field changed; re-qualify
    """
    pid = _project_id(project)
    if not pid:
        return "new", None

    with get_db() as session:
        existing = session.get(Project, pid)

        if existing is None:
            return "new", None

        new_hash = _project_hash(project)

        if new_hash == existing.field_hash:
            # Nothing changed — return cached results
            cached = {
                "ai_result":    existing.get_ai_result(),
                "score_result": existing.get_score_result(),
            }
            return None, cached

        # Something changed — determine priority
        new_status = project.get("projectStatus", "")
        if new_status != existing.last_status:
            return "status_changed", None

        return "updated", None


# ── Public: write ─────────────────────────────────────────────────────────────

def update_project(
    project: dict,
    ai_result: dict,
    score_result: dict,
    run_id: str,
    alert: Optional[str],
    alert_detail: Optional[str],
    pending_status: Optional[str] = None,
) -> None:
    """
    Upsert a project into the ledger.
    Called for every project that passed hard filters — whether AI was re-run
    or cached results were used.
    """
    pid        = _project_id(project)
    new_hash   = _project_hash(project)
    new_status = project.get("projectStatus", "")
    now        = datetime.utcnow()

    with get_db() as session:
        existing = session.get(Project, pid)

        if existing is None:
            # ── First time: INSERT ────────────────────────────────────────
            status_history = []
            if new_status:
                status_history.append({
                    "date":   now.date().isoformat(),
                    "status": new_status,
                })

            session.add(Project(
                project_id        = pid,
                title             = project.get("title", ""),
                first_seen        = now,
                last_seen         = now,
                last_run_id       = run_id,
                last_status       = new_status,
                last_score        = score_result.get("final_score"),
                field_hash        = new_hash,
                qualifies         = bool(ai_result.get("qualifies")),
                alert             = alert,
                alert_detail      = alert_detail,
                confidence_score  = score_result.get("confidence"),
                pending_status    = pending_status,
                status_history    = json.dumps(status_history),
                last_ai_result    = json.dumps(ai_result),
                last_score_result = json.dumps(score_result),
            ))

        else:
            # ── Seen before: UPDATE ───────────────────────────────────────
            history = existing.get_status_history()

            # Append to history if status changed
            if new_status and new_status != existing.last_status:
                history.append({
                    "date": now.date().isoformat(),
                    "from": existing.last_status,
                    "to":   new_status,
                })

            existing.title             = project.get("title", existing.title)
            existing.last_seen         = now
            existing.last_run_id       = run_id
            existing.last_status       = new_status
            existing.last_score        = score_result.get("final_score")
            existing.field_hash        = new_hash
            existing.qualifies         = bool(ai_result.get("qualifies"))
            existing.alert             = alert
            existing.alert_detail      = alert_detail
            existing.confidence_score  = score_result.get("confidence")
            # Only update pending_status if explicitly provided (don't overwrite human decisions)
            if pending_status is not None:
                existing.pending_status = pending_status
            existing.status_history    = json.dumps(history)
            existing.last_ai_result    = json.dumps(ai_result)
            existing.last_score_result = json.dumps(score_result)

        session.commit()


def save_run(run_id: str, run_stats: dict) -> None:
    """Record a pipeline execution in the runs table."""
    with get_db() as session:
        session.add(Run(
            id        = run_id,
            run_at    = datetime.utcnow(),
            states    = json.dumps(run_stats.get("states", [])),
            days_back = run_stats.get("days_back", 0),
            ingested  = run_stats.get("ingested", 0),
            filtered  = run_stats.get("filtered", 0),
            qualified = run_stats.get("qualified", 0),
            surfaced  = run_stats.get("surfaced", 0),
        ))
        session.commit()


def save_leads(run_id: str, top_leads: list) -> None:
    """Persist the top leads for this run to the leads table."""
    with get_db() as session:
        for r in top_leads:
            pid = str(
                r["project"].get("projectId") or r["project"].get("id") or ""
            )
            session.add(Lead(
                run_id            = run_id,
                project_id        = pid,
                rank              = r.get("rank", 0),
                score             = r.get("score_result", {}).get("final_score", 0),
                alert             = r.get("alert"),
                alert_detail      = r.get("alert_detail"),
                ai_result         = json.dumps(r.get("ai_result", {})),
                score_result      = json.dumps(r.get("score_result", {})),
                narrative_summary = r.get("narrative_summary", ""),
                project_snapshot  = json.dumps(r.get("project", {})),
            ))
        session.commit()
