from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.api.deps import get_db, get_current_user, require_admin
from app.models.user import User
from app.schemas.survey import (
    SurveyCreate,
    SurveyResponse,
    SurveyListResponse,
    SurveyDispatch,
    PublicSurveyDetail,
    PublicSurveySubmission,
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
)
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/surveys", tags=["Surveys"])

@router.post("", response_model=SurveyResponse, status_code=status.HTTP_201_CREATED)
def create_new_survey(
    survey_in: SurveyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new CSAT survey with selected questions across 6 sections.
    Status starts in 'Draft' / 'Ready'.
    Enforces record-level authorization and section limits for all users.
    """
    survey = create_survey(db, survey_in, creator_id=current_user.id, user=current_user)
    log_audit_event(
        db=db,
        user_id=current_user.id,
        actor_email=current_user.email,
        action="CREATE_SURVEY",
        resource_type="SURVEY",
        resource_id=survey.id,
        details=f"Created survey {survey.survey_code} for project #{survey.project_id}",
    )
    return survey

@router.get("", response_model=SurveyListResponse)
def list_all_surveys(
    status: Optional[str] = Query(None, description="Filter by status (Draft, Ready, Sent, Completed, etc.)"),
    client_id: Optional[int] = Query(None, description="Filter by client ID"),
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List surveys. Admins view all; Users view only authorized surveys."""
    surveys = get_surveys(db, status_filter=status, client_id=client_id, project_id=project_id, user=current_user)
    return SurveyListResponse(surveys=surveys, total=len(surveys))

class TestEmailRequest(BaseModel):
    recipient_email: EmailStr

@router.get("/email-status")
def get_email_service_status(
    admin_user: User = Depends(require_admin),
):
    """Check connectivity and configuration status of the SMTP email dispatch service (Admin only)."""
    from app.services.email_service import verify_smtp_status
    return verify_smtp_status()

@router.post("/test-email")
def trigger_diagnostic_test_email(
    payload: TestEmailRequest,
    admin_user: User = Depends(require_admin),
):
    """Send a test email to verify live delivery to recipient (Admin only)."""
    from app.services.email_service import send_test_email
    return send_test_email(recipient_email=payload.recipient_email)

@router.get("/{survey_id}", response_model=SurveyResponse)
def get_survey_details(
    survey_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get single survey with its configured questions. Enforces record-level authorization."""
    return get_survey_by_id(db, survey_id, user=current_user)

@router.post("/{survey_id}/submit-approval", response_model=SurveyResponse)
def submit_survey(
    survey_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a survey for review. Enforces record-level authorization."""
    return submit_survey_for_approval(db, survey_id, user=current_user)

@router.post("/{survey_id}/dispatch", response_model=SurveyResponse)
def dispatch_survey_to_client(
    survey_id: int,
    dispatch_in: SurveyDispatch,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Dispatch survey to client contact and generate unique link. Enforces record-level authorization."""
    survey = dispatch_survey(
        db,
        survey_id=survey_id,
        client_contact_name=dispatch_in.client_contact_name,
        client_contact_email=dispatch_in.client_contact_email,
        user=current_user,
    )
    log_audit_event(
        db=db,
        user_id=current_user.id,
        actor_email=current_user.email,
        action="DISPATCH_SURVEY",
        resource_type="SURVEY",
        resource_id=survey.id,
        details=f"Dispatched survey {survey.survey_code} to {dispatch_in.client_contact_email}",
    )
    return survey

@router.post("/check-followups")
def trigger_automated_followups(
    threshold_days: int = Query(15, description="Minimum days pending before reminder is sent"),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Scan all pending sent surveys and dispatch follow-up reminders past threshold days (Admin only).
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
