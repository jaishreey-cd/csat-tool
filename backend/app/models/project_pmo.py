from datetime import datetime, timezone
from sqlalchemy import Column, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.db.base import Base

class ProjectPmoAssignment(Base):
    __tablename__ = "project_pmo_assignments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    project = relationship("Project", back_populates="pmo_assignments")
    user = relationship("User", lazy="joined")

    def __repr__(self):
        return f"<ProjectPmoAssignment project_id={self.project_id} user_id={self.user_id}>"
