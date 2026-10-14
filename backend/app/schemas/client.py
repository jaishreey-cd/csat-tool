from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class ProjectResponse(BaseModel):
    id: int
    project_code: str
    name: str
    client_id: int
    team_name: Optional[str] = None
    is_active: bool
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ClientResponse(BaseModel):
    id: int
    client_code: str
    name: str
    is_active: bool
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    projects: List[ProjectResponse] = []
    project_count: int = 0

    model_config = ConfigDict(from_attributes=True)

class ClientListResponse(BaseModel):
    clients: List[ClientResponse]
    total_clients: int
    total_projects: int
    clients_data_last_updated: Optional[datetime] = None
