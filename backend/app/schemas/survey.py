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
    client_contact_name: Optional[str] = None
    client_contact_email: Optional[str] = None

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

class SurveyDispatch(BaseModel):
    client_contact_name: str
    client_contact_email: str

class SurveyResponse(BaseModel):
    id: int
    survey_code: str
    client_id: int
    project_id: int
    phase: str
    status: str
    creator_id: int
    unique_token: Optional[str] = None
    client_contact_name: Optional[str] = None
    client_contact_email: Optional[str] = None
    sent_at: Optional[datetime] = None
    followup_sent_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    average_score: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    client: Optional[ClientSimple] = None
    project: Optional[ProjectSimple] = None
    creator: Optional[UserSimple] = None
    questions: List[SurveyQuestionResponse] = []

    model_config = ConfigDict(from_attributes=True)

class SurveyListResponse(BaseModel):
    surveys: List[SurveyResponse]
    total: int

class PublicQuestionResponse(BaseModel):
    id: int
    section_number: int
    section_title: str
    question_text: str
    response_type: str
    display_order: int

    model_config = ConfigDict(from_attributes=True)

class PublicSurveyDetail(BaseModel):
    survey_code: str
    unique_token: str
    client_name: str
    project_name: str
    project_code: str
    phase: str
    status: str
    client_contact_name: Optional[str] = None
    completed_at: Optional[datetime] = None
    average_score: Optional[float] = None
    questions: List[PublicQuestionResponse]

class AnswerItem(BaseModel):
    question_id: int
    rating_score: Optional[int] = None
    text_answer: Optional[str] = None

class PublicSurveySubmission(BaseModel):
    answers: List[AnswerItem]
