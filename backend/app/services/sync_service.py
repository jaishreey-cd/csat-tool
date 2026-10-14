import os
import io
import csv
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
import openpyxl

from app.core.config import settings
from app.models.client import Client
from app.models.project import Project
from app.models.import_batch import ImportBatch
from app.models.import_change import ImportChange
from app.schemas.data_sync import (
    RowError,
    InFileDuplicate,
    FieldChange,
    EntityDiff,
    DiffCategory,
    DiffSummary,
    PreviewResponse,
    ConfirmResponse,
    ImportBatchItem,
    RollbackResponse,
)

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

REQUIRED_COLUMNS = ["client_code", "client_name", "project_code", "project_name"]
OPTIONAL_COLUMNS = ["team_name"]

COLUMN_ALIASES = {
    "client_code": ["client_code", "client_id"],
    "client_name": ["client_name"],
    "project_code": ["project_code", "project_id"],
    "project_name": ["project_name"],
    "team_name": ["team_name", "department_name"],
}

def normalize_header(header: str) -> str:
    """Normalize column header: lowercase, strip, replace spaces/dashes with underscores."""
    if not header:
        return ""
    h = str(header).strip().lower()
    return h.replace(" ", "_").replace("-", "_")

def parse_file(file_bytes: bytes, filename: str) -> Tuple[List[Dict[str, str]], List[RowError], List[InFileDuplicate]]:
    """
    Parse uploaded .csv or .xlsx file bytes into normalized row dictionaries.
    Validates headers case-insensitively, trims whitespace, catches blank required fields,
    and detects in-file duplicates on project_code.
    Supports standard columns as well as Projects_Overview_Report.csv column aliases.
    """
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum allowed limit of 5 MB."
        )

    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".csv", ".xlsx"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Only .csv and .xlsx files are accepted."
        )

    raw_rows: List[Dict[str, str]] = []

    if ext == ".csv":
        # Attempt decoding with utf-8-sig (BOM support), then utf-8, then latin-1
        text = None
        for encoding in ["utf-8-sig", "utf-8", "latin-1"]:
            try:
                text = file_bytes.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        if text is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to decode CSV file. Please ensure it is saved in UTF-8 format."
            )
        reader = csv.reader(io.StringIO(text))
        rows_list = list(reader)
        if not rows_list:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty."
            )
        headers = [normalize_header(h) for h in rows_list[0]]
        for r in rows_list[1:]:
            if not any(cell.strip() for cell in r if cell):
                continue  # skip completely blank lines
            row_dict = {}
            for idx, h in enumerate(headers):
                val = r[idx].strip() if idx < len(r) and r[idx] else ""
                row_dict[h] = val
            raw_rows.append(row_dict)

    else:  # .xlsx
        try:
            wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
            sheet = wb.active
            rows_iter = sheet.iter_rows(values_only=True)
            header_row = next(rows_iter, None)
            if not header_row:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Uploaded Excel workbook is empty."
                )
            headers = [normalize_header(h) for h in header_row]
            for r in rows_iter:
                if not any(cell is not None and str(cell).strip() for cell in r):
                    continue
                row_dict = {}
                for idx, h in enumerate(headers):
                    val = str(r[idx]).strip() if idx < len(r) and r[idx] is not None else ""
                    row_dict[h] = val
                raw_rows.append(row_dict)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to parse Excel file: {str(e)}"
            )

    # Map headers to target canonical columns using aliases
    col_map: Dict[str, str] = {}
    for target_col, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            norm_alias = normalize_header(alias)
            if norm_alias in headers:
                col_map[target_col] = norm_alias
                break

    # Validate required columns
    missing_cols = [c for c in REQUIRED_COLUMNS if c not in col_map]
    if missing_cols:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Missing required columns: {', '.join(missing_cols)}. "
                f"Expected columns: {', '.join(REQUIRED_COLUMNS)}."
            )
        )

    # Validate row by row
    errors: List[RowError] = []
    in_file_duplicates: List[InFileDuplicate] = []
    valid_rows: List[Dict[str, str]] = []
    seen_project_codes: set = set()

    for idx, r in enumerate(raw_rows, start=2):  # Row 2 is first data row
        row_has_error = False

        c_code_key = col_map["client_code"]
        c_name_key = col_map["client_name"]
        p_code_key = col_map["project_code"]
        p_name_key = col_map["project_name"]
        team_key = col_map.get("team_name")

        raw_c_code = r.get(c_code_key, "").strip()
        raw_c_name = r.get(c_name_key, "").strip()
        raw_p_code = r.get(p_code_key, "").strip()
        raw_p_name = r.get(p_name_key, "").strip()
        raw_team = r.get(team_key, "").strip() if team_key else ""

        # Normalize internal/product projects where client is N/A or empty
        if not raw_c_code or raw_c_code.upper() == "N/A":
            partner = r.get("partner_name", "").strip() or "Cloud Destinations"
            ptype = r.get("type", "").strip() or "Internal"
            raw_c_code = "CL-INTERNAL"
            if not raw_c_name or raw_c_name.upper() == "N/A":
                raw_c_name = f"{partner} ({ptype})"
        elif not raw_c_name or raw_c_name.upper() == "N/A":
            raw_c_name = raw_c_code

        if not raw_team or raw_team.upper() == "N/A":
            raw_team = r.get("type", "").strip() or ""

        # Validate required fields
        if not raw_c_code:
            errors.append(RowError(row=idx, field="client_code", message=f"Row {idx}: Required field 'client_code' is missing or blank."))
            row_has_error = True
        if not raw_c_name:
            errors.append(RowError(row=idx, field="client_name", message=f"Row {idx}: Required field 'client_name' is missing or blank."))
            row_has_error = True
        if not raw_p_code:
            errors.append(RowError(row=idx, field="project_code", message=f"Row {idx}: Required field 'project_code' is missing or blank."))
            row_has_error = True
        if not raw_p_name:
            errors.append(RowError(row=idx, field="project_name", message=f"Row {idx}: Required field 'project_name' is missing or blank."))
            row_has_error = True

        if row_has_error:
            continue

        p_code = raw_p_code
        if p_code.upper() in seen_project_codes:
            in_file_duplicates.append(
                InFileDuplicate(
                    row=idx,
                    project_code=p_code,
                    message=f"Row {idx}: Duplicate project_code '{p_code}' found in file. Keeping first occurrence."
                )
            )
            continue  # keep the first, skip duplicate rows from valid dataset

        seen_project_codes.add(p_code.upper())
        valid_rows.append({
            "client_code": raw_c_code,
            "client_name": raw_c_name,
            "project_code": p_code,
            "project_name": raw_p_name,
            "team_name": raw_team or None,
            "_row_number": idx
        })

    return valid_rows, errors, in_file_duplicates

