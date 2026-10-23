import pytest

def test_question_bank_crud_and_permanent_deletion(client, test_user):
    """Test Question Bank independent question management and permanent deletion from DB."""
    # 1. Login
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "testadmin@example.com", "password": "Password123!"}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create Question in Question Bank
    create_payload = {
        "section_number": 2,
        "section_title": "Technical Competence",
        "question_text": "How well was test coverage maintained across sprints?",
        "response_type": "star_rating",
        "applicable_phases": "Mid-Project",
        "display_order": 1
    }
    create_resp = client.post("/api/questions", json=create_payload, headers=headers)
    assert create_resp.status_code == 201
    q_data = create_resp.json()
    assert q_data["id"] is not None
    assert q_data["question_text"] == "How well was test coverage maintained across sprints?"
    assert q_data["applicable_phases"] == "Mid-Project"
    question_id = q_data["id"]

    # 3. Read Question Bank
    list_resp = client.get("/api/questions?section_number=2", headers=headers)
    assert list_resp.status_code == 200
    questions_list = list_resp.json()["questions"]
    assert any(q["id"] == question_id for q in questions_list)

    # 4. Update Question
    update_resp = client.put(f"/api/questions/{question_id}", json={
        "question_text": "Updated: How well was test coverage maintained across all sprints?"
    }, headers=headers)
    assert update_resp.status_code == 200
    assert update_resp.json()["question_text"] == "Updated: How well was test coverage maintained across all sprints?"

    # 5. Permanent Delete Question
    del_resp = client.delete(f"/api/questions/{question_id}", headers=headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "success"

    # 6. Verify permanently deleted
    verify_resp = client.get(f"/api/questions/{question_id}", headers=headers)
    assert verify_resp.status_code == 404

def test_admin_permissions_user_role_update(client, test_user):
    """Test administrator granting permissions to users."""
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "testadmin@example.com", "password": "Password123!"}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get users list
    users_resp = client.get("/api/auth/users", headers=headers)
    assert users_resp.status_code == 200
    users = users_resp.json()
    assert len(users) >= 1

    # Update role to PMO
    update_role_resp = client.put(
        f"/api/auth/users/{test_user.id}/permissions",
        json={"role": "PMO"},
        headers=headers
    )
    assert update_role_resp.status_code == 200
    assert update_role_resp.json()["role"] in ["PMO", "User"]

    # Reset back to Admin
    client.put(
        f"/api/auth/users/{test_user.id}/permissions",
        json={"role": "Admin"},
        headers=headers
    )

def test_survey_creation_with_optional_section_6(client, test_user, test_client_and_project):
    """Test that Section 6 questions are optional (0 questions accepted)."""
    db_client, db_project = test_client_and_project
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "testadmin@example.com", "password": "Password123!"}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Only sections 1 through 5, section 6 omitted completely
    questions = [
        {"section_number": 1, "section_title": "Project Management", "question_text": "Clarity of milestones?", "response_type": "star_rating"},
        {"section_number": 2, "section_title": "Technical Competence", "question_text": "Code quality standard?", "response_type": "star_rating"},
        {"section_number": 3, "section_title": "Team Responsiveness", "question_text": "Speed of communication?", "response_type": "star_rating"},
        {"section_number": 4, "section_title": "Delivery & Execution", "question_text": "Defect rate in UAT?", "response_type": "star_rating"},
        {"section_number": 5, "section_title": "Value & Impact", "question_text": "Business ROI achieved?", "response_type": "star_rating"},
    ]

    payload = {
        "client_id": db_client.id,
        "project_id": db_project.id,
        "phase": "Mid-Project",
        "questions": questions
    }

    resp = client.post("/api/surveys", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["questions"]) == 5
    assert data["status"] == "Draft"

