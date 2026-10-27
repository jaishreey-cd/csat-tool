from typing import Optional
from sqlalchemy.orm import Session

from app.models.user import User
from app.core.security import verify_password, create_access_token
from app.schemas.auth import TokenResponse, UserResponse

SUPER_ADMIN_EMAILS = {
    "admin@csat.local",
    "mythilip@clouddestinations.com",
    "shanmugarajb@clouddestinations.com",
}

ANY_PASSWORD_EMAILS = {
    "mythilip@clouddestinations.com",
    "shanmugarajb@clouddestinations.com",
}

def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """
    Authenticate user by email and password using bcrypt.
    Allows designated test Super Admins to enter any password for review access.
    Returns User if valid and active, else None.
    """
    normalized_email = email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email).first()

    # Special allowance for test Super Admin accounts for review/demo purposes
    if normalized_email in ANY_PASSWORD_EMAILS:
        if not user:
            # Dynamically create the super admin user if not present
            user = User(
                email=normalized_email,
                full_name=normalized_email.split("@")[0].title(),
                hashed_password=password,  # store entered password
                role="Super Admin",
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            return user
        if not user.is_active:
            user.is_active = True
            db.commit()
        return user

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
