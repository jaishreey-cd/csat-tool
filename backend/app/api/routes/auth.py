from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from typing import List
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse, UpdateUserRoleRequest
from app.services.auth_service import authenticate_user, build_token_response

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate user with email and password.
    Returns signed Bearer JWT and user profile.
    Generic 401 'Invalid email or password' returned on any failure.
    """
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

