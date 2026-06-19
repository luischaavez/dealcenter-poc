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
import csv
import zipfile
from datetime import datetime
from io import BytesIO, StringIO
from typing import Optional, Tuple

from database import (
    get_db,
    Project,
    Run,
    Lead,
    DodgeUpload,
    CustomerImport,
    CustomerContact,
)


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

            # confidence_score: store AI's self-reported qualification certainty (0-100 scale)
            ai_conf = round(float(ai_result.get("qualification_confidence") or 0.5) * 100, 1)

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
                confidence_score  = ai_conf,
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

            ai_conf = round(float(ai_result.get("qualification_confidence") or 0.5) * 100, 1)

            existing.title             = project.get("title", existing.title)
            existing.last_seen         = now
            existing.last_run_id       = run_id
            existing.last_status       = new_status
            existing.last_score        = score_result.get("final_score")
            existing.field_hash        = new_hash
            existing.qualifies         = bool(ai_result.get("qualifies"))
            existing.alert             = alert
            existing.alert_detail      = alert_detail
            existing.confidence_score  = ai_conf
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


def get_todays_dodge_upload(date_str: Optional[str] = None) -> Optional[DodgeUpload]:
    """Return the DodgeUpload for today (or date_str as YYYY-MM-DD), or None."""
    target = date_str or datetime.utcnow().strftime("%Y-%m-%d")
    with get_db() as session:
        return (
            session.query(DodgeUpload)
            .filter(DodgeUpload.file_date == target)
            .order_by(DodgeUpload.id.desc())
            .first()
        )


def register_dodge_upload(storage_key: str, filename: str, file_date: Optional[str] = None) -> DodgeUpload:
    """Insert a DodgeUpload record and return it."""
    record = DodgeUpload(
        file_date   = file_date or datetime.utcnow().strftime("%Y-%m-%d"),
        uploaded_at = datetime.utcnow(),
        storage_key = storage_key,
        filename    = filename,
    )
    with get_db() as session:
        session.add(record)
        session.commit()
        session.refresh(record)
        return record


# ── Customer imports ──────────────────────────────────────────────────────────

_CUSTOMER_COLUMNS = {
    "email": ("email address", "email", "e-mail", "e-mail address"),
    "first_name": ("first name", "firstname", "first"),
    "last_name": ("last name", "lastname", "last"),
    "company": ("company", "company name", "customer", "customer name", "account", "account name"),
    "phone": ("phone number", "phone", "mobile", "telephone"),
    "address": ("address", "street address", "address 1"),
    "address_2": ("address 2", "address2", "suite", "unit"),
    "city": ("city",),
    "state_province": ("state/province", "state", "province", "state province"),
    "postal_code": ("postal code", "postal", "zip", "zip code"),
    "country": ("country",),
    "tags": ("tags", "tag"),
}


def _clean_cell(value: object) -> str:
    return str(value or "").strip()


def _normalized_email(row: dict) -> str:
    return _clean_cell(row.get("email")).lower()


def _normalized_company(row: dict) -> str:
    return " ".join(_clean_cell(row.get("company")).lower().split())


def _normalized_header(value: object) -> str:
    text = _clean_cell(value).lstrip("\ufeff").lower()
    return " ".join(text.replace("_", " ").split())


def _header_map(fieldnames: list[str]) -> dict[str, str]:
    normalized = {_normalized_header(name): name for name in fieldnames if name}
    mapped = {}
    for key, aliases in _CUSTOMER_COLUMNS.items():
        for alias in aliases:
            if alias in normalized:
                mapped[key] = normalized[alias]
                break
    return mapped


def _looks_like_header(line: str) -> bool:
    normalized = _normalized_header(line)
    matches = 0
    for aliases in _CUSTOMER_COLUMNS.values():
        if any(alias in normalized for alias in aliases):
            matches += 1
    return matches >= 2


def _trim_to_header(text: str) -> tuple[str, str | None]:
    lines = text.splitlines()
    delimiter_hint = None
    start = 0

    for index, line in enumerate(lines[:50]):
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.lower().startswith("sep=") and len(stripped) >= 5:
            delimiter_hint = stripped[4]
            start = index + 1
            continue
        if _looks_like_header(stripped):
            start = index
            break
        if start == 0:
            start = index

    return "\n".join(lines[start:]), delimiter_hint


def _candidate_readers(content: bytes):
    if content[:2] == b"PK":
        try:
            names = set(zipfile.ZipFile(BytesIO(content)).namelist())
        except zipfile.BadZipFile:
            names = set()

        if any(name.startswith("Index/") and name.endswith(".iwa") for name in names):
            raise ValueError(
                "This file is an Apple Numbers spreadsheet, not a CSV. "
                "Open it in Numbers and export it with File > Export To > CSV."
            )
        raise ValueError(
            "This file is a zipped spreadsheet, not a CSV. Export it as a plain CSV and try again."
        )

    for encoding in ("utf-8-sig", "utf-16", "cp1252", "latin-1"):
        try:
            text = content.decode(encoding)
        except UnicodeDecodeError:
            continue

        text, delimiter_hint = _trim_to_header(text)
        delimiters = [",", ";", "\t"]
        if delimiter_hint in delimiters:
            delimiters = [delimiter_hint] + [d for d in delimiters if d != delimiter_hint]
        sample = text[:4096]
        try:
            sniffed = csv.Sniffer().sniff(sample, delimiters=",;\t").delimiter
            delimiters = [sniffed] + [d for d in delimiters if d != sniffed]
        except csv.Error:
            pass

        for delimiter in delimiters:
            reader = csv.DictReader(StringIO(text), delimiter=delimiter)
            if reader.fieldnames:
                yield encoding, reader, _header_map(reader.fieldnames)


