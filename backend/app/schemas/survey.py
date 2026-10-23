import re
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field, field_validator

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

    @field_validator("client_contact_email")
    @classmethod
    def validate_contact_email(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip():
            return v.strip()
        return v

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

    @field_validator("client_contact_email")
    @classmethod
    def validate_contact_email(cls, v: str) -> str:
        if v:
            return v.strip()
        return v

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

    response_status: str = "awaiting_response"
    response_id: Optional[int] = None

    client: Optional[ClientSimple] = None
    project: Optional[ProjectSimple] = None
    creator: Optional[UserSimple] = None
    questions: List[SurveyQuestionResponse] = []
    email_dispatch_result: Optional[Dict[str, Any]] = None

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

class QuestionAnswerDetail(BaseModel):
    question_id: int
    question_text: str
    response_type: str
    rating_score: Optional[int] = None
    text_answer: Optional[str] = None
    display_order: int = 0

    model_config = ConfigDict(from_attributes=True)

class SectionResponseDetail(BaseModel):
    section_number: int
    section_title: str
    average_score: Optional[float] = None
    questions: List[QuestionAnswerDetail] = []

    model_config = ConfigDict(from_attributes=True)

class ClientResponseDetail(BaseModel):
    response_id: int
    survey_id: int
    survey_code: str
    client_name: str
    client_contact_name: Optional[str] = None
    client_contact_email: Optional[str] = None
    project_name: str
    project_code: str
    phase: str
    status: str
    submission_date: datetime
    overall_score: Optional[float] = None
    overall_percentage: Optional[int] = None
    sections: List[SectionResponseDetail] = []
    additional_comments: List[str] = []

    model_config = ConfigDict(from_attributes=True)