def compute_diffs(db: Session, valid_rows: List[Dict[str, str]], mode: str) -> DiffSummary:
    """
    Compute diff summary comparing valid rows against existing DB state without modifying anything.
    Identifies: new, updated (with field changes), unchanged, reactivated, and would_be_archived.
    """
    diff = DiffSummary()

    # Pre-load existing records from DB
    existing_clients: Dict[str, Client] = {
        c.client_code.upper(): c for c in db.query(Client).all()
    }
    existing_projects: Dict[str, Project] = {
        p.project_code.upper(): p for p in db.query(Project).all()
    }

    # Track distinct client definitions present in the file
    file_clients: Dict[str, str] = {}
    for r in valid_rows:
        c_code = r["client_code"]
        c_name = r["client_name"]
        file_clients[c_code.upper()] = c_name

    # 1. Compare Clients
    processed_clients: set = set()
    for c_code_upper, c_name in file_clients.items():
        processed_clients.add(c_code_upper)
        client = existing_clients.get(c_code_upper)
        if not client:
            diff.new_clients.items.append(
                EntityDiff(
                    entity_type="client",
                    entity_code=c_code_upper,
                    name=c_name,
                    changes=[]
                )
            )
            diff.new_clients.count += 1
        elif not client.is_active:
            diff.reactivated_clients.items.append(
                EntityDiff(
                    entity_type="client",
                    entity_code=client.client_code,
                    name=c_name,
                    changes=[
                        FieldChange(field="is_active", old_value="false (archived)", new_value="true"),
                        *(
                            [FieldChange(field="name", old_value=client.name, new_value=c_name)]
                            if client.name != c_name else []
                        )
                    ]
                )
            )
            diff.reactivated_clients.count += 1
        elif client.name != c_name:
            diff.updated_clients.items.append(
                EntityDiff(
                    entity_type="client",
                    entity_code=client.client_code,
                    name=c_name,
                    changes=[FieldChange(field="name", old_value=client.name, new_value=c_name)]
                )
            )
            diff.updated_clients.count += 1
        else:
            diff.unchanged_clients += 1

    # In full_sync mode, clients currently active but missing from file would be archived
    if mode == "full_sync":
        for c_code_upper, client in existing_clients.items():
            if client.is_active and c_code_upper not in processed_clients:
                diff.would_be_archived_clients.items.append(
                    EntityDiff(
                        entity_type="client",
                        entity_code=client.client_code,
                        name=client.name,
                        changes=[FieldChange(field="is_active", old_value="true", new_value="false (archived)")]
                    )
                )
                diff.would_be_archived_clients.count += 1

    # 2. Compare Projects
    processed_projects: set = set()
    for r in valid_rows:
        p_code = r["project_code"]
        p_code_upper = p_code.upper()
        p_name = r["project_name"]
        c_code = r["client_code"]
        team_name = r["team_name"]
        processed_projects.add(p_code_upper)

        proj = existing_projects.get(p_code_upper)
        if not proj:
            diff.new_projects.items.append(
                EntityDiff(
                    entity_type="project",
                    entity_code=p_code,
                    name=p_name,
                    changes=[]
                )
            )
            diff.new_projects.count += 1
        else:
            changes: List[FieldChange] = []
            if proj.name != p_name:
                changes.append(FieldChange(field="name", old_value=proj.name, new_value=p_name))
            if (proj.client and proj.client.client_code.upper() != c_code.upper()):
                changes.append(
                    FieldChange(
                        field="client_code",
                        old_value=proj.client.client_code if proj.client else "—",
                        new_value=c_code
                    )
                )
            if (proj.team_name or None) != (team_name or None):
                changes.append(
                    FieldChange(
                        field="team_name",
                        old_value=proj.team_name or "—",
                        new_value=team_name or "—"
                    )
                )

            if not proj.is_active:
                changes.insert(0, FieldChange(field="is_active", old_value="false (archived)", new_value="true"))
                diff.reactivated_projects.items.append(
                    EntityDiff(
                        entity_type="project",
                        entity_code=proj.project_code,
                        name=p_name,
                        changes=changes
                    )
                )
                diff.reactivated_projects.count += 1
            elif changes:
                diff.updated_projects.items.append(
                    EntityDiff(
                        entity_type="project",
                        entity_code=proj.project_code,
                        name=p_name,
                        changes=changes
                    )
                )
                diff.updated_projects.count += 1
            else:
                diff.unchanged_projects += 1

    # In full_sync mode, active projects in DB missing from file would be archived
    if mode == "full_sync":
        for p_code_upper, proj in existing_projects.items():
            if proj.is_active and p_code_upper not in processed_projects:
                diff.would_be_archived_projects.items.append(
                    EntityDiff(
                        entity_type="project",
                        entity_code=proj.project_code,
                        name=proj.name,
                        changes=[FieldChange(field="is_active", old_value="true", new_value="false (archived)")]
                    )
                )
                diff.would_be_archived_projects.count += 1

    return diff

