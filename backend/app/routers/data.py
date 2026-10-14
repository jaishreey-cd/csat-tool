import io
import csv
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status, UploadFile, File, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
import openpyxl

from app.database import get_db
from app.models import Client, Project, User
from app.schemas import ClientResponse, ProjectResponse, OverviewStats
from app.auth import get_current_user, require_role

router = APIRouter(prefix="/data", tags=["Utiliza Data"])

@router.get("/stats", response_model=OverviewStats)
def get_overview_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get system summary metrics of loaded Utiliza clients and projects."""
    total_clients = db.query(Client).count()
    total_projects = db.query(Project).count()
    in_progress_projects = db.query(Project).filter(Project.status.ilike("%In Progress%")).count()
    completed_projects = db.query(Project).filter(Project.status.ilike("%Completed%")).count()
    on_hold_projects = db.query(Project).filter(Project.status.ilike("%Hold%")).count()
    total_users = db.query(User).count()

    return OverviewStats(
        total_clients=total_clients,
        total_projects=total_projects,
        in_progress_projects=in_progress_projects,
        completed_projects=completed_projects,
        on_hold_projects=on_hold_projects,
        total_users=total_users
    )

@router.get("/clients", response_model=List[ClientResponse])
def get_all_clients(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all clients imported from Utiliza with optimized project metrics."""
    clients = db.query(Client).order_by(Client.client_name.asc()).all()
    
    # Pre-aggregate projects by client_id in a single database pass
    all_projects = db.query(Project.client_id, Project.status).all()
    project_stats = {}
    for pid, pstatus in all_projects:
        if not pid:
            continue
        if pid not in project_stats:
            project_stats[pid] = {"total": 0, "active": 0, "completed": 0}
        project_stats[pid]["total"] += 1
        st = (pstatus or "").lower()
        if "progress" in st:
            project_stats[pid]["active"] += 1
        elif "complete" in st or "done" in st:
            project_stats[pid]["completed"] += 1

    results = []
    for client in clients:
        c_stats = project_stats.get(client.client_id, {"total": 0, "active": 0, "completed": 0})
        results.append(ClientResponse(
            id=client.id,
            client_id=client.client_id,
            client_name=client.client_name,
            partner_name=client.partner_name,
            partner_id=client.partner_id,
            project_count=c_stats["total"],
            active_project_count=c_stats["active"],
            completed_project_count=c_stats["completed"]
        ))
    return results

@router.get("/clients/{client_id}/projects", response_model=List[ProjectResponse])
def get_projects_by_client(
    client_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all associated projects for a specific client."""
    projects = (
        db.query(Project)
        .filter(Project.client_id == client_id)
        .order_by(Project.project_name.asc())
        .all()
    )
    return projects

@router.get("/projects", response_model=List[ProjectResponse])
def get_all_projects(
    search: Optional[str] = Query(None, description="Search by project name, ID, or client"),
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    client_id: Optional[str] = Query(None, description="Filter by client ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all projects imported from Utiliza, with optional search and filter."""
    query = db.query(Project)
    if client_id:
        query = query.filter(Project.client_id == client_id)
    if search:
        s = f"%{search}%"
        query = query.filter(
            (Project.project_name.ilike(s)) |
            (Project.project_id.ilike(s)) |
            (Project.client_name.ilike(s)) |
            (Project.project_manager_name.ilike(s))
        )
    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(Project.status.ilike(f"%{status_filter}%"))
    
    projects = query.order_by(Project.project_id.asc()).all()
    return projects

def normalize_dict_keys(d: dict) -> dict:
    """Normalize row keys to lowercase and stripped for flexible header matching."""
    norm = {}
    for k, v in d.items():
        if k is not None:
            clean_k = str(k).strip().lower().replace(" ", "_").replace("-", "")
            norm[clean_k] = str(v if v is not None else "").strip()
    return norm

def get_row_val(row: dict, *keys: str, default: str = "") -> str:
    """Helper to extract value from row trying multiple column variations."""
    for k in keys:
        clean = k.lower().replace(" ", "_").replace("-", "")
        if clean in row and row[clean] != "":
            return row[clean]
    return default

@router.get("/template")
def download_csv_template():
    """Returns a standardized CSV template conforming to Utiliza import format."""
    headers = [
        "project_id", "project_name", "status", "sub_status", "type",
        "start_date", "end_date", "effective_start", "effective_end",
        "resource_count", "resource_names", "client_name", "partner_name",
        "billable", "client_id", "partner_id", "uuid", "department_id",
        "department_name", "skills", "project_manager_employee_id", "project_manager_name"
    ]
    sample_row_1 = [
        "CD-PR0100", "Sample Cloud Transformation", "In Progress", "SOW_SIGNED", "Client",
        "2026-10-01", "2026-12-31", "2026-10-01", "2026-12-31", "3",
        "Alice Smith, Bob Jones, John Doe", "Acme Corporation", "Global Cloud",
        "Billable", "CL-10001", "PRT-001", "", "DEPT-001",
        "Cloud Solutions", "AWS, Terraform, Kubernetes", "CD-EMP-001", "Alice Smith"
    ]
    sample_row_2 = [
        "CD-PR0101", "Enterprise CSAT Analytics", "Completed", "SOW_SIGNED", "Client",
        "2026-08-01", "2026-09-30", "2026-08-01", "2026-09-30", "2",
        "Dev Lead, QA Lead", "Globex Corp", "Cloud Destinations",
        "Billable", "CL-10002", "PRT-002", "", "DEPT-002",
        "Data Engineering", "Python, React, PostgreSQL", "CD-EMP-002", "Dev Lead"
    ]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerow(sample_row_1)
    writer.writerow(sample_row_2)
    csv_content = output.getvalue()

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=utiliza_projects_template.csv"}
    )