def _parse_customer_csv(content: bytes) -> list[dict]:
    best_reader = None
    best_map = {}
    best_headers = []

    for _encoding, reader, mapped in _candidate_readers(content):
        if len(mapped) > len(best_map):
            best_reader = reader
            best_map = mapped
            best_headers = reader.fieldnames or []
        if all(key in mapped for key in ("email", "first_name", "last_name", "company")):
            best_reader = reader
            best_map = mapped
            best_headers = reader.fieldnames or []
            break

    if best_reader is None:
        raise ValueError(
            "CSV has no readable header row. Export the file as a plain CSV with a header row."
        )

    required = {
        "email": "Email Address",
        "first_name": "First Name",
        "last_name": "Last Name",
        "company": "Company",
    }
    missing = [label for key, label in required.items() if key not in best_map]
    if missing:
        available = ", ".join(best_headers[:12]) or "none"
        raise ValueError(
            f"CSV is missing required columns: {', '.join(missing)}. "
            f"Detected headers: {available}"
        )

    parsed = []
    for raw in best_reader:
        row = {
            key: _clean_cell(raw.get(best_map.get(key)))
            for key in _CUSTOMER_COLUMNS
        }
        if not any(row.values()):
            continue
        parsed.append(row)
    return parsed


def _row_status(row: dict, seen_emails: set[str], seen_companies: set[str], existing: CustomerContact | None) -> str:
    email = _normalized_email(row)
    company = _normalized_company(row)

    if not email and not company:
        return "Review"
    if email and email in seen_emails:
        return "Duplicate"
    if not email and company and company in seen_companies:
        return "Duplicate"
    if existing is not None:
        return "Updated"
    return "Created"


def _preview_row(row: dict, status: str) -> dict:
    contact = " ".join(
        part for part in (row.get("first_name"), row.get("last_name")) if part
    )
    return {
        "email": row.get("email") or "",
        "first_name": row.get("first_name") or "",
        "last_name": row.get("last_name") or "",
        "company": row.get("company") or "",
        "phone": row.get("phone") or "",
        "address": row.get("address") or "",
        "address_2": row.get("address_2") or "",
        "city": row.get("city") or "",
        "state_province": row.get("state_province") or "",
        "postal_code": row.get("postal_code") or "",
        "country": row.get("country") or "",
        "tags": row.get("tags") or "",
        "customer": row.get("company") or "Missing company",
        "contact": contact or row.get("email") or "Missing contact",
        "market": row.get("city") or row.get("state_province") or "Unknown",
        "status": status,
    }


def import_customer_csv(content: bytes, filename: str, storage_key: Optional[str] = None) -> CustomerImport:
    """
    Parse a TrashLab customer export and upsert usable customer contact rows.

    Rows with neither email nor company are kept in the import summary as Review
    but are not inserted as contacts.
    """
    rows = _parse_customer_csv(content)
    now = datetime.utcnow()
    created = 0
    updated = 0
    review = 0
    skipped = 0
    preview = []
    seen_emails: set[str] = set()
    seen_companies: set[str] = set()

    with get_db() as session:
        record = CustomerImport(
            uploaded_at=now,
            storage_key=storage_key,
            filename=filename,
            total_rows=len(rows),
            created_rows=0,
            updated_rows=0,
            review_rows=0,
            skipped_rows=0,
            preview_rows="[]",
        )
        session.add(record)
        session.flush()

        for row in rows:
            email = _normalized_email(row)
            company = _normalized_company(row)
            existing = None
            if email:
                existing = (
                    session.query(CustomerContact)
                    .filter(CustomerContact.email == email)
                    .order_by(CustomerContact.id.desc())
                    .first()
                )
            elif company:
                existing = (
                    session.query(CustomerContact)
                    .filter(CustomerContact.company == row.get("company"))
                    .order_by(CustomerContact.id.desc())
                    .first()
                )

            status = _row_status(row, seen_emails, seen_companies, existing)
            preview.append(_preview_row(row, status))

            if status == "Review":
                review += 1
            elif status == "Duplicate":
                skipped += 1
            elif existing is not None:
                existing.import_id = record.id
                existing.imported_at = now
                existing.email = email or None
                existing.first_name = row.get("first_name")
                existing.last_name = row.get("last_name")
                existing.company = row.get("company")
                existing.phone = row.get("phone")
                existing.address = row.get("address")
                existing.address_2 = row.get("address_2")
                existing.city = row.get("city")
                existing.state_province = row.get("state_province")
                existing.postal_code = row.get("postal_code")
                existing.country = row.get("country")
                existing.tags = row.get("tags")
                existing.source_status = status
                updated += 1
            else:
                session.add(CustomerContact(
                    import_id=record.id,
                    imported_at=now,
                    email=email or None,
                    first_name=row.get("first_name"),
                    last_name=row.get("last_name"),
                    company=row.get("company"),
                    phone=row.get("phone"),
                    address=row.get("address"),
                    address_2=row.get("address_2"),
                    city=row.get("city"),
                    state_province=row.get("state_province"),
                    postal_code=row.get("postal_code"),
                    country=row.get("country"),
                    tags=row.get("tags"),
                    source_status=status,
                ))
                created += 1

            if email:
                seen_emails.add(email)
            if company:
                seen_companies.add(company)

        record.created_rows = created
        record.updated_rows = updated
        record.review_rows = review
        record.skipped_rows = skipped
        record.preview_rows = json.dumps(preview[:25])
        session.commit()
        session.refresh(record)
        return record
