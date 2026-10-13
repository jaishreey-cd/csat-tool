import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_login_admin_success():
    response = client.post("/api/auth/login", json={
        "username_or_email": "admin@pmo.com",
        "password": "Password@123"
    })
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "PMO Admin"
    assert data["user"]["email"] == "admin@pmo.com"
    print("[PASS] TEST 1: Admin login succeeded with valid JWT and role 'PMO Admin'.")
    return data["access_token"]

def test_login_user_success():
    response = client.post("/api/auth/login", json={
        "username_or_email": "pmo_user",
        "password": "Password@123"
    })
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "PMO User"
    assert data["user"]["username"] == "pmo_user"
    print("[PASS] TEST 2: PMO User login succeeded with valid JWT and role 'PMO User'.")
    return data["access_token"]

def test_login_invalid_credentials():
    response = client.post("/api/auth/login", json={
        "username_or_email": "admin@pmo.com",
        "password": "IncorrectPassword"
    })
    assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    print("[PASS] TEST 3: Invalid credentials rejected with HTTP 401 Unauthorized.")

def test_unauthenticated_protected_route():
    response = client.get("/api/auth/me")
    assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    print("[PASS] TEST 4: Unauthenticated access rejected with HTTP 401.")

def test_role_based_access_admin_route(admin_token, user_token):
    # Admin accesses admin-only route -> 200 OK
    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    res_admin = client.get("/api/auth/admin-only", headers=headers_admin)
    assert res_admin.status_code == 200, f"Admin should have access: {res_admin.text}"
    print("[PASS] TEST 5a: PMO Admin allowed on /api/auth/admin-only (200 OK).")

    # User accesses admin-only route -> 403 Forbidden
    headers_user = {"Authorization": f"Bearer {user_token}"}
    res_user = client.get("/api/auth/admin-only", headers=headers_user)
    assert res_user.status_code == 403, f"User should be forbidden: {res_user.text}"
    print("[PASS] TEST 5b: PMO User forbidden on /api/auth/admin-only (403 Forbidden).")

def test_stats_and_data_routes(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    res_stats = client.get("/api/data/stats", headers=headers)
    assert res_stats.status_code == 200
    stats = res_stats.json()
    assert stats["total_clients"] >= 40
    assert stats["total_projects"] >= 67
    assert stats["total_users"] >= 2
    print(f"[PASS] TEST 6: Utiliza data verified ({stats['total_clients']} clients, {stats['total_projects']} projects).")

if __name__ == "__main__":
    print("\n--- RUNNING BACKEND AUTH & RBAC VERIFICATION SUITE ---")
    admin_tok = test_login_admin_success()
    user_tok = test_login_user_success()
    test_login_invalid_credentials()
    test_unauthenticated_protected_route()
    test_role_based_access_admin_route(admin_tok, user_tok)
    test_stats_and_data_routes(admin_tok)
    print("\n[ALL 6 TESTS PASSED SUCCESSFULLY!]\n")
