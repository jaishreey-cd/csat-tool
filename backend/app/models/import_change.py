from sqlalchemy import Column, Integer, String, JSON, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base

class ImportChange(Base):
    __tablename__ = "import_changes"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False)  # "client" | "project"
    entity_id = Column(Integer, nullable=False, index=True)
    entity_code = Column(String(100), nullable=False)
    action = Column(String(50), nullable=False)  # "created" | "updated" | "archived" | "reactivated"
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)

    # Relationships
    batch = relationship("ImportBatch", back_populates="changes")

    def __repr__(self):
        return f"<ImportChange id={self.id} entity={self.entity_type}:{self.entity_code} action={self.action}>"
