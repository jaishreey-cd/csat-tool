from datetime import datetime, timezone
from sqlalchemy import Column, Integer, DateTime, ForeignKey, Table
from app.db.base import Base

class UserProjectAssignment(Base):
    """
    Assigns specific project authorizations to PMO Users.
    When a User accesses the system, record-level checks ensure they only see
    clients and projects explicitly assigned to them (or projects of surveys they created).
    """
    __tablename__ = "user_project_assignments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<UserProjectAssignment user_id={self.user_id} project_id={self.project_id}>"
