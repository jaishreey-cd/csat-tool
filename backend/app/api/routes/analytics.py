from typing import Optional
from fastapi import APIRouter, Depends, Query, Response, status, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_admin
from app.models.user import User
from app.schemas.analytics import ProjectAnalyticsResponse, SystemOverviewResponse
from app.services.analytics_service import get_project_analytics, get_system_overview
from app.services.export_service import (
    export_project_analytics,
    export_surveys_registry,
    export_portfolio_overview,
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/overview", response_model=SystemOverviewResponse)
def fetch_system_overview(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """
    Fetch system-wide aggregated CSAT metrics, response rates, and trends (Admin only).
    """
    return get_system_overview(db)

@router.get("/overview/export")
def download_portfolio_overview_export(
    format: str = Query("csv", description="Export format: 'csv' or 'xlsx'"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
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
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by survey status"),
    client_id: Optional[int] = Query(None, description="Filter by client ID"),
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    format: str = Query("csv", description="Export format: 'csv' or 'xlsx'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export filtered, individual, or all surveys from registry to CSV or Excel (XLSX).
    """
    if current_user.role != "Admin" and survey_id is not None:
        from app.models.survey import Survey
        from app.services.survey_service import get_user_allowed_project_ids
        target_survey = db.query(Survey).filter(Survey.id == survey_id).first()
        if not target_survey:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
        allowed_pids = get_user_allowed_project_ids(db, current_user)
        if target_survey.creator_id != current_user.id and (target_survey.project_id not in allowed_pids):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not authorized to export this survey."
            )

    file_bytes, filename, media_type = export_surveys_registry(
        db,
        status_filter=status_filter,
        client_id=client_id,
        project_id=project_id,
        survey_id=survey_id,
        format=format,
        user=current_user,
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
    admin_user: User = Depends(require_admin),
):
    """
    Fetch comprehensive CSAT analytics, section breakdown, qualitative comments,
    and survey timeline for an individual project (Admin only).
    """
    return get_project_analytics(db, project_id=project_id)

@router.get("/projects/{project_id}/export")
def download_project_analytics_export(
    project_id: int,
    format: str = Query("csv", description="Export format: 'csv' or 'xlsx'"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
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

