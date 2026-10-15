import time
from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import decode_token

# Bearer token scheme
security = HTTPBearer(auto_error=False)

# In-memory authentication cache: {user_key: (user_dict, expire_timestamp)}
_user_auth_cache: dict[str, tuple[dict, float]] = {}
_USER_CACHE_TTL = 60.0  # seconds

def get_db() -> Generator[Session, None, None]:
    """Dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Validate the Bearer JWT and return the current active User.
    All users are admins - no role checks.
    Uses in-memory cache to avoid repeated database lookups on every API call.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_identifier = payload.get("sub")
    if not user_identifier:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    cache_key = str(user_identifier).lower()
    now = time.time()

    # Check cache first
    if cache_key in _user_auth_cache:
        user_dict, expire_at = _user_auth_cache[cache_key]
        if now < expire_at:
            return User(**user_dict)
        else:
            del _user_auth_cache[cache_key]

    # Query from DB if not in cache or expired
    if str(user_identifier).isdigit():
        user = db.query(User).filter(User.id == int(user_identifier)).first()
    else:
        user = db.query(User).filter(User.email == str(user_identifier).lower()).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account is deactivated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Store in cache
    _user_auth_cache[cache_key] = (
        {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "hashed_password": user.hashed_password,
            "is_active": user.is_active,
            "created_at": user.created_at,
        },
        now + _USER_CACHE_TTL
    )

    return user
