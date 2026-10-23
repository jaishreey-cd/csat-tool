import pytest
from app.models.user import User

ADMIN_LIMIT_MSG = (
    "Maximum of 3 Admins reached. Revoke access from an existing Admin before granting Admin access to another user."
)

def test_admin_limit_grant_three_and_reject_fourth(client, db):
    """
    Test granting first, second, and third Admin successfully,
    and confirm attempting to grant a fourth Admin is rejected.
    """
    # 1. Login with a super admin
    # Clean users in test db first to have a clean starting slate
    db.query(User).delete()
    db.commit()

    # Create initial admin who will perform operations
    from app.core.security import hash_password
    admin1 = User(
        email="admin1@example.com",
        full_name="Admin One",
        hashed_password=hash_password("Password123!"),
        role="Admin",
        is_active=True,
    )
    db.add(admin1)
    db.commit()

    login_resp = client.post(
        "/api/auth/login",
        json={"email": "admin1@example.com", "password": "Password123!"},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify admin count is 1/3
    count_resp = client.get("/api/auth/admin-count", headers=headers)
    assert count_resp.status_code == 200
    assert count_resp.json()["active_admin_count"] == 1
    assert count_resp.json()["is_limit_reached"] is False

    # 2. Grant 2nd Admin
    resp2 = client.post(
        "/api/auth/users",
        json={"email": "admin2@example.com", "role": "Admin", "full_name": "Admin Two"},
        headers=headers,
    )
    assert resp2.status_code == 201
    assert resp2.json()["role"] == "Admin"
    assert resp2.json()["is_active"] is True

    # 3. Grant 3rd Admin
    resp3 = client.post(
        "/api/auth/users",
        json={"email": "admin3@example.com", "role": "Admin", "full_name": "Admin Three"},
        headers=headers,
    )
    assert resp3.status_code == 201
    assert resp3.json()["role"] == "Admin"
    assert resp3.json()["is_active"] is True

    # Verify count is now 3/3 and limit reached
    count_resp = client.get("/api/auth/admin-count", headers=headers)
    assert count_resp.json()["active_admin_count"] == 3
    assert count_resp.json()["is_limit_reached"] is True

    # 4. Attempt to grant a 4th Admin: MUST BE REJECTED
    resp4 = client.post(
        "/api/auth/users",
        json={"email": "admin4@example.com", "role": "Admin", "full_name": "Admin Four"},
        headers=headers,
    )
    assert resp4.status_code == 400
    assert resp4.json()["detail"] == ADMIN_LIMIT_MSG

    # Verify 4th admin was NOT created in DB
    user4_in_db = db.query(User).filter(User.email == "admin4@example.com").first()
    assert user4_in_db is None

    # Total active admins must still be exactly 3
    active_admins = db.query(User).filter(User.role == "Admin", User.is_active == True).count()
    assert active_admins == 3

def test_revoke_admin_and_grant_replacement(client, db):
    """
    Test revoking an Admin frees a slot, allowing a replacement Admin to be granted.
    """
    db.query(User).delete()
    db.commit()

    from app.core.security import hash_password
    # Create 3 active admins
    u1 = User(email="a1@csat.local", hashed_password=hash_password("Pass123!"), role="Admin", is_active=True)
    u2 = User(email="a2@csat.local", hashed_password=hash_password("Pass123!"), role="Admin", is_active=True)
    u3 = User(email="a3@csat.local", hashed_password=hash_password("Pass123!"), role="Admin", is_active=True)
    db.add_all([u1, u2, u3])
    db.commit()
    db.refresh(u2)

    login_resp = client.post("/api/auth/login", json={"email": "a1@csat.local", "password": "Pass123!"})
    headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    # Revoke u2's access (set is_active=False)
    revoke_resp = client.put(
        f"/api/auth/users/{u2.id}/permissions",
        json={"role": "Admin", "is_active": False},
        headers=headers,
    )
    assert revoke_resp.status_code == 200
    assert revoke_resp.json()["is_active"] is False

    # Check count is now 2
    count_resp = client.get("/api/auth/admin-count", headers=headers)
    assert count_resp.json()["active_admin_count"] == 2
    assert count_resp.json()["is_limit_reached"] is False

    # Grant replacement Admin: must succeed
    replacement_resp = client.post(
        "/api/auth/users",
        json={"email": "replacement@csat.local", "role": "Admin"},
        headers=headers,
    )
    assert replacement_resp.status_code == 201
    assert replacement_resp.json()["role"] == "Admin"
    assert replacement_resp.json()["is_active"] is True

    # Count is back to 3
    active_admins = db.query(User).filter(User.role == "Admin", User.is_active == True).count()
    assert active_admins == 3

def test_pmo_users_unrestricted_when_three_admins_exist(client, db):
    """
    Test that PMO users can be granted without restriction even when 3 Admin slots are occupied.
    """
    db.query(User).delete()
    db.commit()

    from app.core.security import hash_password
    # Create 3 active admins
    db.add_all([
        User(email="adm1@csat.local", hashed_password=hash_password("Pass123!"), role="Admin", is_active=True),
        User(email="adm2@csat.local", hashed_password=hash_password("Pass123!"), role="Admin", is_active=True),
        User(email="adm3@csat.local", hashed_password=hash_password("Pass123!"), role="Admin", is_active=True),
    ])
    db.commit()

    login_resp = client.post("/api/auth/login", json={"email": "adm1@csat.local", "password": "Pass123!"})
    headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    # Grant multiple PMO users
    for i in range(1, 5):
        resp = client.post(
            "/api/auth/users",
            json={"email": f"pmo{i}@csat.local", "role": "PMO"},
            headers=headers,
        )
        assert resp.status_code == 201
        assert resp.json()["role"] == "PMO"
        assert resp.json()["is_active"] is True

    # Total PMO count is 4, Admins is still 3
    pmo_count = db.query(User).filter(User.role == "PMO", User.is_active == True).count()
    admin_count = db.query(User).filter(User.role == "Admin", User.is_active == True).count()
    assert pmo_count == 4
    assert admin_count == 3

def test_change_pmo_to_admin_rejected_when_three_admins_exist(client, db):
    """
    Test attempting to change a PMO user's role to Admin when 3 Admins exist is rejected.
    """
    db.query(User).delete()
    db.commit()

    from app.core.security import hash_password
    pmo_user = User(email="colleague@csat.local", hashed_password=hash_password("Pass123!"), role="PMO", is_active=True)
    db.add_all([
        User(email="adm1@csat.local", hashed_password=hash_password("Pass123!"), role="Admin", is_active=True),
        User(email="adm2@csat.local", hashed_password=hash_password("Pass123!"), role="Admin", is_active=True),
        User(email="adm3@csat.local", hashed_password=hash_password("Pass123!"), role="Admin", is_active=True),
        pmo_user,
    ])
    db.commit()
    db.refresh(pmo_user)

    login_resp = client.post("/api/auth/login", json={"email": "adm1@csat.local", "password": "Pass123!"})
    headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    # Attempt to change PMO user to Admin via PUT permissions
    update_resp = client.put(
        f"/api/auth/users/{pmo_user.id}/permissions",
        json={"role": "Admin"},
        headers=headers,
    )
    assert update_resp.status_code == 400
    assert update_resp.json()["detail"] == ADMIN_LIMIT_MSG

    # Verify PMO user's role was NOT modified in DB
    db.refresh(pmo_user)
    assert pmo_user.role == "PMO"

def test_change_admin_to_pmo_frees_slot(client, db):
    """
    Test changing an Admin to PMO frees an Admin slot, which can then be reused.
    """
    db.query(User).delete()
    db.commit()

    from app.core.security import hash_password
    admin_to_demote = User(email="demote@csat.local", hashed_password=hash_password("Pass123!"), role="Admin", is_active=True)
    db.add_all([
        User(email="adm1@csat.local", hashed_password=hash_password("Pass123!"), role="Admin", is_active=True),
        User(email="adm2@csat.local", hashed_password=hash_password("Pass123!"), role="Admin", is_active=True),
        admin_to_demote,
    ])
    db.commit()
    db.refresh(admin_to_demote)

    login_resp = client.post("/api/auth/login", json={"email": "adm1@csat.local", "password": "Pass123!"})
    headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    # Change admin_to_demote from Admin to PMO
    demote_resp = client.put(
        f"/api/auth/users/{admin_to_demote.id}/permissions",
        json={"role": "PMO"},
        headers=headers,
    )
    assert demote_resp.status_code == 200
    assert demote_resp.json()["role"] == "PMO"

    # Verify freed slot
    count_resp = client.get("/api/auth/admin-count", headers=headers)
    assert count_resp.json()["active_admin_count"] == 2

    # Now grant new Admin: must succeed
    new_adm_resp = client.post(
        "/api/auth/users",
        json={"email": "newadmin@csat.local", "role": "Admin"},
        headers=headers,
    )
    assert new_adm_resp.status_code == 201
    assert new_adm_resp.json()["role"] == "Admin"
    assert new_adm_resp.json()["is_active"] is True

    # Count is 3 again
    active_admins = db.query(User).filter(User.role == "Admin", User.is_active == True).count()
    assert active_admins == 3

def test_reactivating_suspended_admin_enforces_limit(client, db):
    """
    Test that re-activating an inactive Admin user when 3 Admins are already active is rejected.
    """
    db.query(User).delete()
    db.commit()

    from app.core.security import hash_password
    suspended_admin = User(email="suspended@csat.local", hashed_password=hash_password("Pass123!"), role="Admin", is_active=False)
    db.add_all([
        User(email="adm1@csat.local", hashed_password=hash_password("Pass123!"), role="Admin", is_active=True),
        User(email="adm2@csat.local", hashed_password=hash_password("Pass123!"), role="Admin", is_active=True),
        User(email="adm3@csat.local", hashed_password=hash_password("Pass123!"), role="Admin", is_active=True),
        suspended_admin,
    ])
    db.commit()
    db.refresh(suspended_admin)

    login_resp = client.post("/api/auth/login", json={"email": "adm1@csat.local", "password": "Pass123!"})
    headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    # Attempt to activate suspended admin while 3 active admins already exist
    reactivate_resp = client.put(
        f"/api/auth/users/{suspended_admin.id}/permissions",
        json={"role": "Admin", "is_active": True},
        headers=headers,
    )
    assert reactivate_resp.status_code == 400
    assert reactivate_resp.json()["detail"] == ADMIN_LIMIT_MSG

    # Verify user remains inactive
    db.refresh(suspended_admin)
    assert suspended_admin.is_active is False
