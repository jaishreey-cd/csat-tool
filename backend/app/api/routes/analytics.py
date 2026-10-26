from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_admin
from app.models.user import User
from app.models.survey import Survey
from app.models.project_pmo import ProjectPmoAssignment
from app.schemas.analytics import (
    ProjectAnalyticsResponse,
    SystemOverviewResponse,
    DashboardAnalyticsResponse,
    AssignedPmo,
    ProjectPmoAssignRequest,
)
from app.services.analytics_service import (
    get_project_analytics,
    get_system_overview,
    get_dashboard_analytics,
    is_admin_user,
    assign_project_pmos,
)
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
    pmo_user_id: Optional[int] = Query(None, description="Filter by assigned PMO user ID"),
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
        pmo_user_id=pmo_user_id,
        current_user=current_user,
    )

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
    Access: Admins, and the project's assigned PMO(s) or survey creator. Anyone else gets a 403.
    """
    if not is_admin_user(current_user):
        is_assigned = db.query(ProjectPmoAssignment.id).filter(
            ProjectPmoAssignment.project_id == project_id,
            ProjectPmoAssignment.user_id == current_user.id
        ).first() is not None

        is_creator = db.query(Survey.id).filter(
            Survey.project_id == project_id,
            (Survey.creator_id == current_user.id) | (Survey.reviewer_id == current_user.id)
        ).first() is not None

        if not is_assigned and not is_creator:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not have permission to view analytics for this project."
            )
    return get_project_analytics(db, project_id=project_id)

@router.put("/projects/{project_id}/assign-pmos", response_model=List[AssignedPmo])
def update_project_pmo_assignments(
    project_id: int,
    payload: ProjectPmoAssignRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """
    Assign or update PMO users for a project (Admin only).
    """
    return assign_project_pmos(db, project_id=project_id, user_ids=payload.user_ids)

@router.get("/projects/{project_id}/export")
def download_project_analytics_export(
    project_id: int,
    format: str = Query("csv", description="Export format: 'csv' or 'xlsx'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export project analytics report (KPIs, Section scores, Question distributions, Comments) to CSV or Excel (XLSX).
    Access: Admins, and the project's assigned PMO(s) or survey creator. Anyone else gets a 403.
    """
    if not is_admin_user(current_user):
        is_assigned = db.query(ProjectPmoAssignment.id).filter(
            ProjectPmoAssignment.project_id == project_id,
            ProjectPmoAssignment.user_id == current_user.id
        ).first() is not None

        is_creator = db.query(Survey.id).filter(
            Survey.project_id == project_id,
            (Survey.creator_id == current_user.id) | (Survey.reviewer_id == current_user.id)
        ).first() is not None

        if not is_assigned and not is_creator:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not have permission to export analytics for this project."
            )
    file_bytes, filename, media_type = export_project_analytics(db, project_id=project_id, format=format)
    return Response(
        content=file_bytes,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )

