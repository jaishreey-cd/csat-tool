import time
import uuid
from datetime import datetime
from typing import Optional, List
from typing import Optional, List, Dict, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.survey import Survey, SurveyQuestion
from app.models.client import Client
from app.models.project import Project
from app.schemas.survey import SurveyCreate
from app.services.email_service import send_survey_invitation_email

from app.models.assignment import UserProjectAssignment
from app.models.user import User

# In-memory cache for get_surveys: key -> (timestamp, List[Survey])
_surveys_cache: Dict[Tuple, Tuple[float, List]] = {}
_SURVEYS_CACHE_TTL = 30.0

def invalidate_surveys_cache():
    """Clear surveys list cache upon survey creation or state mutation."""
    _surveys_cache.clear()

def get_user_allowed_project_ids(db: Session, user: User) -> List[int]:
    """Retrieve all project IDs a PMO User is permitted to access."""
    if user.role == "Admin":
        return []
    assigned = db.query(UserProjectAssignment.project_id).filter(
        UserProjectAssignment.user_id == user.id
    ).all()
    assigned_ids = {r[0] for r in assigned}
    created_survey_project_ids = db.query(Survey.project_id).filter(
        Survey.creator_id == user.id
    ).all()
    survey_pids = {r[0] for r in created_survey_project_ids if r[0]}
    return list(assigned_ids | survey_pids)

