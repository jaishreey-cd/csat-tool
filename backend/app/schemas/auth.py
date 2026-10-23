from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator

class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        s = v.strip().lower()
        if not s or "@" not in s or "." not in s.split("@")[-1]:
            raise ValueError("Invalid email format")
        return s

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    role: str = "Admin"
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class UpdateUserRoleRequest(BaseModel):
    role: str
    is_active: Optional[bool] = None

class CreateUserRequest(BaseModel):
    email: str
    password: Optional[str] = "Password123!"
    full_name: Optional[str] = None
    role: str = "User"
    is_active: bool = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None
