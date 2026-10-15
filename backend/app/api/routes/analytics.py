from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.analytics import ProjectAnalyticsResponse, SystemOverviewResponse
from app.services.analytics_service import get_project_analytics, get_system_overview

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/overview", response_model=SystemOverviewResponse)
def fetch_system_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch system-wide aggregated CSAT metrics, response rates, and trends.
    """
    return get_system_overview(db)

@router.get("/projects/{project_id}", response_model=ProjectAnalyticsResponse)
def fetch_project_analytics(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch comprehensive CSAT analytics, section breakdown, qualitative comments,
    and survey timeline for an individual project.
    """
    return get_project_analytics(db, project_id=project_id)
