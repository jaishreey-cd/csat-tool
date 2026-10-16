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
    assert update_role_resp.json()["role"] == "PMO"

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
