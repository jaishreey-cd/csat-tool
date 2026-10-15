import pytest

def test_project_analytics_and_overview(client, test_user, test_client_and_project):
    """Test fetching analytics for a project and system overview after submitting survey responses."""
    db_client, db_project = test_client_and_project
    
    # 1. Login
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "testadmin@example.com", "password": "Password123!"}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Check initial analytics with no surveys completed
    analytics_resp = client.get(f"/api/analytics/projects/{db_project.id}", headers=headers)
    assert analytics_resp.status_code == 200
    analytics_data = analytics_resp.json()
    assert analytics_data["project_id"] == db_project.id
    assert analytics_data["overall_csat"] is None
    assert analytics_data["completed_surveys"] == 0

    # 3. Create, dispatch, and submit a survey
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
        "client_contact_name": "Alice Stakeholder",
        "client_contact_email": "alice@client.com",
        "questions": questions,
    }, headers=headers)
    assert create_resp.status_code == 201
    survey_data = create_resp.json()
    token_str = survey_data["unique_token"]

    # Submit 4 stars for all sections and a text comment for section 6
    answers = [
        {"question_id": q["id"], "rating_score": 4 if q["response_type"] == "star_rating" else None, "text_answer": "Exceptional delivery speed." if q["response_type"] == "free_text" else None}
        for q in survey_data["questions"]
    ]
    submit_resp = client.post(f"/api/surveys/public/{token_str}/submit", json={"answers": answers})
    assert submit_resp.status_code == 200

    # 4. Fetch updated project analytics
    updated_analytics_resp = client.get(f"/api/analytics/projects/{db_project.id}", headers=headers)
    assert updated_analytics_resp.status_code == 200
    updated = updated_analytics_resp.json()
    assert updated["overall_csat"] == 4.0
    assert updated["completed_surveys"] == 1
    assert len(updated["sections"]) == 5
    assert updated["sections"][0]["average_score"] == 4.0
    assert len(updated["qualitative_comments"]) == 1
    assert updated["qualitative_comments"][0]["text_answer"] == "Exceptional delivery speed."

    # 5. Fetch system overview
    overview_resp = client.get("/api/analytics/overview", headers=headers)
    assert overview_resp.status_code == 200
    overview = overview_resp.json()
    assert overview["total_responses"] >= 1
    assert overview["overall_csat"] >= 4.0
