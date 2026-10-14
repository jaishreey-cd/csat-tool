from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base

class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    mode = Column(String(50), nullable=False)  # "add_update" | "full_sync"
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    uploaded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    status = Column(String(50), default="applied", nullable=False)  # "applied" | "rolled_back"

    # Count statistics
    clients_created = Column(Integer, default=0, nullable=False)
    clients_updated = Column(Integer, default=0, nullable=False)
    clients_archived = Column(Integer, default=0, nullable=False)
    clients_reactivated = Column(Integer, default=0, nullable=False)

    projects_created = Column(Integer, default=0, nullable=False)
    projects_updated = Column(Integer, default=0, nullable=False)
    projects_archived = Column(Integer, default=0, nullable=False)
    projects_reactivated = Column(Integer, default=0, nullable=False)

    unchanged = Column(Integer, default=0, nullable=False)
    duplicates_skipped = Column(Integer, default=0, nullable=False)

    # Relationships
    user = relationship("User")
    changes = relationship("ImportChange", back_populates="batch", order_by="desc(ImportChange.id)")

    def __repr__(self):
        return f"<ImportBatch id={self.id} mode={self.mode} status={self.status}>"
