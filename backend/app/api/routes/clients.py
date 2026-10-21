from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_admin
from app.models.user import User
from app.models.client import Client
from app.models.project import Project
from app.models.survey import Survey
from app.models.assignment import UserProjectAssignment
from app.schemas.client import (
    ClientListResponse,
    ClientResponse,
    ProjectResponse,
    ClientCreate,
    ClientUpdate,
    ProjectCreate,
    ProjectUpdate,
)
from app.services.client_service import get_clients_tree, invalidate_clients_cache
from app.services.audit_service import log_audit_event

router = APIRouter(tags=["Clients"])

@router.get("/clients", response_model=ClientListResponse)
def get_clients(
    search: Optional[str] = Query(None, description="Search by client or project name/code"),
    include_archived: bool = Query(False, description="Include archived clients and projects"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get active clients with nested projects.
    Admins see all clients/projects.
    Users only see clients and projects explicitly assigned to them or created by them.
    """
    is_admin = (current_user.role == "Admin")
    allowed_project_ids = None

    if not is_admin:
        assigned_records = db.query(UserProjectAssignment.project_id).filter(
            UserProjectAssignment.user_id == current_user.id
        ).all()
        assigned_ids = {r[0] for r in assigned_records}

        created_survey_project_ids = db.query(Survey.project_id).filter(
            Survey.creator_id == current_user.id
        ).all()
        survey_pids = {r[0] for r in created_survey_project_ids if r[0]}

        allowed_project_ids = list(assigned_ids | survey_pids)

    return get_clients_tree(
        db,
        search=search,
        include_archived=include_archived,
        allowed_project_ids=allowed_project_ids,
        is_admin=is_admin,
        user_id=current_user.id,
    )

@router.post("/clients", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: ClientCreate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only: Create a client."""
    existing = db.query(Client).filter(Client.client_code.ilike(payload.client_code.strip())).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Client code '{payload.client_code}' already exists.")

    client = Client(
        client_code=payload.client_code.strip().upper(),
        name=payload.name.strip(),
        is_active=True,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    invalidate_clients_cache()

    log_audit_event(
        db=db,
        user_id=admin_user.id,
        actor_email=admin_user.email,
        action="CREATE_CLIENT",
        resource_type="CLIENT",
        resource_id=client.id,
        details=f"Created client {client.client_code} ({client.name})",
    )
    return ClientResponse(
        id=client.id,
        client_code=client.client_code,
        name=client.name,
        is_active=client.is_active,
        created_at=client.created_at,
        updated_at=client.updated_at,
        projects=[],
        project_count=0,
    )

@router.put("/clients/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: int,
    payload: ClientUpdate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only: Update client details."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if payload.client_code:
        client.client_code = payload.client_code.strip().upper()
    if payload.name:
        client.name = payload.name.strip()
    if payload.is_active is not None:
        client.is_active = payload.is_active

    db.commit()
    db.refresh(client)
    invalidate_clients_cache()

    log_audit_event(
        db=db,
        user_id=admin_user.id,
        actor_email=admin_user.email,
        action="UPDATE_CLIENT",
        resource_type="CLIENT",
        resource_id=client.id,
        details=f"Updated client {client.client_code} ({client.name})",
    )
    return ClientResponse(
        id=client.id,
        client_code=client.client_code,
        name=client.name,
        is_active=client.is_active,
        created_at=client.created_at,
        updated_at=client.updated_at,
        projects=[],
        project_count=len(client.projects or []),
    )

@router.delete("/clients/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_client(
    client_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only: Soft-archive client."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    client.is_active = False
    client.archived_at = datetime.now(timezone.utc)
    db.commit()
    invalidate_clients_cache()

    log_audit_event(
        db=db,
        user_id=admin_user.id,
        actor_email=admin_user.email,
        action="ARCHIVE_CLIENT",
        resource_type="CLIENT",
        resource_id=client_id,
        details=f"Archived client {client.client_code} ({client.name})",
    )
    return None

@router.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only: Create a project under a client."""
    client = db.query(Client).filter(Client.id == payload.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    existing = db.query(Project).filter(
        Project.client_id == payload.client_id,
        Project.project_code.ilike(payload.project_code.strip())
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Project code '{payload.project_code}' already exists for this client.")

    project = Project(
        client_id=payload.client_id,
        project_code=payload.project_code.strip().upper(),
        name=payload.name.strip(),
        team_name=payload.team_name,
        status=payload.status or "Active",
        is_active=True,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    invalidate_clients_cache()

    log_audit_event(
        db=db,
        user_id=admin_user.id,
        actor_email=admin_user.email,
        action="CREATE_PROJECT",
        resource_type="PROJECT",
        resource_id=project.id,
        details=f"Created project {project.project_code} ({project.name}) for client #{client.id}",
    )
    return ProjectResponse(
        id=project.id,
        project_code=project.project_code,
        name=project.name,
        client_id=project.client_id,
        team_name=project.team_name,
        status=project.status,
        is_active=project.is_active,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )

@router.put("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only: Update project details."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.project_code:
        project.project_code = payload.project_code.strip().upper()
    if payload.name:
        project.name = payload.name.strip()
    if payload.team_name is not None:
        project.team_name = payload.team_name
    if payload.status:
        project.status = payload.status
    if payload.is_active is not None:
        project.is_active = payload.is_active

    db.commit()
    db.refresh(project)
    invalidate_clients_cache()

    log_audit_event(
        db=db,
        user_id=admin_user.id,
        actor_email=admin_user.email,
        action="UPDATE_PROJECT",
        resource_type="PROJECT",
        resource_id=project.id,
        details=f"Updated project {project.project_code} ({project.name})",
    )
    return ProjectResponse(
        id=project.id,
        project_code=project.project_code,
        name=project.name,
        client_id=project.client_id,
        team_name=project.team_name,
        status=project.status,
        is_active=project.is_active,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )

@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_project(
    project_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only: Soft-archive project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.is_active = False
    project.archived_at = datetime.now(timezone.utc)
    db.commit()
    invalidate_clients_cache()

    log_audit_event(
        db=db,
        user_id=admin_user.id,
        actor_email=admin_user.email,
        action="ARCHIVE_PROJECT",
        resource_type="PROJECT",
        resource_id=project_id,
        details=f"Archived project {project.project_code} ({project.name})",
    )
    return None
