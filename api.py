"""
DealCenter API — FastAPI backend.

Endpoints
─────────
  GET  /health                → service liveness check
  GET  /runs                  → list all runs, newest first
  GET  /runs/latest           → full payload (stats + leads) for the most recent run
  GET  /runs/{run_id}         → full payload for a specific run
  GET  /leads                 → alias for /runs/latest
  GET  /leads/{project_id}    → most recent Lead row for the given project
  GET  /pipeline/status       → current pipeline state
  POST /pipeline/run          → trigger a pipeline run (non-blocking)
"""

import json
import os
import threading
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import desc

from database import get_db, Run, Lead
from formatter import to_web_lead

# Path to the pre-generated JSON file (written by formatter.save_web_output)
_LATEST_JSON = Path("ui/data/leads_latest.json")


# ── Pipeline state ────────────────────────────────────────────────────────────

_pipeline_lock = threading.Lock()
_pipeline: dict = {
    "status":     "idle",
    "run_id":     None,
    "started_at": None,
    "error":      None,
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _reconstruct_result(lead: Lead) -> dict:
    """Rebuild the pipeline result dict from a persisted Lead row."""
    project = json.loads(lead.project_snapshot or "{}") if lead.project_snapshot else {}
    ai_result = json.loads(lead.ai_result or "{}") if lead.ai_result else {}
    score_result = json.loads(lead.score_result or "{}") if lead.score_result else {}
    return {
        "project":          project,
        "ai_result":        ai_result,
        "score_result":     score_result,
        "alert":            lead.alert,
        "alert_detail":     lead.alert_detail,
        "narrative_summary": lead.narrative_summary or "",
        "rank":             lead.rank,
    }


def _build_run_payload(run: Run, leads: list) -> dict:
    """Build the full response payload for a run."""
    run_stats = {
        "ingested":  run.ingested,
        "filtered":  run.filtered,
        "qualified": run.qualified,
        "surfaced":  run.surfaced,
        "states":    json.loads(run.states or "[]"),
        "days_back": run.days_back,
    }

    web_leads = []
    for lead in sorted(leads, key=lambda l: l.rank or 0):
        if lead.project_snapshot is None:
            print(f"[api] WARNING: lead id={lead.id} project_id={lead.project_id} has no project_snapshot — skipping")
            continue
        result = _reconstruct_result(lead)
        web_leads.append(to_web_lead(lead.rank or 0, result))

    return {
        "run_id":       run.id,
        "generated_at": run.run_at.isoformat(),
        "stats":        run_stats,
        "leads":        web_leads,
    }


# ── Pipeline thread ───────────────────────────────────────────────────────────

def _run_pipeline_task() -> None:
    """Entry point for the background pipeline thread."""
    # Import here to avoid circular import at module load time
    from main import run_pipeline  # noqa: PLC0415

    try:
        run_pipeline()
        with _pipeline_lock:
            _pipeline["status"] = "idle"
            _pipeline["error"]  = None
    except Exception as e:
        with _pipeline_lock:
            _pipeline["status"] = "error"
            _pipeline["error"]  = str(e)
    finally:
        with _pipeline_lock:
            _pipeline["run_id"] = None


# ── App factory ───────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("DealCenter API ready")
    yield


def _make_cors_origins() -> list[str]:
    # Check both CORS_ORIGINS and CORS_ORIGIN (common typo)
    raw = os.environ.get("CORS_ORIGINS") or os.environ.get("CORS_ORIGIN", "")
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    # Always include common localhost dev variants
    dev_extras = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]
    for extra in dev_extras:
        if extra not in origins:
            origins.append(extra)
    return origins


app = FastAPI(title="DealCenter API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_make_cors_origins(),
    # Covers all Vercel deployments: production + preview URLs
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/runs")
def list_runs():
    with get_db() as session:
        runs = session.query(Run).order_by(desc(Run.run_at)).all()
        return [
            {
                "id":     r.id,
                "run_at": r.run_at.isoformat() if r.run_at else None,
                "stats":  {
                    "ingested":  r.ingested,
                    "filtered":  r.filtered,
                    "qualified": r.qualified,
                    "surfaced":  r.surfaced,
                    "states":    json.loads(r.states or "[]"),
                    "days_back": r.days_back,
                },
            }
            for r in runs
        ]


@app.get("/runs/latest")
def get_latest_run():
    with get_db() as session:
        run = session.query(Run).order_by(desc(Run.run_at)).first()
        if run is None:
            raise HTTPException(status_code=404, detail="No runs found")
        leads = session.query(Lead).filter(Lead.run_id == run.id).all()
        return _build_run_payload(run, leads)


@app.get("/runs/{run_id}")
def get_run(run_id: str):
    with get_db() as session:
        run = session.get(Run, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")
        leads = session.query(Lead).filter(Lead.run_id == run.id).all()
        return _build_run_payload(run, leads)


@app.get("/leads")
def get_leads():
    """
    Latest run leads.
    Primary: DB → /runs/latest (full project_snapshot support, historical queries).
    Fallback: ui/data/leads_latest.json (used during transition before first DB run).
    """
    with get_db() as session:
        has_runs = session.query(Run).count() > 0

    if has_runs:
        return get_latest_run()

    # No DB runs yet — serve the pre-generated JSON directly
    if _LATEST_JSON.exists():
        print("[api] INFO: No DB runs found — serving ui/data/leads_latest.json")
        return json.loads(_LATEST_JSON.read_text())

    raise HTTPException(status_code=404, detail="No data available — run the pipeline first")


@app.get("/leads/{project_id}")
def get_lead(project_id: str):
    with get_db() as session:
        lead = (
            session.query(Lead)
            .filter(Lead.project_id == project_id)
            .order_by(desc(Lead.id))
            .first()
        )
        if lead is None:
            raise HTTPException(status_code=404, detail=f"No lead found for project '{project_id}'")
        result = _reconstruct_result(lead)
        return to_web_lead(lead.rank or 0, result)


@app.get("/pipeline/status")
def pipeline_status():
    with _pipeline_lock:
        return dict(_pipeline)


@app.post("/pipeline/run")
def trigger_pipeline():
    with _pipeline_lock:
        if _pipeline["status"] == "running":
            return {
                "accepted": False,
                "message":  "Pipeline already running",
                "run_id":   _pipeline["run_id"],
            }
        _pipeline["status"]     = "running"
        _pipeline["started_at"] = datetime.utcnow().isoformat()
        _pipeline["error"]      = None

    thread = threading.Thread(target=_run_pipeline_task, daemon=True)
    thread.start()
    return {"accepted": True, "message": "Pipeline started"}
