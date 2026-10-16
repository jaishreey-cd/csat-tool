import pytest
from datetime import datetime, timezone

def test_survey_response_status_and_detail(client, test_user, test_client_and_project, auth_headers):
    """
    Test that:
    1. A dispatched survey without submission returns response_status == 'awaiting_response' and response_id == None.
    2. A submitted survey returns response_status == 'responded' and response_id == survey.id.
    3. GET /api/surveys/{survey_id}/response and GET /api/surveys/responses/{response_id} return accurate details.
    4. Accessing response details before submission returns 404.
    5. Unauthenticated access returns 401.
    """
    db_client, db_project = test_client_and_project

    # 1. Create survey with 6 sections
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
    }, headers=auth_headers)
    assert resp.status_code == 201
    survey_data = resp.json()
    survey_id = survey_data["id"]

    # 2. Verify Draft survey has awaiting_response
    surveys_list = client.get("/api/surveys", headers=auth_headers).json()["surveys"]
    survey_in_list = next((s for s in surveys_list if s["id"] == survey_id), None)
    assert survey_in_list is not None
    assert survey_in_list["response_status"] == "awaiting_response"
    assert survey_in_list["response_id"] is None

    # 3. Dispatch the survey
    dispatch_resp = client.post(f"/api/surveys/{survey_id}/dispatch", json={
        "client_contact_name": "Alice Tester",
        "client_contact_email": "alice@tester.com"
    }, headers=auth_headers)
    assert dispatch_resp.status_code == 200
    dispatch_data = dispatch_resp.json()
    assert dispatch_data["status"] == "Sent"
    unique_token = dispatch_data["unique_token"]

    # Verify Dispatched survey without submission is still awaiting_response
    surveys_list = client.get("/api/surveys", headers=auth_headers).json()["surveys"]
    survey_in_list = next((s for s in surveys_list if s["id"] == survey_id), None)
    assert survey_in_list["response_status"] == "awaiting_response"
    assert survey_in_list["response_id"] is None

    # Querying client response details before submission returns 404
    detail_404 = client.get(f"/api/surveys/{survey_id}/response", headers=auth_headers)
    assert detail_404.status_code == 404

    # 4. Submit public response
    public_resp = client.get(f"/api/surveys/public/{unique_token}")
    assert public_resp.status_code == 200
    pub_data = public_resp.json()

    answers_payload = []
    for q in pub_data["questions"]:
        if q["response_type"] == "star_rating":
            answers_payload.append({
                "question_id": q["id"],
                "rating_score": 5,
                "text_answer": None
            })
        else:
            answers_payload.append({
                "question_id": q["id"],
                "rating_score": None,
                "text_answer": "Exceptional delivery and communication."
            })

    submit_resp = client.post(f"/api/surveys/public/{unique_token}/submit", json={"answers": answers_payload})
    assert submit_resp.status_code == 200

    # 5. Verify survey listing now has responded and response_id == survey_id
    surveys_list = client.get("/api/surveys", headers=auth_headers).json()["surveys"]
    survey_in_list = next((s for s in surveys_list if s["id"] == survey_id), None)
    assert survey_in_list["response_status"] == "responded"
    assert survey_in_list["response_id"] == survey_id

    # 6. Fetch client response detail via survey endpoint
    detail_resp = client.get(f"/api/surveys/{survey_id}/response", headers=auth_headers)
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["client_name"] == db_client.name
    assert detail["project_name"] == db_project.name
    assert detail["client_contact_name"] == "Alice Tester"
    assert detail["client_contact_email"] == "alice@tester.com"
    assert detail["phase"] == "Weekly"
    assert detail["overall_score"] == 5.0
    assert detail["overall_percentage"] == 100
    assert len(detail["sections"]) == 6
    assert len(detail["additional_comments"]) >= 1
    assert detail["additional_comments"][0] == "Exceptional delivery and communication."

    # 7. Fetch client response detail via /responses/{response_id}
    res_resp = client.get(f"/api/surveys/responses/{survey_id}", headers=auth_headers)
    assert res_resp.status_code == 200
    assert res_resp.json()["response_id"] == survey_id

    # 8. Unauthenticated access fails
    unauth_resp = client.get(f"/api/surveys/{survey_id}/response")
    assert unauth_resp.status_code == 401
