from typing import Optional
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_admin
from app.models.user import User
from app.models.question_template import QuestionTemplate
from app.schemas.question import (
    QuestionTemplateCreate,
    QuestionTemplateUpdate,
    QuestionTemplateResponse,
    QuestionListResponse,
)
from app.services.question_service import (
    get_questions,
    get_question_by_id,
    create_question,
    update_question,
    delete_question,
)
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/questions", tags=["Questions"])

@router.get("", response_model=QuestionListResponse)
def list_questions(
    section: Optional[int] = Query(None, description="Filter by section number 1-6"),
    phase: Optional[str] = Query(None, description="Filter by applicable phase (Weekly, Monthly, Mid-Project, etc.)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List questions in the question bank, with optional section or phase filter. Available to all authenticated PMO users."""
    questions = get_questions(db, section_number=section, phase=phase)
    return QuestionListResponse(questions=questions, total=len(questions))

@router.get("/{question_id}", response_model=QuestionTemplateResponse)
def get_single_question(
    question_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve details of a question in the bank."""
    return get_question_by_id(db, question_id)

@router.post("", response_model=QuestionTemplateResponse, status_code=status.HTTP_201_CREATED)
def add_new_question(
    question_in: QuestionTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Create a new question template in the question bank.
    Restricted to Admin only (User returns 403 Forbidden).
    """
    created = create_question(db, question_in)
    log_audit_event(
        db=db,
        user_id=current_user.id,
        actor_email=current_user.email,
        action="CREATE_QUESTION",
        resource_type="QUESTION_TEMPLATE",
        resource_id=created.id,
        details=f"Created question in section {created.section_number}: {created.question_text[:60]}...",
    )
    return created

@router.put("/{question_id}", response_model=QuestionTemplateResponse)
def edit_question(
    question_id: int,
    question_in: QuestionTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Update question text, section, or applicable phases.
    Restricted to Admin only (User returns 403 Forbidden).
    """
    updated = update_question(db, question_id, question_in)
    log_audit_event(
        db=db,
        user_id=current_user.id,
        actor_email=current_user.email,
        action="UPDATE_QUESTION",
        resource_type="QUESTION_TEMPLATE",
        resource_id=updated.id,
        details=f"Updated question #{updated.id}",
    )
    return updated

@router.patch("/{question_id}/toggle", response_model=QuestionTemplateResponse)
def toggle_question_active(
    question_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Activate or deactivate a question template.
    Restricted to Admin only (User returns 403 Forbidden).
    """
    question = db.query(QuestionTemplate).filter(QuestionTemplate.id == question_id).first()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question template not found")
    
    question.is_active = not question.is_active
    db.commit()
    db.refresh(question)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        actor_email=current_user.email,
        action="TOGGLE_QUESTION",
        resource_type="QUESTION_TEMPLATE",
        resource_id=question.id,
        details=f"{'Activated' if question.is_active else 'Deactivated'} question #{question.id}",
    )
    return question

@router.delete("/{question_id}")
def remove_question_permanently(
    question_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Permanently delete or deactivate a question.
    Restricted to Admin only (User returns 403 Forbidden).
    """
    res = delete_question(db, question_id)
    log_audit_event(
        db=db,
        user_id=current_user.id,
        actor_email=current_user.email,
        action="DELETE_QUESTION",
        resource_type="QUESTION_TEMPLATE",
        resource_id=question_id,
        details=f"Deleted question #{question_id}",
    )
    return res
