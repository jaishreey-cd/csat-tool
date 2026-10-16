from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class QuestionTemplateBase(BaseModel):
    section_number: int
    section_title: str
    question_text: str
    response_type: str = "star_rating"  # 'star_rating' | 'free_text'
    applicable_phases: str = "ALL"       # 'ALL' or comma-separated list like 'Weekly,Monthly'
    display_order: int = 0

class QuestionTemplateCreate(QuestionTemplateBase):
    pass

class QuestionTemplateUpdate(BaseModel):
    section_number: Optional[int] = None
    section_title: Optional[str] = None
    question_text: Optional[str] = None
    response_type: Optional[str] = None
    applicable_phases: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None

class QuestionTemplateResponse(QuestionTemplateBase):
    id: int
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class QuestionListResponse(BaseModel):
    questions: List[QuestionTemplateResponse]
    total: int
