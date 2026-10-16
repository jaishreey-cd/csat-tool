from datetime import timedelta
import pytest
from app.core.security import create_access_token

def test_login_success(client, test_user):
    """Test successful login with correct email and password."""
    response = client.post(
        "/api/auth/login",
        json={"email": "testadmin@example.com", "password": "Password123!"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "testadmin@example.com"
    assert "hashed_password" not in data["user"]
    assert "role" in data["user"]
    assert data["user"]["role"] in ["Admin", "PMO", "Viewer"]

def test_login_wrong_password_401(client, test_user):
    """Test login failure with wrong password returns 401 with generic message."""
    response = client.post(
        "/api/auth/login",
        json={"email": "testadmin@example.com", "password": "WrongPassword!"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"

def test_login_unknown_email_401(client):
    """Test login failure with non-existent email returns 401 with generic message."""
    response = client.post(
        "/api/auth/login",
        json={"email": "unknown@example.com", "password": "Password123!"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"

def test_auth_me_no_token_401(client):
    """Test /auth/me without authorization header returns 401."""
    response = client.get("/api/auth/me")
    assert response.status_code == 401

def test_auth_me_expired_token_401(client, test_user):
    """Test /auth/me with an expired token returns 401."""
    expired_token = create_access_token(
        data={"sub": str(test_user.id), "email": test_user.email},
        expires_delta=timedelta(seconds=-10)
    )
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert response.status_code == 401

def test_auth_me_tampered_token_401(client):
    """Test /auth/me with a tampered token returns 401."""
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid.fake.token"}
    )
    assert response.status_code == 401

def test_clients_requires_auth(client):
    """Test /clients endpoint requires valid authentication."""
    response = client.get("/api/clients")
    assert response.status_code == 401
