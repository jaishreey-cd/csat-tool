from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.survey import Survey
from app.models.project_pmo import ProjectPmoAssignment
from app.services.analytics_service import is_admin_user
from app.schemas.survey import (
    SurveyCreate,
    SurveyResponse,
    SurveyListResponse,
    SurveyDispatch,
    PublicSurveyDetail,
    PublicSurveySubmission,
    ClientResponseDetail,
)
from app.services.survey_service import (
    create_survey,
    submit_survey_for_approval,
    get_surveys,
    get_survey_by_id,
    dispatch_survey,
    get_public_survey_by_token,
    submit_public_survey_response,
    check_and_trigger_automated_followups,
    get_client_response_detail,
)

router = APIRouter(prefix="/surveys", tags=["Surveys"])

def check_survey_access(db: Session, survey: Survey, current_user: User) -> bool:
    """Helper to verify if current user has access to view or interact with this survey."""
    if is_admin_user(current_user):
        return True
    if survey.creator_id == current_user.id or survey.reviewer_id == current_user.id:
        return True
    is_assigned = db.query(ProjectPmoAssignment.id).filter(
        ProjectPmoAssignment.project_id == survey.project_id,
        ProjectPmoAssignment.user_id == current_user.id
    ).first() is not None
    return is_assigned

@router.post("", response_model=SurveyResponse, status_code=status.HTTP_201_CREATED)
def create_new_survey(
    survey_in: SurveyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new CSAT survey with selected questions across 6 sections.
    Status starts in 'Draft' / 'Ready'.
    """
    return create_survey(db, survey_in, creator_id=current_user.id, current_user=current_user)

@router.get("", response_model=SurveyListResponse)
def list_all_surveys(
    status: Optional[str] = Query(None, description="Filter by status (Draft, Ready, Sent, Completed, etc.)"),
    client_id: Optional[int] = Query(None, description="Filter by client ID"),
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    phase: Optional[str] = Query(None, description="Filter by feedback phase"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all surveys with optional filters, date range, and role-based scoping."""
    surveys = get_surveys(
        db,
        status_filter=status,
        client_id=client_id,
        project_id=project_id,
        phase=phase,
        start_date=start_date,
        end_date=end_date,
        current_user=current_user,
    )
    return SurveyListResponse(surveys=surveys, total=len(surveys))

@router.get("/email-status")
def get_email_service_status(
    current_user: User = Depends(get_current_user),
):
    """Check connectivity and configuration status of the SMTP email dispatch service."""
    from app.services.email_service import verify_smtp_status
    return verify_smtp_status()

from pydantic import BaseModel, EmailStr
class TestEmailRequest(BaseModel):
    recipient_email: EmailStr

@router.post("/test-email")
def trigger_diagnostic_test_email(
    payload: TestEmailRequest,
    current_user: User = Depends(get_current_user),
):
    """Send a test email to verify live delivery to recipient."""
    from app.services.email_service import send_test_email
    return send_test_email(recipient_email=payload.recipient_email)

@router.get("/responses/{response_id}", response_model=ClientResponseDetail)
def get_survey_client_response_by_response_id(
    response_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Protected endpoint to fetch submitted client feedback details by response ID."""
    survey = db.query(Survey).filter(Survey.id == response_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey response not found")
    if not check_survey_access(db, survey, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to view this response."
        )
    return get_client_response_detail(db, survey_id=response_id)

@router.get("/{survey_id}/response", response_model=ClientResponseDetail)
def get_survey_client_response_by_survey_id(
    survey_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Protected endpoint to fetch submitted client feedback details by survey ID."""
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey response not found")
    if not check_survey_access(db, survey, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to view this response."
        )
    return get_client_response_detail(db, survey_id=survey_id)

@router.get("/{survey_id}", response_model=SurveyResponse)
def get_survey_details(
    survey_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get single survey with its configured questions."""
    survey = get_survey_by_id(db, survey_id)
    if not check_survey_access(db, survey, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to view this survey."
        )
    return survey

@router.post("/{survey_id}/submit-approval", response_model=SurveyResponse)
def submit_survey(
    survey_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a survey for review."""
    survey = get_survey_by_id(db, survey_id)
    if not check_survey_access(db, survey, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to submit this survey."
        )
    return submit_survey_for_approval(db, survey_id, user_id=current_user.id)

@router.post("/{survey_id}/dispatch", response_model=SurveyResponse)
def dispatch_survey_to_client(
    survey_id: int,
    dispatch_in: SurveyDispatch,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Dispatch survey to client contact and generate unique link."""
    survey = get_survey_by_id(db, survey_id)
    if not check_survey_access(db, survey, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to dispatch this survey."
        )
    return dispatch_survey(
        db,
        survey_id=survey_id,
        client_contact_name=dispatch_in.client_contact_name,
        client_contact_email=dispatch_in.client_contact_email,
    )

@router.post("/check-followups")
def trigger_automated_followups(
    threshold_days: int = Query(15, description="Minimum days pending before reminder is sent"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Automated job / trigger endpoint to scan all pending sent surveys and
    dispatch follow-up reminders to client contacts past the threshold days.
    """
    return check_and_trigger_automated_followups(db, threshold_days=threshold_days)

@router.get("/public/{token}", response_model=PublicSurveyDetail)
def fetch_public_survey(
    token: str,
    db: Session = Depends(get_db),
):
    """Public endpoint to fetch survey details and questions for client response portal."""
    return get_public_survey_by_token(db, token=token)

@router.post("/public/{token}/submit")
def submit_public_survey(
    token: str,
    submission_in: PublicSurveySubmission,
    db: Session = Depends(get_db),
):
    """Public endpoint for client to submit survey responses."""
    return submit_public_survey_response(db, token=token, answers=submission_in.answers)
