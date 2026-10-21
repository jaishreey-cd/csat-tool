import time
from datetime import datetime
from typing import Optional, List, Dict, Tuple
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_, desc

from app.models.client import Client
from app.models.project import Project
from app.models.import_batch import ImportBatch
from app.models.survey import Survey
from app.schemas.client import ClientResponse, ProjectResponse, ClientListResponse

# Lightweight in-memory cache for clients tree
_clients_cache: Dict[Tuple[str, bool], Tuple[float, ClientListResponse]] = {}
_CACHE_TTL = 30.0  # seconds

def invalidate_clients_cache():
    """Clear clients cache upon data mutation."""
    _clients_cache.clear()

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
    Uses selectinload to eliminate N+1 queries and caches results in memory for high performance.
    """
    clean_search = search.strip().lower() if search and search.strip() else ""
    cache_key = (clean_search, bool(include_archived))
    now = time.time()

    if cache_key in _clients_cache:
        cached_time, cached_res = _clients_cache[cache_key]
        if now - cached_time < _CACHE_TTL:
            return cached_res

    client_query = db.query(Client)

    if not include_archived:
        client_query = client_query.filter(Client.is_active == True)

    if clean_search:
        term = f"%{clean_search}%"
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

    # Eager load projects to eliminate N+1 query overhead across all clients
    clients = (
        client_query
        .options(selectinload(Client.projects))
        .order_by(Client.name.asc())
        .all()
    )

    # Pre-fetch only necessary survey fields to map project_id -> latest survey status
    surveys = (
        db.query(Survey.id, Survey.project_id, Survey.status, Survey.survey_code)
        .order_by(Survey.id.desc())
        .all()
    )
    project_survey_map = {}
    for s in surveys:
        if s.project_id not in project_survey_map:
            project_survey_map[s.project_id] = s

    client_responses: List[ClientResponse] = []
    total_projects_count = 0

    for c in clients:
        # Filter projects belonging to client
        proj_query = [p for p in c.projects]
        if not include_archived:
            proj_query = [p for p in proj_query if p.is_active]

        # Sort projects by project_code
        proj_query.sort(key=lambda p: (p.project_code or p.name).lower())

        project_dtos = []
        for p in proj_query:
            latest_s = project_survey_map.get(p.id)
            if not p.is_active:
                s_status = "Archived"
            elif latest_s:
                s_status = latest_s.status
            else:
                s_status = "Survey Not Created"

            project_dtos.append(
                ProjectResponse(
                    id=p.id,
                    project_code=p.project_code,
                    name=p.name,
                    client_id=p.client_id,
                    team_name=p.team_name,
                    status=p.status or "Not Started",
                    is_active=p.is_active,
                    archived_at=p.archived_at,
                    created_at=p.created_at,
                    updated_at=p.updated_at,
                    survey_status=s_status,
                    survey_id=latest_s.id if latest_s else None,
                    survey_code=latest_s.survey_code if latest_s else None,
                )
            )
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

    result = ClientListResponse(
        clients=client_responses,
        total_clients=len(client_responses),
        total_projects=total_projects_count,
        clients_data_last_updated=last_updated
    )
    _clients_cache[cache_key] = (now, result)
    return result
