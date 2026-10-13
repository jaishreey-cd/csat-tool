from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

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
    """List all clients imported from Utiliza."""
    clients = db.query(Client).order_by(Client.client_name.asc()).all()
    results = []
    for client in clients:
        proj_count = db.query(Project).filter(Project.client_id == client.client_id).count()
        results.append(ClientResponse(
            id=client.id,
            client_id=client.client_id,
            client_name=client.client_name,
            partner_name=client.partner_name,
            partner_id=client.partner_id,
            project_count=proj_count
        ))
    return results

@router.get("/projects", response_model=List[ProjectResponse])
def get_all_projects(
    search: Optional[str] = Query(None, description="Search by project name or ID"),
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all projects imported from Utiliza, with optional search and filter."""
    query = db.query(Project)
    if search:
        s = f"%{search}%"
        query = query.filter(
            (Project.project_name.ilike(s)) |
            (Project.project_id.ilike(s)) |
            (Project.client_name.ilike(s))
        )
    if status_filter:
        query = query.filter(Project.status.ilike(f"%{status_filter}%"))
    
    projects = query.order_by(Project.project_id.asc()).all()
    return projects

@router.post("/reimport")
def trigger_data_reimport(
    current_user: User = Depends(require_role(["PMO Admin"])),
    db: Session = Depends(get_db)
):
    """
    PMO Admin only: re-import or update dataset from Projects_Overview_Report.csv
    without needing an admin file upload screen (per architecture spec).
    """
    from app.seed_data import seed_database
    imported_count = seed_database()
    return {
        "status": "success",
        "message": "Utiliza dataset synchronized successfully.",
        "details": imported_count
    }
