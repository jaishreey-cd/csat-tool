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
            selectinload(Survey.answers),
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

def get_survey_by_id(db: Session, survey_id: int) -> Survey:
    """Fetch single survey with joined relationships."""
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    if not survey.unique_token:
        survey.unique_token = str(uuid.uuid4()).replace("-", "")
        db.commit()
        db.refresh(survey)
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

def get_client_response_detail(db: Session, survey_id: int) -> dict:
    """
    Fetch comprehensive client response details for a submitted survey.
    Returns 404 if the survey does not exist or has not been submitted yet.
    """
    from sqlalchemy.orm import joinedload, selectinload
    survey = (
        db.query(Survey)
        .options(
            joinedload(Survey.client),
            joinedload(Survey.project),
            selectinload(Survey.questions),
            selectinload(Survey.answers).joinedload(SurveyAnswer.question),
        )
        .filter(Survey.id == survey_id)
        .first()
    )
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    if survey.status != "Completed" or not survey.completed_at or not survey.answers:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No submitted client response found for this survey. Survey is awaiting response."
        )

    answers_map = {a.question_id: a for a in survey.answers}

    sections_dict = {}
    additional_comments = []

    for q in sorted(survey.questions, key=lambda x: (x.section_number, x.display_order)):
        sec_num = q.section_number
        if sec_num not in sections_dict:
            sections_dict[sec_num] = {
                "section_number": sec_num,
                "section_title": q.section_title,
                "star_scores": [],
                "questions": [],
            }

        answer = answers_map.get(q.id)
        rating_score = answer.rating_score if answer else None
        text_answer = answer.text_answer if answer else None

        if rating_score is not None and rating_score >= 1:
            sections_dict[sec_num]["star_scores"].append(rating_score)

        if text_answer and text_answer.strip():
            additional_comments.append(text_answer.strip())

        sections_dict[sec_num]["questions"].append({
            "question_id": q.id,
            "question_text": q.question_text,
            "response_type": q.response_type,
            "rating_score": rating_score,
            "text_answer": text_answer,
            "display_order": q.display_order,
        })

    sections_list = []
    for sec_num in sorted(sections_dict.keys()):
        sec_data = sections_dict[sec_num]
        sec_scores = sec_data["star_scores"]
        avg_sec_score = round(sum(sec_scores) / len(sec_scores), 2) if sec_scores else None
        sections_list.append({
            "section_number": sec_num,
            "section_title": sec_data["section_title"],
            "average_score": avg_sec_score,
            "questions": sec_data["questions"],
        })

    overall_percentage = (
        round((survey.average_score / 5.0) * 100) if survey.average_score is not None else None
    )

    return {
        "response_id": survey.id,
        "survey_id": survey.id,
        "survey_code": survey.survey_code,
        "client_name": survey.client.name if survey.client else "Client",
        "client_contact_name": survey.client_contact_name,
        "client_contact_email": survey.client_contact_email,
        "project_name": survey.project.name if survey.project else "Project",
        "project_code": survey.project.project_code if survey.project else "",
        "phase": survey.phase,
        "status": survey.status,
        "submission_date": survey.completed_at,
        "overall_score": survey.average_score,
        "overall_percentage": overall_percentage,
        "sections": sections_list,
        "additional_comments": additional_comments,
    }

def send_survey_response_followup(db: Session, survey_id: int, custom_message: Optional[str] = None) -> dict:
    """Manually send a follow-up email to a client regarding their completed survey response."""
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    if not survey.client_contact_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No client contact email recorded for this survey.")

    from app.services.email_service import send_response_followup_email
    result = send_response_followup_email(
        recipient_email=survey.client_contact_email,
        recipient_name=survey.client_contact_name or "Client Stakeholder",
        project_name=survey.project.name if survey.project else "Project",
        client_name=survey.client.name if survey.client else "Client",
        phase=survey.phase,
        average_score=survey.average_score,
        custom_message=custom_message,
    )
    return result

def send_survey_reminder(db: Session, survey_id: int) -> Survey:
    """Send follow-up reminder email for an unanswered survey."""
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")

    if survey.status == "Completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Survey has already been completed by the client.")

    if not survey.client_contact_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Survey has not been dispatched to a client contact yet.")

    from app.services.email_service import send_survey_reminder_email
    send_survey_reminder_email(
        recipient_email=survey.client_contact_email,
        recipient_name=survey.client_contact_name or "Client Stakeholder",
        survey_code=survey.survey_code,
        project_name=survey.project.name if survey.project else "Project",
        client_name=survey.client.name if survey.client else "Client",
        phase=survey.phase,
        survey_token=survey.unique_token,
    )

    survey.followup_sent_at = datetime.utcnow()
    db.commit()
    db.refresh(survey)
    invalidate_surveys_cache()
    return survey

def check_and_trigger_automated_followups(db: Session, threshold_days: int = 7) -> dict:
    """
    Scans all pending sent surveys. If days since sent_at >= threshold_days and
    no reminder has been sent in the last 7 days, automatically triggers a reminder.
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
            if survey.followup_sent_at:
                days_since_last_followup = (now - survey.followup_sent_at).days
                if days_since_last_followup < 7:
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
