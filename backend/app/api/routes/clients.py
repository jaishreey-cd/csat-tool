from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.client import ClientListResponse
from app.services.client_service import get_clients_tree

router = APIRouter(tags=["Clients"])

@router.get("/clients", response_model=ClientListResponse)
def get_clients(
    search: Optional[str] = Query(None, description="Search by client or project name/code"),
    include_archived: bool = Query(False, description="Include archived clients and projects"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all active clients with nested active projects and project counts.
    Supports debounced search across client and project codes/names.
    Supports ?include_archived=true toggle.
    Returns clients_data_last_updated timestamp.
    """
    return get_clients_tree(db, search=search, include_archived=include_archived, current_user=current_user)