def create_survey(db: Session, survey_in: SurveyCreate, creator_id: int, user: Optional[User] = None) -> Survey:
    """
    Create a new CSAT survey with strict section and question limits.
    Rules:
      - Sections 1 to 5 must have 1 to 5 questions each.
      - Section 6 is optional (0 to 5 questions).
      - Maximum 30 questions in total.
      - User must be authorized for the project.
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

    # 1b. Record-level check: ensure user is authorized for this project
    if user and user.role != "Admin":
        allowed_pids = get_user_allowed_project_ids(db, user)
        # If user has no assignments or project not in allowed, forbid access
        if allowed_pids and project.id not in allowed_pids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not authorized to create surveys for this project."
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

    # Ensure sections 1-5 have 1 to 5 questions; Section 6 is optional (0 to 5 questions)
    for sec_num, count in section_counts.items():
        if sec_num <= 5 and count < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Section {sec_num} has no questions. Sections 1 to 5 must each have between 1 and 5 questions."
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

    # 3. Generate unique survey code and secure link token
    random_suffix = str(uuid.uuid4())[:6].upper()
    survey_code = f"SRV-{project.project_code}-{random_suffix}"
    unique_token = str(uuid.uuid4()).replace("-", "")

    is_dispatched = bool(survey_in.client_contact_name and survey_in.client_contact_email)

    survey = Survey(
        survey_code=survey_code,
        unique_token=unique_token,
        client_id=client.id,
        project_id=project.id,
        phase=survey_in.phase,
        status="Sent" if is_dispatched else "Draft",
        client_contact_name=survey_in.client_contact_name if is_dispatched else None,
        client_contact_email=survey_in.client_contact_email if is_dispatched else None,
        sent_at=datetime.utcnow() if is_dispatched else None,
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

    if is_dispatched:
        send_survey_invitation_email(
            recipient_email=survey_in.client_contact_email,
            recipient_name=survey_in.client_contact_name,
            survey_code=survey.survey_code,
            project_name=project.name,
            client_name=client.name,
            phase=survey.phase,
            survey_token=survey.unique_token,
        )

    invalidate_surveys_cache()
    from app.services.client_service import invalidate_clients_cache
    invalidate_clients_cache()
    return survey

def submit_survey_for_approval(db: Session, survey_id: int, user: User) -> Survey:
    """Move survey from Draft to Pending Approval with authorization check."""
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    if user.role != "Admin":
        allowed_pids = get_user_allowed_project_ids(db, user)
        if survey.creator_id != user.id and (survey.project_id not in allowed_pids):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not authorized to modify this survey."
            )

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
    user: Optional[User] = None,
) -> List[Survey]:
    """List surveys with optional filters and eager loading. Restricts non-Admin users to their authorized surveys."""
    user_scope = "ADMIN" if user is None or user.role == "Admin" else f"USER_{user.id}"
    cache_key = (status_filter, client_id, project_id, user_scope)
    now = time.time()
    if cache_key in _surveys_cache:
        cached_time, cached_data = _surveys_cache[cache_key]
        if now - cached_time < _SURVEYS_CACHE_TTL:
            return cached_data

    from sqlalchemy.orm import joinedload, selectinload
    from sqlalchemy import or_

    query = (
        db.query(Survey)
        .options(
            joinedload(Survey.client),
            joinedload(Survey.project),
            joinedload(Survey.creator),
            selectinload(Survey.questions),
        )
    )

    if user and user.role != "Admin":
        allowed_pids = get_user_allowed_project_ids(db, user)
        query = query.filter(
            or_(
                Survey.creator_id == user.id,
                Survey.project_id.in_(allowed_pids) if allowed_pids else False
            )
        )

    if status_filter:
        query = query.filter(Survey.status == status_filter)
    if client_id:
        query = query.filter(Survey.client_id == client_id)
    if project_id:
        query = query.filter(Survey.project_id == project_id)

    surveys = query.order_by(desc(Survey.created_at)).all()
    has_updates = False
    for s in surveys:
        if not s.unique_token:
            s.unique_token = str(uuid.uuid4()).replace("-", "")
            has_updates = True
    if has_updates:
        db.commit()
    _surveys_cache[cache_key] = (now, surveys)
    return surveys

from app.models.survey import Survey, SurveyQuestion, SurveyAnswer
from app.models.client import Client
from app.models.project import Project
from app.schemas.survey import SurveyCreate, PublicSurveyDetail, PublicQuestionResponse, AnswerItem

def get_survey_by_id(db: Session, survey_id: int, user: Optional[User] = None) -> Survey:
    """Fetch single survey with joined relationships, enforcing user access control."""
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    if user and user.role != "Admin":
        allowed_pids = get_user_allowed_project_ids(db, user)
        if survey.creator_id != user.id and (survey.project_id not in allowed_pids):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not authorized to view this survey."
            )

    if not survey.unique_token:
        survey.unique_token = str(uuid.uuid4()).replace("-", "")
        db.commit()
        db.refresh(survey)
    return survey

def dispatch_survey(
    db: Session,
    survey_id: int,
    client_contact_name: str,
    client_contact_email: str,
    user: Optional[User] = None,
) -> Survey:
    """
    Dispatch survey to client contact.
    Generates a secure unique token for the public response URL.
    Enforces authorization check.
    """
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    if user and user.role != "Admin":
        allowed_pids = get_user_allowed_project_ids(db, user)
        if survey.creator_id != user.id and (survey.project_id not in allowed_pids):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not authorized to dispatch this survey."
            )

    if not survey.unique_token:
        survey.unique_token = str(uuid.uuid4()).replace("-", "")

    survey.client_contact_name = client_contact_name
    survey.client_contact_email = client_contact_email
    survey.sent_at = datetime.utcnow()
    survey.status = "Sent"

    db.commit()
    db.refresh(survey)

    # Dispatch email invitation with unique survey link to the client contact email
    client_name = survey.client.name if survey.client else "Client"
    project_name = survey.project.name if survey.project else "Project"
    send_survey_invitation_email(
        recipient_email=client_contact_email,
        recipient_name=client_contact_name,
        survey_code=survey.survey_code,
        project_name=project_name,
        client_name=client_name,
        phase=survey.phase,
        survey_token=survey.unique_token,
    )

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

    # Automatically dispatch acknowledgement follow-up email if client email is available
    if survey.client_contact_email:
        try:
            from app.services.email_service import send_response_followup_email
            send_response_followup_email(
                recipient_email=survey.client_contact_email,
                recipient_name=survey.client_contact_name or "Client Stakeholder",
                project_name=survey.project.name if survey.project else "Project",
                client_name=survey.client.name if survey.client else "Client",
                phase=survey.phase,
                average_score=survey.average_score,
            )
        except Exception:
            pass

    return {
        "status": "success",
        "message": "Survey feedback recorded successfully. Thank you!",
        "survey_code": survey.survey_code,
        "completed_at": survey.completed_at.isoformat(),
        "average_score": survey.average_score,
    }

def check_and_trigger_automated_followups(db: Session, threshold_days: int = 15) -> dict:
    """
    Scans all pending sent surveys. If days since sent_at >= threshold_days and
    no follow-up has been sent yet, automatically triggers one follow-up reminder email.
    """
    now = datetime.utcnow()
    pending_surveys = (
        db.query(Survey)
        .filter(
            Survey.status == "Sent",
            Survey.client_contact_email.isnot(None),
            Survey.completed_at.is_(None)
        )
        .all()
    )

    reminded = []
    from app.services.email_service import send_survey_reminder_email

    for survey in pending_surveys:
        if not survey.sent_at:
            continue

        days_since_sent = (now - survey.sent_at).days
        if days_since_sent >= threshold_days:
            # If a follow-up email has already been sent, do not send another.
            if survey.followup_sent_at:
                continue

            send_survey_reminder_email(
                recipient_email=survey.client_contact_email,
                recipient_name=survey.client_contact_name or "Client Stakeholder",
                survey_code=survey.survey_code,
                project_name=survey.project.name if survey.project else "Project",
                client_name=survey.client.name if survey.client else "Client",
                phase=survey.phase,
                survey_token=survey.unique_token,
            )
            survey.followup_sent_at = now
            reminded.append({
                "survey_id": survey.id,
                "survey_code": survey.survey_code,
                "recipient": survey.client_contact_email,
                "days_pending": days_since_sent
            })

    if reminded:
        db.commit()
        invalidate_surveys_cache()

    return {
        "status": "success",
        "reminded_count": len(reminded),
        "reminded_surveys": reminded
    }
