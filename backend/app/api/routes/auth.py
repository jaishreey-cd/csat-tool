from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict, Any

from app.api.deps import get_db, get_current_user, require_admin
from app.core.config import settings
from app.models.user import User
from app.models.project import Project
from app.models.project_pmo import ProjectPmoAssignment
from app.core.security import hash_password
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    UserResponse,
    UpdateUserRoleRequest,
    CreateUserRequest,
    UserProjectsAssignRequest,
)
from app.services.auth_service import authenticate_user, build_token_response

router = APIRouter(prefix="/auth", tags=["Authentication"])

MAX_ACTIVE_ADMINS = 3
ADMIN_LIMIT_ERROR_DETAIL = (
    "Maximum of 3 Admins reached. Revoke access from an existing Admin before granting Admin access to another user."
)

def is_admin_role(role: Optional[str]) -> bool:
    """Helper to check if a given role string matches Admin (excludes Super Admin)."""
    return bool(role and role.strip().lower() == "admin")

def normalize_role(role: Optional[str]) -> str:
    """Normalize role string to standardized capitalization."""
    if not role:
        return "User"
    r = role.strip()
    if r.lower() in ("super admin", "superadmin", "sa"):
        return "Super Admin"
    if r.lower() == "admin":
        return "Admin"
    if r.lower() == "pmo":
        return "PMO"
    if r.lower() == "user":
        return "User"
    return r

def _enrich_user_response(user: User, db: Session) -> UserResponse:
    assignments = db.query(ProjectPmoAssignment).filter(ProjectPmoAssignment.user_id == user.id).all()
    project_ids = [a.project_id for a in assignments]
    projects = []
    if project_ids:
        project_records = db.query(Project).filter(Project.id.in_(project_ids)).all()
        projects = [{"id": p.id, "name": p.name, "project_code": p.project_code} for p in project_records]
    
    resp = UserResponse.model_validate(user)
    resp.assigned_project_ids = project_ids
    resp.assigned_projects = projects
    return resp

def count_active_admins(db: Session, exclude_user_id: Optional[int] = None, for_update: bool = False) -> int:
    """
    Count the number of active, authorized Admin users.
    Optionally applies row-level locking (with_for_update) for transaction concurrency protection.
    """
    query = db.query(User).filter(
        func.lower(User.role) == "admin",
        User.is_active.is_(True),
    )
    if exclude_user_id is not None:
        query = query.filter(User.id != exclude_user_id)
    if for_update:
        query = query.with_for_update()
    return query.count()

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

@router.get("/admin-count")
def get_active_admin_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Return current count of active authorized Admins and limit status."""
    active_count = count_active_admins(db)
    return {
        "active_admin_count": active_count,
        "max_admins": MAX_ACTIVE_ADMINS,
        "is_limit_reached": active_count >= MAX_ACTIVE_ADMINS,
    }

@router.get("/users", response_model=List[UserResponse])
def list_system_users(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin-only: List all registered users, roles, and their assigned projects."""
    users = db.query(User).order_by(User.id).all()
    return [_enrich_user_response(u, db) for u in users]

@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_authorized_user(
    payload: CreateUserRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """
    Enable administrators to grant access to users by entering their email, role (User/Admin),
    and assigning projects to them.
    Enforces maximum of 3 active Admin users (unlimited Users).
    """
    normalized_email = payload.email.strip().lower()
    target_role = normalize_role(payload.role)
    target_is_active = payload.is_active

    existing = db.query(User).filter(User.email == normalized_email).first()

    # If the user will be an active Admin, enforce the 3-Admin ceiling
    if is_admin_role(target_role) and target_is_active:
        is_already_active_admin = (
            existing is not None
            and is_admin_role(existing.role)
            and existing.is_active
        )
        if not is_already_active_admin:
            active_count = count_active_admins(
                db,
                exclude_user_id=existing.id if existing else None,
                for_update=True,
            )
            if active_count >= MAX_ACTIVE_ADMINS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=ADMIN_LIMIT_ERROR_DETAIL,
                )

    if existing:
        existing.role = target_role
        existing.is_active = target_is_active
        if payload.project_ids is not None:
            db.query(ProjectPmoAssignment).filter(ProjectPmoAssignment.user_id == existing.id).delete(synchronize_session=False)
            for pid in payload.project_ids:
                db.add(ProjectPmoAssignment(user_id=existing.id, project_id=pid))
        db.commit()
        db.refresh(existing)
        return _enrich_user_response(existing, db)

    new_user = User(
        email=normalized_email,
        full_name=payload.full_name or normalized_email.split("@")[0].title(),
        hashed_password=hash_password(payload.password or "Password123!"),
        role=target_role,
        is_active=target_is_active,
    )
    db.add(new_user)
    db.flush()

    if payload.project_ids:
        for pid in payload.project_ids:
            db.add(ProjectPmoAssignment(user_id=new_user.id, project_id=pid))

    db.commit()
    db.refresh(new_user)
    return _enrich_user_response(new_user, db)

@router.put("/users/{user_id}/permissions", response_model=UserResponse)
def update_user_permissions(
    user_id: int,
    payload: UpdateUserRoleRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """
    Enable administrators to grant/modify permissions and roles for users.
    Enforces maximum of 3 active Admin users.
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    target_role = normalize_role(payload.role)
    target_is_active = (
        payload.is_active if payload.is_active is not None else target_user.is_active
    )

    # If user will become an active Admin:
    if is_admin_role(target_role) and target_is_active:
        was_already_active_admin = is_admin_role(target_user.role) and target_user.is_active
        if not was_already_active_admin:
            active_count = count_active_admins(
                db,
                exclude_user_id=target_user.id,
                for_update=True,
            )
            if active_count >= MAX_ACTIVE_ADMINS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=ADMIN_LIMIT_ERROR_DETAIL,
                )

    target_user.role = target_role
    if payload.is_active is not None:
        target_user.is_active = payload.is_active
    db.commit()
    db.refresh(target_user)
    return _enrich_user_response(target_user, db)

@router.put("/users/{user_id}/projects", response_model=UserResponse)
def assign_user_projects(
    user_id: int,
    payload: UserProjectsAssignRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """
    Assign or update projects assigned to a user (Admin/SA only).
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Clear existing assignments
    db.query(ProjectPmoAssignment).filter(ProjectPmoAssignment.user_id == user_id).delete(synchronize_session=False)

    # Add new project assignments
    for pid in payload.project_ids:
        db.add(ProjectPmoAssignment(user_id=user_id, project_id=pid))

    db.commit()
    db.refresh(target_user)
    return _enrich_user_response(target_user, db)

