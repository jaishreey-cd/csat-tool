from typing import Optional
from sqlalchemy.orm import Session

from app.models.user import User
from app.core.security import verify_password, create_access_token
from app.schemas.auth import TokenResponse, UserResponse

def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """
    Authenticate user by email and password using bcrypt.
    Returns User if valid and active, else None.
    """
    normalized_email = email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email).first()
    if not user:
        return None
    if not user.is_active:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

def build_token_response(user: User) -> TokenResponse:
    """Build signed JWT access token and UserResponse without password hash."""
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )
