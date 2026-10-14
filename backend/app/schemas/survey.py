from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field

class QuestionCreate(BaseModel):
    section_number: int = Field(..., ge=1, le=6)
    section_title: str
    question_text: str
    response_type: str = "star_rating"  # 'star_rating' | 'free_text'
    is_custom: bool = False
    display_order: int = 0

class SurveyCreate(BaseModel):
    client_id: int
    project_id: int
    phase: str
    questions: List[QuestionCreate]

class SurveyQuestionResponse(BaseModel):
    id: int
    survey_id: int
    section_number: int
    section_title: str
    question_text: str
    response_type: str
    is_custom: bool
    display_order: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UserSimple(BaseModel):
    id: int
    email: str
    full_name: str

    model_config = ConfigDict(from_attributes=True)

class ClientSimple(BaseModel):
    id: int
    client_code: str
    name: str

    model_config = ConfigDict(from_attributes=True)

class ProjectSimple(BaseModel):
    id: int
    project_code: str
    name: str

    model_config = ConfigDict(from_attributes=True)

class SurveyResponse(BaseModel):
    id: int
    survey_code: str
    client_id: int
    project_id: int
    phase: str
    status: str
    creator_id: int
    reviewer_id: Optional[int] = None
    rejection_comment: Optional[str] = None
    unique_token: Optional[str] = None
    client_contact_name: Optional[str] = None
    client_contact_email: Optional[str] = None
    sent_at: Optional[datetime] = None
    followup_sent_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    client: Optional[ClientSimple] = None
    project: Optional[ProjectSimple] = None
    creator: Optional[UserSimple] = None
    reviewer: Optional[UserSimple] = None
    questions: List[SurveyQuestionResponse] = []

    model_config = ConfigDict(from_attributes=True)

class SurveyListResponse(BaseModel):
    surveys: List[SurveyResponse]
    total: int
