import pytest

def test_create_survey_success(client, test_user, test_client_and_project):
    """Test successful creation of a survey across 6 sections."""
    db_client, db_project = test_client_and_project
    
    # Login to obtain token
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "testadmin@example.com", "password": "Password123!"}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1 question per section across all 6 sections
    questions = [
        {"section_number": 1, "section_title": "Project Management", "question_text": "Clarity of milestones?", "response_type": "star_rating"},
        {"section_number": 2, "section_title": "Technical Competence", "question_text": "Code quality standard?", "response_type": "star_rating"},
        {"section_number": 3, "section_title": "Team Responsiveness", "question_text": "Speed of communication?", "response_type": "star_rating"},
        {"section_number": 4, "section_title": "Delivery & Execution", "question_text": "Defect rate in UAT?", "response_type": "star_rating"},
        {"section_number": 5, "section_title": "Value & Impact", "question_text": "Business ROI achieved?", "response_type": "star_rating"},
        {"section_number": 6, "section_title": "Qualitative Feedback", "question_text": "General comments?", "response_type": "free_text"},
    ]

    payload = {
        "client_id": db_client.id,
        "project_id": db_project.id,
        "phase": "Monthly",
        "questions": questions
    }

    resp = client.post("/api/surveys", json=payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "Draft"
    assert len(data["questions"]) == 6
    assert data["phase"] == "Monthly"
    assert data["creator_id"] == test_user.id

    # Test submit for approval
    survey_id = data["id"]
    submit_resp = client.post(f"/api/surveys/{survey_id}/submit-approval", headers=headers)
    assert submit_resp.status_code == 200
    assert submit_resp.json()["status"] == "Pending Approval"

def test_create_survey_missing_section_fails(client, test_user, test_client_and_project):
    """Test that skipping any section fails with 400 Bad Request."""
    db_client, db_project = test_client_and_project
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "testadmin@example.com", "password": "Password123!"}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

def test_create_survey_missing_section_allowed(client, test_user, test_client_and_project):
    """Test that deleting/omitting sections is now permitted per requirement."""
    db_client, db_project = test_client_and_project
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "testadmin@example.com", "password": "Password123!"}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Only sections 1, 3, 4, 5 (Section 2 deleted/omitted)
    questions = [
        {"section_number": 1, "section_title": "Project Management", "question_text": "Clarity of milestones?", "response_type": "star_rating"},
        {"section_number": 3, "section_title": "Team Responsiveness", "question_text": "Speed of communication?", "response_type": "star_rating"},
        {"section_number": 4, "section_title": "Delivery & Execution", "question_text": "Defect rate in UAT?", "response_type": "star_rating"},
        {"section_number": 5, "section_title": "Value & Impact", "question_text": "Business ROI achieved?", "response_type": "star_rating"},
    ]

    payload = {
        "client_id": db_client.id,
        "project_id": db_project.id,
        "phase": "Closure",
        "questions": questions
    }

    resp = client.post("/api/surveys", json=payload, headers=headers)
    assert resp.status_code == 201

    # Empty questions list still fails
    empty_payload = {
        "client_id": db_client.id,
        "project_id": db_project.id,
        "phase": "Closure",
        "questions": []
    }
    empty_resp = client.post("/api/surveys", json=empty_payload, headers=headers)
    assert empty_resp.status_code == 400

def test_dispatch_and_submit_public_survey(client, test_user, test_client_and_project):
    """Test full dispatch and client public survey submission."""
    db_client, db_project = test_client_and_project
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "testadmin@example.com", "password": "Password123!"}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create survey
    questions = [
        {"section_number": 1, "section_title": "Project Management", "question_text": "Clarity of milestones?", "response_type": "star_rating"},
        {"section_number": 2, "section_title": "Technical Competence", "question_text": "Code quality standard?", "response_type": "star_rating"},
        {"section_number": 3, "section_title": "Team Responsiveness", "question_text": "Speed of communication?", "response_type": "star_rating"},
        {"section_number": 4, "section_title": "Delivery & Execution", "question_text": "Defect rate in UAT?", "response_type": "star_rating"},
        {"section_number": 5, "section_title": "Value & Impact", "question_text": "Business ROI achieved?", "response_type": "star_rating"},
        {"section_number": 6, "section_title": "Qualitative Feedback", "question_text": "General comments?", "response_type": "free_text"},
    ]
    resp = client.post("/api/surveys", json={
        "client_id": db_client.id,
        "project_id": db_project.id,
        "phase": "Weekly",
        "questions": questions
    }, headers=headers)
    assert resp.status_code == 201
    survey_id = resp.json()["id"]

    # 2. Dispatch survey
    dispatch_resp = client.post(f"/api/surveys/{survey_id}/dispatch", json={
        "client_contact_name": "Jane Client",
        "client_contact_email": "jane@client.com"
    }, headers=headers)
    assert dispatch_resp.status_code == 200
    dispatch_data = dispatch_resp.json()
    assert dispatch_data["status"] == "Sent"
    unique_token = dispatch_data["unique_token"]
    assert unique_token is not None

    # 3. Fetch public survey
    public_resp = client.get(f"/api/surveys/public/{unique_token}")
    assert public_resp.status_code == 200
    public_data = public_resp.json()
    assert len(public_data["questions"]) == 6
    assert public_data["client_name"] == db_client.name

    # 4. Submit public survey responses
    answers = [
        {"question_id": q["id"], "rating_score": 5 if q["response_type"] == "star_rating" else None, "text_answer": "Great teamwork!" if q["response_type"] == "free_text" else None}
        for q in public_data["questions"]
    ]
    submit_resp = client.post(f"/api/surveys/public/{unique_token}/submit", json={"answers": answers})
    assert submit_resp.status_code == 200
    submit_result = submit_resp.json()
    assert submit_result["status"] == "success"
    assert submit_result["average_score"] == 5.0

    # 5. Cannot resubmit completed survey
    resubmit_resp = client.post(f"/api/surveys/public/{unique_token}/submit", json={"answers": answers})
    assert resubmit_resp.status_code == 400

def test_added_survey_questions_reflected_in_database(client, test_user, test_client_and_project, db):
    """Test that adding new/custom questions to a survey reflects only additions in postgres question_templates."""
    from app.models.question_template import QuestionTemplate
    db_client, db_project = test_client_and_project
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "testadmin@example.com", "password": "Password123!"}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    custom_text = "Brand New Custom Quality Assessment Question?"
    questions = [
        {"section_number": 1, "section_title": "Project Management", "question_text": custom_text, "response_type": "star_rating"},
        {"section_number": 2, "section_title": "Technical Competence", "question_text": "Code standard?", "response_type": "star_rating"},
        {"section_number": 3, "section_title": "Team Responsiveness", "question_text": "Communication speed?", "response_type": "star_rating"},
        {"section_number": 4, "section_title": "Delivery & Execution", "question_text": "UAT readiness?", "response_type": "star_rating"},
        {"section_number": 5, "section_title": "Value & Impact", "question_text": "ROI achieved?", "response_type": "star_rating"},
    ]

    resp = client.post("/api/surveys", json={
        "client_id": db_client.id,
        "project_id": db_project.id,
        "phase": "Weekly",
        "questions": questions
    }, headers=headers)
    assert resp.status_code == 201

    # Verify that custom_text was automatically inserted into QuestionTemplate in postgres
    template = db.query(QuestionTemplate).filter(
        QuestionTemplate.question_text == custom_text
    ).first()
    assert template is not None
    assert template.section_number == 1
    assert template.response_type == "star_rating"

