from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    project_code = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    client_id = Column(
        Integer,
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    team_name = Column(String(255), nullable=True)
    status = Column(String(50), default="Not Started", nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    client = relationship("Client", back_populates="projects")

    def __repr__(self):
        return f"<Project id={self.id} code={self.project_code} name={self.name}>"
