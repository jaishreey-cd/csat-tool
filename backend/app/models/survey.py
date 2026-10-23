from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Float
from sqlalchemy.orm import relationship

from app.db.base import Base

def utc_now():
    return datetime.now(timezone.utc)

class Survey(Base):
    """
    Survey model representing a CSAT survey configured for a client project phase.
    Statuses: Draft -> Ready -> Sent -> Completed
    """
    __tablename__ = "surveys"

    id = Column(Integer, primary_key=True, index=True)
    survey_code = Column(String(50), unique=True, index=True, nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False)
    phase = Column(String(50), nullable=False)
    status = Column(String(30), default="Draft", index=True, nullable=False)

    # Maker-Checker user audit
    creator_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    rejection_comment = Column(Text, nullable=True)

    # Public client dispatch details
    unique_token = Column(String(100), unique=True, index=True, nullable=True)
    client_contact_name = Column(String(100), nullable=True)
    client_contact_email = Column(String(255), nullable=True)
    sent_at = Column(DateTime, nullable=True)
    followup_sent_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    average_score = Column(Float, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    client = relationship("Client", lazy="joined")
    project = relationship("Project", lazy="joined")
    creator = relationship("User", foreign_keys=[creator_id], lazy="joined")
    reviewer = relationship("User", foreign_keys=[reviewer_id], lazy="joined")
    questions = relationship("SurveyQuestion", back_populates="survey", cascade="all, delete-orphan", order_by="SurveyQuestion.section_number, SurveyQuestion.display_order")
    answers = relationship("SurveyAnswer", back_populates="survey", cascade="all, delete-orphan")

    @property
    def response_status(self) -> str:
        """Determines client response status based on completed_at and presence of answers."""
        if self.status == "Completed" and self.completed_at is not None:
            if self.answers:
                return "responded"
        return "awaiting_response"

    @property
    def response_id(self) -> Optional[int]:
        """Returns the response/survey ID when a completed response exists, else None."""
        if self.status == "Completed" and self.completed_at is not None:
            if self.answers:
                return self.id
        return None


class SurveyQuestion(Base):
    """
    Individual question belonging to a Survey.
    Sections 1-5: star_rating (1 to 5)
    Section 6: free_text (descriptive answers)
    """
    __tablename__ = "survey_questions"

    id = Column(Integer, primary_key=True, index=True)
    survey_id = Column(Integer, ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    section_number = Column(Integer, nullable=False)
    section_title = Column(String(150), nullable=False)
    question_text = Column(Text, nullable=False)
    response_type = Column(String(30), default="star_rating", nullable=False)  # 'star_rating' | 'free_text'
    is_custom = Column(Boolean, default=False, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Relationship back to Survey
    survey = relationship("Survey", back_populates="questions")


class SurveyAnswer(Base):
    """
    Individual response submitted by a client for a question.
    """
    __tablename__ = "survey_answers"

    id = Column(Integer, primary_key=True, index=True)
    survey_id = Column(Integer, ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(Integer, ForeignKey("survey_questions.id", ondelete="CASCADE"), nullable=False)
    rating_score = Column(Integer, nullable=True)  # 1 to 5 for star rating questions
    text_answer = Column(Text, nullable=True)       # for section 6 qualitative questions
    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Relationships
    survey = relationship("Survey", back_populates="answers")
    question = relationship("SurveyQuestion")
