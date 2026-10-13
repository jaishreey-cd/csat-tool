from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models import User
from app.schemas import UserLogin, TokenResponse, UserResponse
from app.auth import verify_password, create_access_token, get_current_user, require_role

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate user with username or email and password.
    Returns signed JWT access token with role information.
    """
    identifier = credentials.username_or_email.strip().lower()
    raw_password = credentials.password

    # Lookup by username (case-insensitive) or email
    user = db.query(User).filter(
        or_(
            User.username.ilike(identifier),
            User.email.ilike(identifier)
        )
    ).first()

    if not user or not verify_password(raw_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact an administrator."
        )

    # Generate JWT token with username and role in payload
    token_payload = {
        "sub": user.username,
        "email": user.email,
        "role": user.role,
        "user_id": user.id
    }
    access_token = create_access_token(data=token_payload)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        user=UserResponse.from_orm(user)
    )

@router.get("/me", response_model=UserResponse)
def get_authenticated_user_profile(current_user: User = Depends(get_current_user)):
    """
    Protected route: Get current authenticated user profile.
    Requires valid JWT token in Authorization: Bearer <token>.
    """
    return current_user

@router.get("/admin-only")
def admin_only_test_route(current_user: User = Depends(require_role(["PMO Admin"]))):
    """
    Protected route: Accessible strictly by PMO Admin role.
    PMO User will receive 403 Forbidden.
    """
    return {
        "status": "success",
        "message": f"Hello {current_user.full_name or current_user.username}! You have PMO Admin privileges.",
        "allowed_actions": [
            "Import and re-sync Utiliza datasets",
            "Create & configure CSAT surveys",
            "Select clients & assign survey parameters",
            "Manage users and role permissions"
        ]
    }

@router.get("/user-only")
def user_and_admin_test_route(current_user: User = Depends(require_role(["PMO Admin", "PMO User"]))):
    """
    Protected route: Accessible to both PMO Admin and PMO User.
    Unauthenticated requests will receive 401 Unauthorized.
    """
    return {
        "status": "success",
        "message": f"Access granted for role '{current_user.role}'.",
        "user": current_user.username
    }
