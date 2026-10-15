import time
import uuid
from typing import Optional, List, Dict, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.survey import Survey, SurveyQuestion
from app.models.client import Client
from app.models.project import Project
from app.schemas.survey import SurveyCreate

# In-memory cache for get_surveys
_surveys_cache: Dict[Tuple, Tuple[float, List]] = {}
_SURVEYS_CACHE_TTL = 30.0

def invalidate_surveys_cache():
    """Clear surveys list cache upon survey creation or state mutation."""
    _surveys_cache.clear()

def create_survey(db: Session, survey_in: SurveyCreate, creator_id: int) -> Survey:
    """
    Create a new CSAT survey with strict section and question limits.
    Rules:
      - 6 fixed sections.
      - Each section must have between 1 and 5 questions.
      - No section can be skipped (all 6 sections must have >= 1 question).
      - Maximum 30 questions in total.
      - Sections 1-5 use star ratings; Section 6 is free-text.
    """
    # 1. Verify Client and Project
    client = db.query(Client).filter(Client.id == survey_in.client_id, Client.is_active.is_(True)).first()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found or archived")

    project = db.query(Project).filter(
        Project.id == survey_in.project_id,
        Project.client_id == client.id,
        Project.is_active.is_(True)
    ).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project not found, archived, or does not belong to the selected client"
        )

    # 2. Validate Questions across 6 sections
    section_counts = {sec: 0 for sec in range(1, 7)}
    for q in survey_in.questions:
        if q.section_number not in section_counts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid section number {q.section_number}. Must be between 1 and 6."
            )
        section_counts[q.section_number] += 1

    # Ensure no section was skipped
    for sec_num, count in section_counts.items():
        if count < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Section {sec_num} has no questions. Every section must have between 1 and 5 questions."
            )
        if count > 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Section {sec_num} has {count} questions. Maximum 5 questions allowed per section."
            )

    if len(survey_in.questions) > 30:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Total questions ({len(survey_in.questions)}) exceeds the maximum allowed limit of 30."
        )

    # 3. Generate unique survey code
    random_suffix = str(uuid.uuid4())[:6].upper()
    survey_code = f"SRV-{project.project_code}-{random_suffix}"

    survey = Survey(
        survey_code=survey_code,
        client_id=client.id,
        project_id=project.id,
        phase=survey_in.phase,
        status="Ready",
        creator_id=creator_id,
    )
    db.add(survey)
    db.flush()  # generate survey.id

    # Add questions
    for order_idx, q in enumerate(survey_in.questions):
        expected_type = "free_text" if q.section_number == 6 else "star_rating"
        survey_q = SurveyQuestion(
            survey_id=survey.id,
            section_number=q.section_number,
            section_title=q.section_title,
            question_text=q.question_text,
            response_type=expected_type,
            is_custom=q.is_custom,
            display_order=order_idx + 1,
        )
        db.add(survey_q)

    db.commit()
    db.refresh(survey)
    invalidate_surveys_cache()
    from app.services.client_service import invalidate_clients_cache
    invalidate_clients_cache()
    return survey

def submit_survey_for_approval(db: Session, survey_id: int, user_id: int) -> Survey:
    """Move survey from Draft to Pending Approval."""
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    if survey.status not in ["Draft", "Rejected"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Survey cannot be submitted for approval from '{survey.status}' status"
        )

    survey.status = "Pending Approval"
    db.commit()
    db.refresh(survey)
    invalidate_surveys_cache()
    from app.services.client_service import invalidate_clients_cache
    invalidate_clients_cache()
    return survey

