from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
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

router = APIRouter(prefix="/questions", tags=["Questions"])

@router.get("", response_model=QuestionListResponse)
def list_questions(
    section: Optional[int] = Query(None, description="Filter by section number 1-6"),
    phase: Optional[str] = Query(None, description="Filter by applicable phase (Weekly, Monthly, Mid-Project, etc.)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List questions in the question bank, with optional section or phase filter."""
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
    current_user: User = Depends(get_current_user),
):
    """Create a new independent question template in the question bank."""
    return create_question(db, question_in)

@router.put("/{question_id}", response_model=QuestionTemplateResponse)
def edit_question(
    question_id: int,
    question_in: QuestionTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update question text, section, or applicable phases."""
    return update_question(db, question_id, question_in)

@router.delete("/{question_id}")
def remove_question_permanently(
    question_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete a question from the database."""
    return delete_question(db, question_id)
