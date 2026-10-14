from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base import Base

class Survey(Base):
    """
    Survey model representing a CSAT survey configured for a client project phase.
    Statuses: Draft -> Pending Approval -> Approved (or Rejected with comment) -> Sent -> Completed
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

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    client = relationship("Client", lazy="joined")
    project = relationship("Project", lazy="joined")
    creator = relationship("User", foreign_keys=[creator_id], lazy="joined")
    reviewer = relationship("User", foreign_keys=[reviewer_id], lazy="joined")
    questions = relationship("SurveyQuestion", back_populates="survey", cascade="all, delete-orphan", order_by="SurveyQuestion.section_number, SurveyQuestion.display_order")


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
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship back to Survey
    survey = relationship("Survey", back_populates="questions")