def preview_sync(db: Session, file_bytes: bytes, filename: str, mode: str) -> PreviewResponse:
    """Parse and calculate diff preview without writing to the database."""
    valid_rows, errors, duplicates = parse_file(file_bytes, filename)
    diff = compute_diffs(db, valid_rows, mode)
    can_confirm = len(errors) == 0

    return PreviewResponse(
        filename=filename,
        mode=mode,
        total_rows=len(valid_rows) + len(errors) + len(duplicates),
        valid_rows=len(valid_rows),
        errors=errors,
        in_file_duplicates=duplicates,
        diff_summary=diff,
        can_confirm=can_confirm
    )

def confirm_sync(
    db: Session,
    file_bytes: bytes,
    filename: str,
    mode: str,
    user_id: int
) -> ConfirmResponse:
    """
    Re-validate and apply the data merge inside ONE single atomic transaction.
    Rolls back fully on any failure.
    Records ImportBatch and ImportChange audit entries.
    Saves file to UPLOAD_DIR.
    """
    valid_rows, errors, duplicates = parse_file(file_bytes, filename)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot confirm sync: {len(errors)} validation errors detected in file."
        )

    # Save original file to UPLOAD_DIR for audit
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    saved_filename = f"{uuid.uuid4().hex}_{filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, saved_filename)
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    now = datetime.now(timezone.utc)

    # Begin transaction block
    batch = ImportBatch(
        filename=filename,
        file_path=file_path,
        mode=mode,
        uploaded_by=user_id,
        uploaded_at=now,
        status="applied",
        duplicates_skipped=len(duplicates)
    )
    db.add(batch)
    db.flush()  # assign batch.id

    # Track metrics
    clients_created = 0
    clients_updated = 0
    clients_archived = 0
    clients_reactivated = 0
    projects_created = 0
    projects_updated = 0
    projects_archived = 0
    projects_reactivated = 0
    unchanged_count = 0

    # 1. Process Clients
    existing_clients: Dict[str, Client] = {
        c.client_code.upper(): c for c in db.query(Client).all()
    }

    file_clients: Dict[str, str] = {}
    for r in valid_rows:
        file_clients[r["client_code"].upper()] = r["client_name"]

    processed_clients: set = set()
    for c_code_upper, c_name in file_clients.items():
        processed_clients.add(c_code_upper)
        client = existing_clients.get(c_code_upper)

        if not client:
            # Create new client
            client = Client(
                client_code=c_code_upper,
                name=c_name,
                is_active=True,
                created_at=now,
                updated_at=now
            )
            db.add(client)
            db.flush()
            existing_clients[c_code_upper] = client
            clients_created += 1

            db.add(ImportChange(
                batch_id=batch.id,
                entity_type="client",
                entity_id=client.id,
                entity_code=client.client_code,
                action="created",
                old_values=None,
                new_values={"client_code": client.client_code, "name": client.name, "is_active": True}
            ))

        else:
            old_name = client.name
            old_active = client.is_active
            old_archived_at = client.archived_at.isoformat() if client.archived_at else None

            if not old_active:
                # Reactivate client
                client.is_active = True
                client.archived_at = None
                client.name = c_name
                client.updated_at = now
                clients_reactivated += 1

                db.add(ImportChange(
                    batch_id=batch.id,
                    entity_type="client",
                    entity_id=client.id,
                    entity_code=client.client_code,
                    action="reactivated",
                    old_values={"is_active": False, "archived_at": old_archived_at, "name": old_name},
                    new_values={"is_active": True, "archived_at": None, "name": c_name}
                ))

            elif old_name != c_name:
                # Update client name
                client.name = c_name
                client.updated_at = now
                clients_updated += 1

                db.add(ImportChange(
                    batch_id=batch.id,
                    entity_type="client",
                    entity_id=client.id,
                    entity_code=client.client_code,
                    action="updated",
                    old_values={"name": old_name},
                    new_values={"name": c_name}
                ))
            else:
                unchanged_count += 1

    # Mode full_sync: archive active clients not in file
    if mode == "full_sync":
        for c_code_upper, client in existing_clients.items():
            if client.is_active and c_code_upper not in processed_clients:
                client.is_active = False
                client.archived_at = now
                client.updated_at = now
                clients_archived += 1

                db.add(ImportChange(
                    batch_id=batch.id,
                    entity_type="client",
                    entity_id=client.id,
                    entity_code=client.client_code,
                    action="archived",
                    old_values={"is_active": True, "archived_at": None},
                    new_values={"is_active": False, "archived_at": now.isoformat()}
                ))

    # 2. Process Projects
    existing_projects: Dict[str, Project] = {
        p.project_code.upper(): p for p in db.query(Project).all()
    }

    processed_projects: set = set()
    for r in valid_rows:
        p_code = r["project_code"]
        p_code_upper = p_code.upper()
        p_name = r["project_name"]
        c_code_upper = r["client_code"].upper()
        team_name = r["team_name"]
        processed_projects.add(p_code_upper)

        target_client = existing_clients[c_code_upper]
        proj = existing_projects.get(p_code_upper)

        if not proj:
            # Create project
            proj = Project(
                project_code=p_code,
                name=p_name,
                client_id=target_client.id,
                team_name=team_name,
                is_active=True,
                created_at=now,
                updated_at=now
            )
            db.add(proj)
            db.flush()
            existing_projects[p_code_upper] = proj
            projects_created += 1

            db.add(ImportChange(
                batch_id=batch.id,
                entity_type="project",
                entity_id=proj.id,
                entity_code=proj.project_code,
                action="created",
                old_values=None,
                new_values={
                    "project_code": proj.project_code,
                    "name": proj.name,
                    "client_id": target_client.id,
                    "client_code": target_client.client_code,
                    "team_name": team_name,
                    "is_active": True
                }
            ))

        else:
            old_name = proj.name
            old_client_id = proj.client_id
            old_client_code = proj.client.client_code if proj.client else None
            old_team_name = proj.team_name
            old_active = proj.is_active
            old_archived_at = proj.archived_at.isoformat() if proj.archived_at else None

            changed = (
                old_name != p_name or
                old_client_id != target_client.id or
                (old_team_name or None) != (team_name or None)
            )

            if not old_active:
                # Reactivate project
                proj.is_active = True
                proj.archived_at = None
                proj.name = p_name
                proj.client_id = target_client.id
                proj.team_name = team_name
                proj.updated_at = now
                projects_reactivated += 1

                db.add(ImportChange(
                    batch_id=batch.id,
                    entity_type="project",
                    entity_id=proj.id,
                    entity_code=proj.project_code,
                    action="reactivated",
                    old_values={
                        "is_active": False,
                        "archived_at": old_archived_at,
                        "name": old_name,
                        "client_id": old_client_id,
                        "client_code": old_client_code,
                        "team_name": old_team_name
                    },
                    new_values={
                        "is_active": True,
                        "archived_at": None,
                        "name": p_name,
                        "client_id": target_client.id,
                        "client_code": target_client.client_code,
                        "team_name": team_name
                    }
                ))

            elif changed:
                # Update project
                proj.name = p_name
                proj.client_id = target_client.id
                proj.team_name = team_name
                proj.updated_at = now
                projects_updated += 1

                db.add(ImportChange(
                    batch_id=batch.id,
                    entity_type="project",
                    entity_id=proj.id,
                    entity_code=proj.project_code,
                    action="updated",
                    old_values={
                        "name": old_name,
                        "client_id": old_client_id,
                        "client_code": old_client_code,
                        "team_name": old_team_name
                    },
                    new_values={
                        "name": p_name,
                        "client_id": target_client.id,
                        "client_code": target_client.client_code,
                        "team_name": team_name
                    }
                ))
            else:
                unchanged_count += 1

    # Mode full_sync: archive active projects not in file
    if mode == "full_sync":
        for p_code_upper, proj in existing_projects.items():
            if proj.is_active and p_code_upper not in processed_projects:
                proj.is_active = False
                proj.archived_at = now
                proj.updated_at = now
                projects_archived += 1

                db.add(ImportChange(
                    batch_id=batch.id,
                    entity_type="project",
                    entity_id=proj.id,
                    entity_code=proj.project_code,
                    action="archived",
                    old_values={"is_active": True, "archived_at": None},
                    new_values={"is_active": False, "archived_at": now.isoformat()}
                ))

    # Update Batch record totals
    batch.clients_created = clients_created
    batch.clients_updated = clients_updated
    batch.clients_archived = clients_archived
    batch.clients_reactivated = clients_reactivated
    batch.projects_created = projects_created
    batch.projects_updated = projects_updated
    batch.projects_archived = projects_archived
    batch.projects_reactivated = projects_reactivated
    batch.unchanged = unchanged_count

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database commit error during sync: {str(e)}"
        )

    return ConfirmResponse(
        batch_id=batch.id,
        mode=batch.mode,
        status=batch.status,
        clients_created=clients_created,
        clients_updated=clients_updated,
        clients_archived=clients_archived,
        clients_reactivated=clients_reactivated,
        projects_created=projects_created,
        projects_updated=projects_updated,
        projects_archived=projects_archived,
        projects_reactivated=projects_reactivated,
        unchanged=unchanged_count,
        duplicates_skipped=len(duplicates),
        clients_data_last_updated=batch.uploaded_at,
        message=(
            f"Sync applied successfully in {mode} mode: "
            f"{projects_created} projects created, {projects_updated} updated, "
            f"{clients_created} clients created, {clients_updated} updated."
        )
    )

