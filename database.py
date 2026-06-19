"""
SQLAlchemy ORM models and database setup.

Three tables:
  projects  — ledger: one row per CC project, updated each run
  runs      — one row per pipeline execution (replaces manifest.json)
  leads     — qualified leads per run (replaces web_*.json archives)

Migration path:
  SQLite (PoC)  →  PostgreSQL (production)  =  change one line:
    ENGINE = create_engine("postgresql://user:pass@host/dealcenter")
  Application code stays identical thanks to the ORM abstraction.
"""

import json
import os
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import (
    Boolean, Column, DateTime, Float, Integer, String, Text, create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session

DB_PATH = Path("dealcenter.db")

# Prefer DATABASE_URL (Railway Postgres) — fall back to local SQLite for dev
_DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{DB_PATH}")
# SQLAlchemy requires "postgresql://" — Railway may still emit the old "postgres://" scheme
_DATABASE_URL = _DATABASE_URL.replace("postgres://", "postgresql://", 1)

_is_sqlite = _DATABASE_URL.startswith("sqlite")

if _is_sqlite:
    ENGINE = create_engine(_DATABASE_URL, echo=False)
else:
    ENGINE = create_engine(
        _DATABASE_URL,
        echo=False,
        pool_pre_ping=True,   # detect stale connections
        pool_size=5,
        max_overflow=10,
    )


class Base(DeclarativeBase):
    pass


class Project(Base):
    """
    Ledger entry for a single ConstructConnect project.

    Updated on every run — acts as both an AI-result cache and a change log.
    The `field_hash` column is the fingerprint that detects when a project
    needs to be re-qualified vs served from cache.
    """
    __tablename__ = "projects"

    project_id        = Column(String, primary_key=True)
    title             = Column(String)
    first_seen        = Column(DateTime)
    last_seen         = Column(DateTime)
    last_run_id       = Column(String)          # soft FK → runs.id
    last_status       = Column(String)
    last_score        = Column(Float)
    field_hash        = Column(String)          # MD5 of mutable key fields
    qualifies         = Column(Boolean, default=False)

    # Alert for the most recent run
    alert             = Column(String)          # "new" | "status_changed" | "updated" | null
    alert_detail      = Column(String)          # e.g. "GC Bidding → Award"

    # AI qualification confidence (0-100 scale of AI's self-reported certainty)
    confidence_score  = Column(Float)

    # JSON columns (stored as text, SQLite has no native JSON type)
    status_history    = Column(Text)            # [{date, from, to}, ...]
    last_ai_result    = Column(Text)            # cached qualification JSON
    last_score_result = Column(Text)            # cached score JSON

    # ── Convenience deserializers ─────────────────────────────────────────
    def get_status_history(self) -> list:
        return json.loads(self.status_history or "[]")

    def get_ai_result(self) -> dict:
        return json.loads(self.last_ai_result or "{}")

    def get_score_result(self) -> dict:
        return json.loads(self.last_score_result or "{}")


class Run(Base):
    """One row per pipeline execution — replaces ui/data/manifest.json."""
    __tablename__ = "runs"

    id        = Column(String, primary_key=True)  # "20260605_120000"
    run_at    = Column(DateTime)
    states    = Column(Text)                       # JSON list e.g. ["UT"]
    days_back = Column(Integer)
    ingested  = Column(Integer)
    filtered  = Column(Integer)
    qualified = Column(Integer)
    surfaced  = Column(Integer)


class Lead(Base):
    """
    One qualified lead per (run, project) pair.

    Allows the future API to answer:
      GET /runs/{run_id}/leads
      GET /projects/{id}/history
      GET /leads?alert=status_changed&since=2026-06-01
    """
    __tablename__ = "leads"

    id                = Column(Integer, primary_key=True, autoincrement=True)
    run_id            = Column(String, index=True)   # soft FK → runs.id
    project_id        = Column(String, index=True)   # soft FK → projects.project_id
    rank              = Column(Integer)
    score             = Column(Float)
    alert             = Column(String)
    alert_detail      = Column(String)
    ai_result         = Column(Text)                 # JSON
    score_result      = Column(Text)                 # JSON
    narrative_summary = Column(Text)
    project_snapshot  = Column(Text)                 # full raw project JSON at pipeline run time


class DodgeUpload(Base):
    """
    Registry of Dodge Excel files stored in cloud object storage.

    The pipeline checks this table for a file whose file_date matches
    today's date. If found, it downloads from storage and runs Dodge ingest.
    file_date is stored as YYYY-MM-DD string for simple equality queries.
    """
    __tablename__ = "dodge_uploads"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    file_date   = Column(String, index=True)   # "YYYY-MM-DD" — date this export covers
    uploaded_at = Column(DateTime)             # when the record was created
    storage_key = Column(String)               # key/path inside the bucket
    filename    = Column(String)               # original filename at upload time


class CustomerImport(Base):
    """
    Registry of uploaded customer CSV files.

    Each import stores a summary plus a short preview payload for the settings UI.
    Full contact rows live in customer_contacts.
    """
    __tablename__ = "customer_imports"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    uploaded_at  = Column(DateTime)
    storage_key  = Column(String)
    filename     = Column(String)
    total_rows   = Column(Integer)
    created_rows = Column(Integer)
    updated_rows = Column(Integer)
    review_rows  = Column(Integer)
    skipped_rows = Column(Integer)
    preview_rows = Column(Text)                # JSON list of parsed row previews


class CustomerContact(Base):
    """
    Customer/contact record imported from a TrashLab customer export.

    The sample export is contact-oriented, so company and contact fields are kept
    together until a fuller CRM integration separates accounts from people.
    """
    __tablename__ = "customer_contacts"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    import_id      = Column(Integer, index=True)
    imported_at    = Column(DateTime)
    email          = Column(String, index=True)
    first_name     = Column(String)
    last_name      = Column(String)
    company        = Column(String, index=True)
    phone          = Column(String)
    address        = Column(String)
    address_2      = Column(String)
    city           = Column(String)
    state_province = Column(String)
    postal_code    = Column(String)
    country        = Column(String)
    tags           = Column(String)
    source_status  = Column(String)


def get_db() -> Session:
    """Return a new SQLAlchemy 2.0 Session. Use as a context manager."""
    return Session(ENGINE)
