from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.survey import SurveyCreate, SurveyResponse, SurveyListResponse
from app.services.survey_service import (
    create_survey,
    submit_survey_for_approval,
    get_surveys,
    get_survey_by_id,
)

router = APIRouter(prefix="/surveys", tags=["Surveys"])

@router.post("", response_model=SurveyResponse, status_code=status.HTTP_201_CREATED)
def create_new_survey(
    survey_in: SurveyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new CSAT survey with selected questions across 6 sections.
    Status starts in 'Draft'.
    """
    return create_survey(db, survey_in, creator_id=current_user.id)

@router.get("", response_model=SurveyListResponse)
def list_all_surveys(
    status: Optional[str] = Query(None, description="Filter by status (Draft, Pending Approval, Approved, etc.)"),
    client_id: Optional[int] = Query(None, description="Filter by client ID"),
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all surveys with optional filters."""
    surveys = get_surveys(db, status_filter=status, client_id=client_id, project_id=project_id)
    return SurveyListResponse(surveys=surveys, total=len(surveys))

@router.get("/{survey_id}", response_model=SurveyResponse)
def get_survey_details(
    survey_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get single survey with its configured questions."""
    return get_survey_by_id(db, survey_id)

@router.post("/{survey_id}/submit-approval", response_model=SurveyResponse)
def submit_survey(
    survey_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a Draft survey to 'Pending Approval' for peer PMO review."""
    return submit_survey_for_approval(db, survey_id, user_id=current_user.id)
