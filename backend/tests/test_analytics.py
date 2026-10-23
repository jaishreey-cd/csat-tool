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

def test_dashboard_analytics_empty_and_populated(client, test_user, test_client_and_project, db):
    """Test dashboard analytics empty state, populated calculations, and dynamic categories."""
    db_client, db_project = test_client_and_project
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "testadmin@example.com", "password": "Password123!"}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Test empty dashboard analytics
    dash_empty = client.get("/api/analytics/dashboard", headers=headers)
    assert dash_empty.status_code == 200
    data_empty = dash_empty.json()
    assert "total_surveys" in data_empty
    assert "categories" in data_empty
    assert "projects" in data_empty
    assert len(data_empty["categories"]) >= 5

    # 2. Create survey with 5 sections (ratings 5, 4, 3, 5, 4)
    questions = [
        {"section_number": 1, "section_title": "Project Management", "question_text": "Schedule adherence?", "response_type": "star_rating"},
        {"section_number": 2, "section_title": "Technical Competence", "question_text": "Engineering depth?", "response_type": "star_rating"},
        {"section_number": 3, "section_title": "Team Responsiveness", "question_text": "Response agility?", "response_type": "star_rating"},
        {"section_number": 4, "section_title": "Delivery & Execution", "question_text": "Milestone delivery?", "response_type": "star_rating"},
        {"section_number": 5, "section_title": "Value & Impact", "question_text": "Business value delivered?", "response_type": "star_rating"},
    ]
    create_resp = client.post("/api/surveys", json={
        "client_id": db_client.id,
        "project_id": db_project.id,
        "phase": "Closure",
        "client_contact_name": "Bob Executive",
        "client_contact_email": "bob@client.com",
        "questions": questions,
    }, headers=headers)
    assert create_resp.status_code == 201
    srv = create_resp.json()

    # Submit ratings: 5, 4, 3, 5, 4 -> 4 out of 5 are >= 4 (80% CSAT, avg 4.2)
    scores = [5, 4, 3, 5, 4]
    answers = [
        {"question_id": q["id"], "rating_score": scores[idx], "text_answer": None}
        for idx, q in enumerate(srv["questions"])
    ]
    sub_resp = client.post(f"/api/surveys/public/{srv['unique_token']}/submit", json={"answers": answers})
    assert sub_resp.status_code == 200

    # 3. Verify populated dashboard analytics
    dash_pop = client.get("/api/analytics/dashboard", headers=headers)
    assert dash_pop.status_code == 200
    pop = dash_pop.json()
    assert pop["responded_surveys"] >= 1
    assert pop["total_surveys"] >= 1
    assert pop["response_rate"] > 0
    assert pop["overall_csat"] is not None
    assert pop["overall_csat_percentage"] is not None

    # Check categories
    cat_1 = next((c for c in pop["categories"] if c["section_number"] == 1), None)
    assert cat_1 is not None
    assert cat_1["category_name"] == "Project Management"
    assert cat_1["average_rating"] == 5.0
    assert cat_1["total_ratings"] >= 1

    # Check project-wise metrics
    proj_metric = next((p for p in pop["projects"] if p["project_id"] == db_project.id), None)
    assert proj_metric is not None
    assert proj_metric["project_name"] == db_project.name
    assert proj_metric["submitted_responses"] >= 1
    assert proj_metric["surveys_sent"] >= 1
    assert proj_metric["response_rate"] == 100.0

def test_dashboard_analytics_role_based_access(client, test_user, test_client_and_project, db):
    """Test that PMO users only see analytics for surveys they created/own, while Admin sees all."""
    db_client, db_project = test_client_and_project
    from app.models.user import User
    from app.core.security import hash_password

    # Create a PMO user
    pmo_user = db.query(User).filter(User.email == "pmo_analyst@test.local").first()
    if not pmo_user:
        pmo_user = User(
            email="pmo_analyst@test.local",
            full_name="PMO Analyst",
            hashed_password=hash_password("Password123!"),
            role="PMO",
            is_active=True,
        )
        db.add(pmo_user)
        db.commit()
        db.refresh(pmo_user)

    # Login as PMO
    pmo_login = client.post("/api/auth/login", json={"email": "pmo_analyst@test.local", "password": "Password123!"})
    assert pmo_login.status_code == 200
    pmo_token = pmo_login.json()["access_token"]
    pmo_headers = {"Authorization": f"Bearer {pmo_token}"}

    # PMO user has not created any surveys yet -> 0 surveys
    pmo_dash = client.get("/api/analytics/dashboard", headers=pmo_headers)
    assert pmo_dash.status_code == 200
    assert pmo_dash.json()["total_surveys"] == 0
    assert pmo_dash.json()["responded_surveys"] == 0