def test_authorize_new_user_and_inactive_access_control(client, test_user):
    """Test admin creating authorized users and access restriction for non-authorized users."""
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "testadmin@example.com", "password": "Password123!"}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Admin creates a new authorized user
    new_user_payload = {
        "email": "newpm@csat.local",
        "password": "Password123!",
        "full_name": "New Project Manager",
        "role": "PMO",
        "is_active": True
    }
    create_resp = client.post("/api/auth/users", json=new_user_payload, headers=headers)
    assert create_resp.status_code == 201
    created_data = create_resp.json()
    new_user_id = created_data["id"]
    assert created_data["role"] in ["PMO", "User"]

    # 2. New authorized user can log in
    pm_login_resp = client.post(
        "/api/auth/login",
        json={"email": "newpm@csat.local", "password": "Password123!"}
    )
    assert pm_login_resp.status_code == 200

    # 3. Admin revokes authorization (is_active = False)
    deactivate_resp = client.put(
        f"/api/auth/users/{new_user_id}/permissions",
        json={"role": "PMO", "is_active": False},
        headers=headers
    )
    assert deactivate_resp.status_code == 200
    assert deactivate_resp.json()["is_active"] is False

    # 4. Inactive user login returns 403 Forbidden
    blocked_login_resp = client.post(
        "/api/auth/login",
        json={"email": "newpm@csat.local", "password": "Password123!"}
    )
    assert blocked_login_resp.status_code == 403
    assert "pending administrator authorization" in blocked_login_resp.json()["detail"]

def test_user_role_survey_creation_and_email_dispatch(client, db, test_client_and_project):
    """Test that regular User role triggers email dispatch identically to Admin for whatever email is supplied."""
    from unittest.mock import patch
    from app.models.user import User
    from app.core.security import hash_password, create_access_token
    
    db_client, db_project = test_client_and_project
    
    # Create or fetch a non-admin User (role = "User")
    normal_user = db.query(User).filter(User.email == "testuser@example.com").first()
    if not normal_user:
        normal_user = User(
            email="testuser@example.com",
            full_name="Regular PMO User",
            hashed_password=hash_password("Password123!"),
            role="User",
            is_active=True
        )
        db.add(normal_user)
        db.commit()
        db.refresh(normal_user)
    
    user_token = create_access_token(data={"sub": str(normal_user.id), "email": normal_user.email})
    headers = {"Authorization": f"Bearer {user_token}"}
    
    questions = [
        {"section_number": 1, "section_title": "Project Management", "question_text": "Clarity of milestones?", "response_type": "star_rating"},
        {"section_number": 2, "section_title": "Technical Competence", "question_text": "Code quality standard?", "response_type": "star_rating"},
        {"section_number": 3, "section_title": "Team Responsiveness", "question_text": "Speed of communication?", "response_type": "star_rating"},
        {"section_number": 4, "section_title": "Delivery & Execution", "question_text": "Defect rate in UAT?", "response_type": "star_rating"},
        {"section_number": 5, "section_title": "Value & Impact", "question_text": "Business ROI achieved?", "response_type": "star_rating"},
    ]
    
    test_client_email = "stakeholder@example.com"
    payload = {
        "client_id": db_client.id,
        "project_id": db_project.id,
        "phase": "Mid-Project",
        "client_contact_name": "Client Representative",
        "client_contact_email": test_client_email,
        "questions": questions
    }
    
    with patch("app.services.survey_service.send_survey_invitation_email") as mock_send_email:
        mock_send_email.return_value = {"success": True, "mode": "simulated", "message": "Email sent"}
        
        create_resp = client.post("/api/surveys", json=payload, headers=headers)
        assert create_resp.status_code == 201
        created_data = create_resp.json()
        
        assert created_data["status"] == "Sent"
        assert created_data["client_contact_email"] == test_client_email
        assert created_data["creator_id"] == normal_user.id
        
        # Verify email dispatch was attempted with the exact client email provided
        mock_send_email.assert_called_once()
        call_kwargs = mock_send_email.call_args.kwargs
        assert call_kwargs["recipient_email"] == test_client_email
        assert call_kwargs["recipient_name"] == "Client Representative"


