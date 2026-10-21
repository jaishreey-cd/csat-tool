from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base

class AuditLog(Base):
    """
    Administrative and security audit record log.
    Captures role assignments, permissions modifications, data imports,
    category edits, question additions, and sensitive actions.
    Viewable exclusively by PMO Admin.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_email = Column(String(255), nullable=False)
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(100), nullable=False, index=True)
    resource_id = Column(String(100), nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Relationship to acting User
    user = relationship("User", lazy="joined")

    def __repr__(self):
        return f"<AuditLog id={self.id} actor='{self.actor_email}' action='{self.action}' at={self.created_at}>"
