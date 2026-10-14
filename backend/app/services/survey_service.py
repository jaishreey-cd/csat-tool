import uuid
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.survey import Survey, SurveyQuestion
from app.models.client import Client
from app.models.project import Project
from app.schemas.survey import SurveyCreate

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
        status="Draft",
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
    return survey

def get_surveys(
    db: Session,
    status_filter: Optional[str] = None,
    client_id: Optional[int] = None,
    project_id: Optional[int] = None,
) -> List[Survey]:
    """List surveys with optional filters."""
    query = db.query(Survey)
    if status_filter:
        query = query.filter(Survey.status == status_filter)
    if client_id:
        query = query.filter(Survey.client_id == client_id)
    if project_id:
        query = query.filter(Survey.project_id == project_id)

    return query.order_by(desc(Survey.created_at)).all()

def get_survey_by_id(db: Session, survey_id: int) -> Survey:
    """Fetch single survey with joined relationships."""
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found")
    return survey