def list_imports(db: Session) -> List[ImportBatchItem]:
    """Get import history newest first with counts, user, and time."""
    batches = db.query(ImportBatch).order_by(desc(ImportBatch.uploaded_at)).all()
    results = []
    for b in batches:
        results.append(ImportBatchItem(
            id=b.id,
            filename=b.filename,
            mode=b.mode,
            status=b.status,
            uploaded_at=b.uploaded_at,
            uploaded_by_email=b.user.email if b.user else None,
            clients_created=b.clients_created,
            clients_updated=b.clients_updated,
            clients_archived=b.clients_archived,
            clients_reactivated=b.clients_reactivated,
            projects_created=b.projects_created,
            projects_updated=b.projects_updated,
            projects_archived=b.projects_archived,
            projects_reactivated=b.projects_reactivated,
            unchanged=b.unchanged,
            duplicates_skipped=b.duplicates_skipped
        ))
    return results

def rollback_latest_batch(db: Session, batch_id: int) -> RollbackResponse:
    """
    Rollback import changes.
    Allowed ONLY for the most recent applied batch. Returns 409 if not latest applied.
    Reverts every ImportChange (restore old_values, un-archive, or soft-archive records created by that batch).
    STRICTLY NEVER hard deletes any client or project.
    """
    latest_applied = (
        db.query(ImportBatch)
        .filter(ImportBatch.status == "applied")
        .order_by(desc(ImportBatch.uploaded_at))
        .first()
    )

    if not latest_applied or latest_applied.id != batch_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Rollback is only allowed for the most recent applied import batch."
        )

    # Revert each change in reverse chronological order
    changes = (
        db.query(ImportChange)
        .filter(ImportChange.batch_id == batch_id)
        .order_by(desc(ImportChange.id))
        .all()
    )

    now = datetime.now(timezone.utc)

    for ch in changes:
        if ch.entity_type == "client":
            client = db.query(Client).filter(Client.id == ch.entity_id).first()
            if not client:
                continue

            if ch.action == "created":
                # Created records are SOFT ARCHIVED on rollback, NEVER deleted
                client.is_active = False
                client.archived_at = now
                client.updated_at = now

            elif ch.action == "updated":
                old_val = ch.old_values or {}
                if "name" in old_val:
                    client.name = old_val["name"]
                client.updated_at = now

            elif ch.action == "archived":
                # Restore to active
                client.is_active = True
                client.archived_at = None
                client.updated_at = now

            elif ch.action == "reactivated":
                # Re-archive
                client.is_active = False
                old_val = ch.old_values or {}
                archived_at_str = old_val.get("archived_at")
                if archived_at_str:
                    try:
                        client.archived_at = datetime.fromisoformat(archived_at_str)
                    except Exception:
                        client.archived_at = now
                else:
                    client.archived_at = now
                client.updated_at = now

        elif ch.entity_type == "project":
            proj = db.query(Project).filter(Project.id == ch.entity_id).first()
            if not proj:
                continue

            if ch.action == "created":
                # Created records are SOFT ARCHIVED, NEVER hard deleted
                proj.is_active = False
                proj.archived_at = now
                proj.updated_at = now

            elif ch.action == "updated":
                old_val = ch.old_values or {}
                if "name" in old_val:
                    proj.name = old_val["name"]
                if "client_id" in old_val:
                    proj.client_id = old_val["client_id"]
                if "team_name" in old_val:
                    proj.team_name = old_val["team_name"]
                proj.updated_at = now

            elif ch.action == "archived":
                # Restore to active
                proj.is_active = True
                proj.archived_at = None
                proj.updated_at = now

            elif ch.action == "reactivated":
                # Re-archive
                proj.is_active = False
                old_val = ch.old_values or {}
                archived_at_str = old_val.get("archived_at")
                if archived_at_str:
                    try:
                        proj.archived_at = datetime.fromisoformat(archived_at_str)
                    except Exception:
                        proj.archived_at = now
                else:
                    proj.archived_at = now
                proj.updated_at = now

    latest_applied.status = "rolled_back"
    db.commit()

    # Find new latest applied batch for timestamp
    new_latest = (
        db.query(ImportBatch)
        .filter(ImportBatch.status == "applied")
        .order_by(desc(ImportBatch.uploaded_at))
        .first()
    )
    new_timestamp = new_latest.uploaded_at if new_latest else None

    return RollbackResponse(
        batch_id=batch_id,
        status="rolled_back",
        message=f"Import batch #{batch_id} successfully rolled back. No records were deleted.",
        clients_data_last_updated=new_timestamp
    )
