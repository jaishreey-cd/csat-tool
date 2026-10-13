from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr

# --- Auth Schemas ---
class UserLogin(BaseModel):
    username_or_email: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user: UserResponse

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

# --- Client Schemas ---
class ClientResponse(BaseModel):
    id: int
    client_id: str
    client_name: str
    partner_name: Optional[str] = None
    partner_id: Optional[str] = None
    project_count: Optional[int] = 0

    class Config:
        from_attributes = True

# --- Project Schemas ---
class ProjectResponse(BaseModel):
    id: int
    project_id: str
    project_name: str
    status: Optional[str] = None
    sub_status: Optional[str] = None
    type: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    resource_count: Optional[int] = 0
    resource_names: Optional[str] = None
    client_name: Optional[str] = None
    partner_name: Optional[str] = None
    billable: Optional[str] = None
    client_id: Optional[str] = None
    department_name: Optional[str] = None
    project_manager_name: Optional[str] = None

    class Config:
        from_attributes = True

# --- Stats Schema ---
class OverviewStats(BaseModel):
    total_clients: int
    total_projects: int
    in_progress_projects: int
    completed_projects: int
    on_hold_projects: int
    total_users: int
