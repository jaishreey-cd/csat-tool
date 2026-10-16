from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from app.db.base import Base

class QuestionTemplate(Base):
    """
    Independent question bank entity managed independently of individual surveys.
    Can be assigned to survey phases and sections.
    """
    __tablename__ = "question_templates"

    id = Column(Integer, primary_key=True, index=True)
    section_number = Column(Integer, nullable=False, index=True)
    section_title = Column(String(150), nullable=False)
    question_text = Column(Text, nullable=False)
    response_type = Column(String(30), default="star_rating", nullable=False)  # 'star_rating' | 'free_text'
    applicable_phases = Column(String(255), default="ALL", nullable=False)    # 'ALL' or comma-separated list
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    def __repr__(self):
        return f"<QuestionTemplate id={self.id} sec={self.section_number} text={self.question_text[:30]}>"