@router.post("/upload")
async def upload_utiliza_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload and parse Excel (.xlsx, .xls) or CSV file.
    Validates structure, saves client and project records into PostgreSQL,
    and returns detailed statistics including created, updated, and duplicates.
    """
    filename = file.filename or "unknown"
    ext = filename.lower().split(".")[-1]

    if ext not in ["csv", "xlsx", "xls"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file."
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty. Please provide a file with valid Utiliza records."
        )

    rows = []
    # ── Parse CSV ─────────────────────────────────────────────────────────────
    if ext == "csv":
        try:
            # Try utf-8-sig first, fallback to latin-1
            try:
                text = content.decode("utf-8-sig")
            except UnicodeDecodeError:
                text = content.decode("latin-1")
            
            reader = csv.DictReader(io.StringIO(text))
            for r in reader:
                norm = normalize_dict_keys(r)
                if any(norm.values()):
                    rows.append(norm)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to parse CSV file: {str(e)}"
            )

    # ── Parse Excel ───────────────────────────────────────────────────────────
    else:
        try:
            wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
            sheet = wb.active
            headers = [str(cell.value or "").strip() for cell in sheet[1]]
            for row in sheet.iter_rows(min_row=2, values_only=True):
                if not any(row):
                    continue
                row_dict = {}
                for h, val in zip(headers, row):
                    if h:
                        row_dict[h] = val
                norm = normalize_dict_keys(row_dict)
                if any(norm.values()):
                    rows.append(norm)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to parse Excel file: {str(e)}"
            )

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid data rows found in the uploaded file."
        )

    clients_created = 0
    clients_updated = 0
    projects_created = 0
    projects_updated = 0
    duplicates_count = 0
    duplicates_list = []
    errors = []

    # 1. Collect and Validate Unique Clients
    clients_dict = {}
    for idx, r in enumerate(rows, start=2):
        c_id = get_row_val(r, "client_id", "clientid", "client_code")
        c_name = get_row_val(r, "client_name", "clientname", "client", "customer")
        p_name = get_row_val(r, "partner_name", "partnername", "partner")
        p_id = get_row_val(r, "partner_id", "partnerid")

        if c_id and c_id.upper() != "N/A":
            if c_id not in clients_dict:
                clients_dict[c_id] = {
                    "client_id": c_id,
                    "client_name": c_name if c_name else f"Client {c_id}",
                    "partner_name": p_name if p_name.upper() != "N/A" else None,
                    "partner_id": p_id if p_id.upper() != "N/A" else None,
                }
        elif c_name and c_name.upper() != "N/A":
            # Generate deterministic fallback ID if client_id missing
            synthetic_id = f"CL-{abs(hash(c_name)) % 10000000000000}"
            if synthetic_id not in clients_dict:
                clients_dict[synthetic_id] = {
                    "client_id": synthetic_id,
                    "client_name": c_name,
                    "partner_name": p_name if p_name.upper() != "N/A" else None,
                    "partner_id": p_id if p_id.upper() != "N/A" else None,
                }

    # Pre-fetch existing records in batch for high performance
    existing_clients = {c.client_id: c for c in db.query(Client).all()}
    existing_projects = {p.project_id: p for p in db.query(Project).all()}

    # Upsert Clients into PostgreSQL
    for c_id, c_info in clients_dict.items():
        existing_client = existing_clients.get(c_id)
        if not existing_client:
            new_client = Client(
                client_id=c_info["client_id"],
                client_name=c_info["client_name"],
                partner_name=c_info["partner_name"],
                partner_id=c_info["partner_id"],
            )
            db.add(new_client)
            existing_clients[c_id] = new_client
            clients_created += 1
        else:
            existing_client.client_name = c_info["client_name"] or existing_client.client_name
            if c_info["partner_name"]:
                existing_client.partner_name = c_info["partner_name"]
            if c_info["partner_id"]:
                existing_client.partner_id = c_info["partner_id"]
            clients_updated += 1

    # 2. Validate and Upsert Projects into PostgreSQL
    for idx, r in enumerate(rows, start=2):
        p_id = get_row_val(r, "project_id", "projectid", "proj_id", "project_code", "id")
        p_name = get_row_val(r, "project_name", "projectname", "name", "title")

        # Row-level Validation: Mandatory Project ID
        if not p_id or p_id.upper() == "N/A":
            errors.append({
                "row": idx,
                "project_id": "MISSING",
                "message": f"Row {idx}: Mandatory 'project_id' is missing. Record skipped.",
                "severity": "error"
            })
            continue

        c_id = get_row_val(r, "client_id", "clientid", "client_code")
        c_name = get_row_val(r, "client_name", "clientname", "client", "customer")
        if not c_id or c_id.upper() == "N/A":
            c_id = None
        if not c_name or c_name.upper() == "N/A":
            c_name = None

        p_status = get_row_val(r, "status", "project_status", "state", default="Not Started")
        sub_status = get_row_val(r, "sub_status", "substatus")
        p_type = get_row_val(r, "type", "project_type")
        start_date = get_row_val(r, "start_date", "startdate")
        end_date = get_row_val(r, "end_date", "enddate")
        eff_start = get_row_val(r, "effective_start", "effectivestart")
        eff_end = get_row_val(r, "effective_end", "effectiveend")
        partner_name = get_row_val(r, "partner_name", "partnername")
        partner_id = get_row_val(r, "partner_id", "partnerid")
        billable = get_row_val(r, "billable", "billing_status")
        dept_id = get_row_val(r, "department_id", "departmentid")
        dept_name = get_row_val(r, "department_name", "departmentname", "department", "dept")
        skills = get_row_val(r, "skills", "tech_stack")
        pm_emp_id = get_row_val(r, "project_manager_employee_id", "pm_id", "pm_employee_id")
        pm_name = get_row_val(r, "project_manager_name", "pm_name", "project_manager", "manager")
        res_names = get_row_val(r, "resource_names", "resourcenames", "team_members")
        uuid_val = get_row_val(r, "uuid")

        # Resource count parsing with safe fallback
        res_raw = get_row_val(r, "resource_count", "resources", "team_size", default="0")
        try:
            res_count = int(float(res_raw)) if res_raw else 0
        except (ValueError, TypeError):
            res_count = 0
            errors.append({
                "row": idx,
                "project_id": p_id,
                "message": f"Row {idx} ('{p_id}'): Non-numeric resource count '{res_raw}', defaulted to 0.",
                "severity": "warning"
            })

        existing_proj = existing_projects.get(p_id)
        if not existing_proj:
            # Create new Project record in PostgreSQL
            new_proj = Project(
                project_id=p_id,
                project_name=p_name if p_name else f"Project {p_id}",
                status=p_status,
                sub_status=sub_status if sub_status.upper() != "N/A" else None,
                type=p_type if p_type.upper() != "N/A" else None,
                start_date=start_date if start_date.upper() != "N/A" else None,
                end_date=end_date if end_date.upper() != "N/A" else None,
                effective_start=eff_start if eff_start.upper() != "N/A" else None,
                effective_end=eff_end if eff_end.upper() != "N/A" else None,
                resource_count=res_count,
                resource_names=res_names if res_names.upper() != "N/A" else None,
                client_name=c_name,
                partner_name=partner_name if partner_name.upper() != "N/A" else None,
                billable=billable if billable.upper() != "N/A" else None,
                client_id=c_id,
                partner_id=partner_id if partner_id.upper() != "N/A" else None,
                uuid=uuid_val if uuid_val.upper() != "N/A" else None,
                department_id=dept_id if dept_id.upper() != "N/A" else None,
                department_name=dept_name if dept_name.upper() != "N/A" else None,
                skills=skills if skills.upper() != "N/A" else None,
                project_manager_employee_id=pm_emp_id if pm_emp_id.upper() != "N/A" else None,
                project_manager_name=pm_name if pm_name.upper() != "N/A" else None,
            )
            db.add(new_proj)
            existing_projects[p_id] = new_proj
            projects_created += 1
        else:
            # Duplicate record identified -> Update and log duplicate
            duplicates_count += 1
            if len(duplicates_list) < 50:
                duplicates_list.append({
                    "project_id": p_id,
                    "project_name": p_name or existing_proj.project_name,
                    "client_name": c_name or existing_proj.client_name or "—",
                    "status": p_status or existing_proj.status,
                    "action": "Updated existing project record"
                })

            existing_proj.project_name = p_name if p_name else existing_proj.project_name
            existing_proj.status = p_status
            if sub_status and sub_status.upper() != "N/A":
                existing_proj.sub_status = sub_status
            if p_type and p_type.upper() != "N/A":
                existing_proj.type = p_type
            if start_date and start_date.upper() != "N/A":
                existing_proj.start_date = start_date
            if end_date and end_date.upper() != "N/A":
                existing_proj.end_date = end_date
            if eff_start and eff_start.upper() != "N/A":
                existing_proj.effective_start = eff_start
            if eff_end and eff_end.upper() != "N/A":
                existing_proj.effective_end = eff_end
            existing_proj.resource_count = res_count
            if res_names and res_names.upper() != "N/A":
                existing_proj.resource_names = res_names
            if c_name:
                existing_proj.client_name = c_name
            if partner_name and partner_name.upper() != "N/A":
                existing_proj.partner_name = partner_name
            if billable and billable.upper() != "N/A":
                existing_proj.billable = billable
            if c_id:
                existing_proj.client_id = c_id
            if partner_id and partner_id.upper() != "N/A":
                existing_proj.partner_id = partner_id
            if dept_name and dept_name.upper() != "N/A":
                existing_proj.department_name = dept_name
            if skills and skills.upper() != "N/A":
                existing_proj.skills = skills
            if pm_name and pm_name.upper() != "N/A":
                existing_proj.project_manager_name = pm_name

            projects_updated += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database commit error while saving records: {str(e)}"
        )

    return {
        "status": "warning" if errors and any(e.get("severity") == "error" for e in errors) else "success",
        "filename": filename,
        "format": ext.upper(),
        "total_rows": len(rows),
        "clients_created": clients_created,
        "clients_updated": clients_updated,
        "projects_created": projects_created,
        "projects_updated": projects_updated,
        "duplicate_records": duplicates_count,
        "duplicates_list": duplicates_list,
        "errors": errors,
        "message": (
            f"Processed {len(rows)} rows: {projects_created} new projects added, "
            f"{projects_updated} existing records updated ({duplicates_count} duplicates identified), "
            f"{clients_created} new clients registered."
        )
    }

@router.post("/reimport")
def trigger_data_reimport(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Re-import or update dataset from local default Projects_Overview_Report.csv"""
    from app.seed_data import seed_database
    imported_count = seed_database()
    return {
        "status": "success",
        "message": "Utiliza dataset synchronized successfully.",
        "details": imported_count
    }
