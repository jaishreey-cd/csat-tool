from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from app.models.client import Client
from app.models.project import Project
from app.models.import_batch import ImportBatch
from app.schemas.client import ClientResponse, ProjectResponse, ClientListResponse

def get_clients_data_last_updated(db: Session) -> Optional[datetime]:
    """Get the uploaded_at of the latest applied ImportBatch, or latest client created_at."""
    latest_batch = (
        db.query(ImportBatch)
        .filter(ImportBatch.status == "applied")
        .order_by(desc(ImportBatch.uploaded_at))
        .first()
    )
    if latest_batch:
        return latest_batch.uploaded_at

    latest_client = (
        db.query(Client)
        .order_by(desc(Client.updated_at))
        .first()
    )
    if latest_client:
        return latest_client.updated_at
    return None

def get_clients_tree(
    db: Session,
    search: Optional[str] = None,
    include_archived: bool = False
) -> ClientListResponse:
    """
    Query clients and their nested projects.
    Filters active records by default, supporting search on client/project name & code.
    """
    client_query = db.query(Client)

    if not include_archived:
        client_query = client_query.filter(Client.is_active == True)

    if search and search.strip():
        term = f"%{search.strip()}%"
        # Clients matching directly OR having a project matching term
        matching_client_ids_from_projects = (
            db.query(Project.client_id)
            .filter(
                or_(
                    Project.name.ilike(term),
                    Project.project_code.ilike(term)
                )
            )
            .distinct()
            .all()
        )
        project_matched_ids = [cid[0] for cid in matching_client_ids_from_projects if cid[0]]

        client_query = client_query.filter(
            or_(
                Client.name.ilike(term),
                Client.client_code.ilike(term),
                Client.id.in_(project_matched_ids)
            )
        )

    clients = client_query.order_by(Client.name.asc()).all()

    client_responses: List[ClientResponse] = []
    total_projects_count = 0

    for c in clients:
        # Filter projects belonging to client
        proj_query = [p for p in c.projects]
        if not include_archived:
            proj_query = [p for p in proj_query if p.is_active]

        # Sort projects by project_code
        proj_query.sort(key=lambda p: (p.project_code or p.name).lower())

        project_dtos = [ProjectResponse.model_validate(p) for p in proj_query]
        total_projects_count += len(project_dtos)

        c_dto = ClientResponse(
            id=c.id,
            client_code=c.client_code,
            name=c.name,
            is_active=c.is_active,
            archived_at=c.archived_at,
            created_at=c.created_at,
            updated_at=c.updated_at,
            projects=project_dtos,
            project_count=len(project_dtos)
        )
        client_responses.append(c_dto)

    last_updated = get_clients_data_last_updated(db)

    return ClientListResponse(
        clients=client_responses,
        total_clients=len(client_responses),
        total_projects=total_projects_count,
        clients_data_last_updated=last_updated
    )