def get_surveys(
    db: Session,
    status_filter: Optional[str] = None,
    client_id: Optional[int] = None,
    project_id: Optional[int] = None,
) -> List[Survey]:
    """List surveys with optional filters and eager loading to eliminate N+1 queries."""
    cache_key = (status_filter, client_id, project_id)
    now = time.time()
    if cache_key in _surveys_cache:
        cached_time, cached_data = _surveys_cache[cache_key]
        if now - cached_time < _SURVEYS_CACHE_TTL:
            return cached_data

    from sqlalchemy.orm import joinedload, selectinload
    query = (
        db.query(Survey)
        .options(
            joinedload(Survey.client),
            joinedload(Survey.project),
            joinedload(Survey.creator),
            joinedload(Survey.reviewer),
            selectinload(Survey.questions),
        )
    )
    if status_filter:
        query = query.filter(Survey.status == status_filter)
    if client_id:
        query = query.filter(Survey.client_id == client_id)
    if project_id:
        query = query.filter(Survey.project_id == project_id)

    surveys = query.order_by(desc(Survey.created_at)).all()
    _surveys_cache[cache_key] = (now, surveys)
    return surveys

from app.models.survey import Survey, SurveyQuestion, SurveyAnswer
from app.models.client import Client
from app.models.project import Project
from app.schemas.survey import SurveyCreate, PublicSurveyDetail, PublicQuestionResponse, AnswerItem
from datetime import datetime

def get_survey_by_id(db: Session, survey_id: int) -> Survey:
    """Fetch single survey with joined relationships."""
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    return survey

def dispatch_survey(db: Session, survey_id: int, client_contact_name: str, client_contact_email: str) -> Survey:
    """
    Dispatch survey to client contact.
    Generates a secure unique token for the public response URL.
    """
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    if not survey.unique_token:
        survey.unique_token = str(uuid.uuid4()).replace("-", "")

    survey.client_contact_name = client_contact_name
    survey.client_contact_email = client_contact_email
    survey.sent_at = datetime.utcnow()
    survey.status = "Sent"

    db.commit()
    db.refresh(survey)
    invalidate_surveys_cache()
    from app.services.client_service import invalidate_clients_cache
    invalidate_clients_cache()
    return survey

def get_public_survey_by_token(db: Session, token: str) -> PublicSurveyDetail:
    """Fetch survey and its questions by unique public token."""
    survey = db.query(Survey).filter(Survey.unique_token == token).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey link not found or invalid")

    questions_data = [
        PublicQuestionResponse(
            id=q.id,
            section_number=q.section_number,
            section_title=q.section_title,
            question_text=q.question_text,
            response_type=q.response_type,
            display_order=q.display_order,
        )
        for q in survey.questions
    ]

    return PublicSurveyDetail(
        survey_code=survey.survey_code,
        unique_token=survey.unique_token,
        client_name=survey.client.name if survey.client else "Client",
        project_name=survey.project.name if survey.project else "Project",
        project_code=survey.project.project_code if survey.project else "",
        phase=survey.phase,
        status=survey.status,
        client_contact_name=survey.client_contact_name,
        completed_at=survey.completed_at,
        average_score=survey.average_score,
        questions=questions_data,
    )

def submit_public_survey_response(db: Session, token: str, answers: List[AnswerItem]) -> dict:
    """Record client survey response and calculate overall average."""
    survey = db.query(Survey).filter(Survey.unique_token == token).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey link not found or invalid")

    if survey.status == "Completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This survey has already been submitted. Thank you for your feedback!"
        )

    # Save answers
    star_scores = []
    for item in answers:
        answer_record = SurveyAnswer(
            survey_id=survey.id,
            question_id=item.question_id,
            rating_score=item.rating_score,
            text_answer=item.text_answer,
            created_at=datetime.utcnow(),
        )
        db.add(answer_record)
        if item.rating_score is not None and item.rating_score >= 1:
            star_scores.append(item.rating_score)

    # Calculate average rating
    if star_scores:
        survey.average_score = round(sum(star_scores) / len(star_scores), 2)

    survey.status = "Completed"
    survey.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(survey)
    invalidate_surveys_cache()
    from app.services.client_service import invalidate_clients_cache
    invalidate_clients_cache()

    return {
        "status": "success",
        "message": "Survey feedback recorded successfully. Thank you!",
        "survey_code": survey.survey_code,
        "completed_at": survey.completed_at.isoformat(),
        "average_score": survey.average_score,
    }
