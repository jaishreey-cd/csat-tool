from datetime import datetime, timedelta
import pytest

def test_survey_reminder_and_automated_scanner(client, test_user, test_client_and_project):
    """Test manual on-demand reminder dispatch and automated follow-up scanning."""
    db_client, db_project = test_client_and_project
    
    # 1. Login
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "testadmin@example.com", "password": "Password123!"}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create and dispatch a survey
    questions = [
        {"section_number": 1, "section_title": "Project Management", "question_text": "Clarity of milestones?", "response_type": "star_rating"},
        {"section_number": 2, "section_title": "Technical Competence", "question_text": "Code quality standard?", "response_type": "star_rating"},
        {"section_number": 3, "section_title": "Team Responsiveness", "question_text": "Speed of communication?", "response_type": "star_rating"},
        {"section_number": 4, "section_title": "Delivery & Execution", "question_text": "Defect rate in UAT?", "response_type": "star_rating"},
        {"section_number": 5, "section_title": "Value & Impact", "question_text": "Business ROI achieved?", "response_type": "star_rating"},
        {"section_number": 6, "section_title": "Qualitative Feedback", "question_text": "What exceeded expectations?", "response_type": "free_text"},
    ]

    create_resp = client.post("/api/surveys", json={
        "client_id": db_client.id,
        "project_id": db_project.id,
        "phase": "Weekly",
        "client_contact_name": "Marcus Vance",
        "client_contact_email": "marcus@client.com",
        "questions": questions,
    }, headers=headers)
    assert create_resp.status_code == 201
    survey_data = create_resp.json()
    survey_id = survey_data["id"]

    # 3. Trigger automated follow-ups scanner (with 0 threshold to catch the newly created survey)
    scanner_resp = client.post("/api/surveys/check-followups?threshold_days=0", headers=headers)
    assert scanner_resp.status_code == 200
    scanner_result = scanner_resp.json()
    assert scanner_result["status"] == "success"
    assert scanner_result["reminded_count"] >= 1

    # 4. Trigger again - should not re-remind since it only sends one follow-up automatically
    scanner_resp2 = client.post("/api/surveys/check-followups?threshold_days=0", headers=headers)
    assert scanner_resp2.status_code == 200
    assert scanner_resp2.json()["reminded_count"] == 0
