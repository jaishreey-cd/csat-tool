from typing import Optional
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.analytics import ProjectAnalyticsResponse, SystemOverviewResponse, DashboardAnalyticsResponse
from app.services.analytics_service import get_project_analytics, get_system_overview, get_dashboard_analytics
from app.services.export_service import (
    export_project_analytics,
    export_surveys_registry,
    export_portfolio_overview,
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/dashboard", response_model=DashboardAnalyticsResponse)
def fetch_dashboard_analytics(
    client_id: Optional[int] = Query(None, description="Filter by client ID"),
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    phase: Optional[str] = Query(None, description="Filter by feedback phase"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch comprehensive dashboard analytics: overall KPIs, category-wise averages, and project comparisons.
    Role-based access enforced: Admin sees portfolio-wide, PMO users see permitted projects/surveys.
    """
    return get_dashboard_analytics(
        db,
        client_id=client_id,
        project_id=project_id,
        phase=phase,
        start_date=start_date,
        end_date=end_date,
        current_user=current_user,
    )

@router.get("/overview", response_model=SystemOverviewResponse)
def fetch_system_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Fetch system-wide aggregated CSAT metrics, response rates, and trends.
    """
    return get_system_overview(db)

@router.get("/overview/export")
def download_portfolio_overview_export(
    format: str = Query("csv", description="Export format: 'csv' or 'xlsx'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export executive portfolio CSAT overview to CSV or Excel (XLSX).
    """
    file_bytes, filename, media_type = export_portfolio_overview(db, format=format)
    return Response(
        content=file_bytes,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )

@router.get("/surveys/export")
def download_surveys_registry_export(
    survey_id: Optional[int] = Query(None, description="Filter by individual survey ID"),
    status: Optional[str] = Query(None, description="Filter by survey status"),
    client_id: Optional[int] = Query(None, description="Filter by client ID"),
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    format: str = Query("csv", description="Export format: 'csv' or 'xlsx'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export filtered, individual, or all surveys from registry to CSV or Excel (XLSX).
    """
    file_bytes, filename, media_type = export_surveys_registry(
        db, status_filter=status, client_id=client_id, project_id=project_id, survey_id=survey_id, format=format
    )
    return Response(
        content=file_bytes,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )

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

@router.get("/projects/{project_id}/export")
def download_project_analytics_export(
    project_id: int,
    format: str = Query("csv", description="Export format: 'csv' or 'xlsx'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export project analytics report (KPIs, Section scores, Question distributions, Comments) to CSV or Excel (XLSX).
    """
    file_bytes, filename, media_type = export_project_analytics(db, project_id=project_id, format=format)
    return Response(
        content=file_bytes,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )

