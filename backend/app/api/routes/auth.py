from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.core.security import hash_password
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse, UpdateUserRoleRequest, CreateUserRequest
from app.services.auth_service import authenticate_user, build_token_response

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user with email and password.
    Returns signed Bearer JWT and user profile.
    Only users allowed by admin (is_active=True) can access.
    """
    normalized_email = credentials.email.strip().lower()
    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user and not existing_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Your account is pending administrator authorization.",
        )

    user = authenticate_user(db, email=credentials.email, password=credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return build_token_response(user)

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """
    Protected route: returns current authenticated user profile.
    """
    return UserResponse.model_validate(current_user)

@router.get("/users", response_model=List[UserResponse])
def list_system_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all registered users and their permission roles."""
    users = db.query(User).order_by(User.id).all()
    return [UserResponse.model_validate(u) for u in users]

@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_authorized_user(
    payload: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Enable administrators to grant access to users by entering their email and role (PMO/Admin)."""
    normalized_email = payload.email.strip().lower()
    existing = db.query(User).filter(User.email == normalized_email).first()
    if existing:
        existing.role = payload.role
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        return UserResponse.model_validate(existing)

    new_user = User(
        email=normalized_email,
        full_name=payload.full_name or normalized_email.split("@")[0].title(),
        hashed_password=hash_password(payload.password or "Password123!"),
        role=payload.role,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return UserResponse.model_validate(new_user)

@router.put("/users/{user_id}/permissions", response_model=UserResponse)
def update_user_permissions(
    user_id: int,
    payload: UpdateUserRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Enable administrators to grant/modify permissions and roles for users."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    target_user.role = payload.role
    if payload.is_active is not None:
        target_user.is_active = payload.is_active
    db.commit()
    db.refresh(target_user)
    return UserResponse.model_validate(target_user)

