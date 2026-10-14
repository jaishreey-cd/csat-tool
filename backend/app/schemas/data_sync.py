from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, ConfigDict

SyncMode = Literal["add_update", "full_sync"]

class RowError(BaseModel):
    row: int
    field: str
    message: str

class InFileDuplicate(BaseModel):
    row: int
    project_code: str
    message: str

class FieldChange(BaseModel):
    field: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None

class EntityDiff(BaseModel):
    entity_type: str  # "client" | "project"
    entity_code: str
    name: str
    changes: List[FieldChange] = []

class DiffCategory(BaseModel):
    count: int = 0
    items: List[EntityDiff] = []

class DiffSummary(BaseModel):
    new_clients: DiffCategory = DiffCategory()
    updated_clients: DiffCategory = DiffCategory()
    unchanged_clients: int = 0
    reactivated_clients: DiffCategory = DiffCategory()
    would_be_archived_clients: DiffCategory = DiffCategory()

    new_projects: DiffCategory = DiffCategory()
    updated_projects: DiffCategory = DiffCategory()
    unchanged_projects: int = 0
    reactivated_projects: DiffCategory = DiffCategory()
    would_be_archived_projects: DiffCategory = DiffCategory()

class PreviewResponse(BaseModel):
    filename: str
    mode: str
    total_rows: int
    valid_rows: int
    errors: List[RowError] = []
    in_file_duplicates: List[InFileDuplicate] = []
    diff_summary: DiffSummary
    can_confirm: bool

class ConfirmResponse(BaseModel):
    batch_id: int
    mode: str
    status: str
    clients_created: int
    clients_updated: int
    clients_archived: int
    clients_reactivated: int
    projects_created: int
    projects_updated: int
    projects_archived: int
    projects_reactivated: int
    unchanged: int
    duplicates_skipped: int
    clients_data_last_updated: datetime
    message: str

class ImportBatchItem(BaseModel):
    id: int
    filename: str
    mode: str
    status: str
    uploaded_at: datetime
    uploaded_by_email: Optional[str] = None
    clients_created: int
    clients_updated: int
    clients_archived: int
    clients_reactivated: int
    projects_created: int
    projects_updated: int
    projects_archived: int
    projects_reactivated: int
    unchanged: int
    duplicates_skipped: int

    model_config = ConfigDict(from_attributes=True)

class RollbackResponse(BaseModel):
    batch_id: int
    status: str
    message: str
    clients_data_last_updated: Optional[datetime] = None
