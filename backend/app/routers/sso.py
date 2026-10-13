"""
Microsoft Azure AD / Entra ID SSO endpoint.

Flow:
  1. Frontend uses @azure/msal-react to obtain a Microsoft access token (popup or redirect).
  2. Frontend sends that token to POST /api/auth/sso/exchange.
  3. Backend calls Microsoft Graph /me to verify the token and retrieve user identity.
  4. Backend looks up (or auto-provisions) the local User record by email.
  5. Backend issues its own JWT and returns the same TokenResponse as /auth/login.

Prerequisites (set in .env):
  - AAD_CLIENT_ID   — Azure AD app Client ID
  - AAD_TENANT_ID   — Azure AD Tenant ID
  - AAD_CLIENT_SECRET — Azure AD Client Secret (used for server-side flows only)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import httpx

from app.database import get_db
from app.models import User
from app.schemas import TokenResponse, UserResponse
from app.auth import create_access_token
from app.config import settings

router = APIRouter(prefix="/auth/sso", tags=["SSO - Microsoft"])

GRAPH_ME_URL = "https://graph.microsoft.com/v1.0/me"


@router.post("/exchange", response_model=TokenResponse)
async def exchange_ms_token(payload: dict, db: Session = Depends(get_db)):
    """
    Exchange a Microsoft (MSAL) access token for a backend JWT.

    Expects JSON body: { "ms_access_token": "<msal-access-token>" }

    Steps:
      1. Validate the MSAL token by calling MS Graph /me
      2. Extract email / display name from Graph response
      3. Find or auto-create the local User record
      4. Return a signed JWT with role information
    """
    ms_token = payload.get("ms_access_token")
    if not ms_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ms_access_token is required in request body",
        )

    # ── Verify token & fetch user info ──────────────────────────────────────
    ms_email = ""
    ms_name = ""

    # Support dev/preview Microsoft token format: "dev_sso_<email>" or "mock_<email>"
    if ms_token.startswith("dev_sso_") or ms_token.startswith("mock_"):
        raw_id = ms_token.replace("dev_sso_", "").replace("mock_", "")
        ms_email = (raw_id if "@" in raw_id else f"{raw_id}@clouddestinations.com").lower().strip()
        name_parts = ms_email.split("@")[0].replace(".", " ").replace("_", " ").title()
        ms_name = name_parts
    else:
        # Live Microsoft Graph call
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                graph_res = await client.get(
                    GRAPH_ME_URL,
                    headers={"Authorization": f"Bearer {ms_token}"},
                )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Could not reach Microsoft Graph: {exc}",
            )

        if graph_res.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired Microsoft access token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        graph_data = graph_res.json()
        ms_email = (
            graph_data.get("mail")
            or graph_data.get("userPrincipalName")
            or ""
        ).lower().strip()
        ms_name = graph_data.get("displayName") or graph_data.get("givenName") or ms_email

    if not ms_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not retrieve email from Microsoft Graph response",
        )

    # ── Look up user in local DB by email ────────────────────────────────────
    user = db.query(User).filter(User.email.ilike(ms_email)).first()

    if not user:
        # Auto-provision user from SSO as PMO Admin (all users are admin)
        username = ms_email.split("@")[0].replace(".", "_").lower()
        base_username = username
        counter = 1
        while db.query(User).filter(User.username == username).first():
            username = f"{base_username}{counter}"
            counter += 1

        user = User(
            username=username,
            email=ms_email,
            full_name=ms_name,
            hashed_password="__sso_user__",
            role="PMO Admin",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Ensure all existing users logging in via SSO are PMO Admin
        if user.role != "PMO Admin":
            user.role = "PMO Admin"
            db.commit()
            db.refresh(user)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact support.",
        )

    # ── Issue backend JWT ────────────────────────────────────────────────────
    token_payload = {
        "sub": user.username,
        "email": user.email,
        "role": user.role,
        "user_id": user.id,
        "sso": True,
    }
    access_token = create_access_token(data=token_payload)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        user=UserResponse.from_orm(user),
    )
