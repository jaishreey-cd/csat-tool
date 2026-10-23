from collections import defaultdict
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

from datetime import datetime
from app.models.project import Project
from app.models.client import Client
from app.models.user import User
from app.models.survey import Survey, SurveyQuestion, SurveyAnswer
from app.schemas.analytics import (
    ProjectAnalyticsResponse,
    SectionScore,
    QualitativeComment,
    SurveyTimelineItem,
    SystemOverviewResponse,
    MonthlyTrend,
    PhaseScore,
    CategoryScore,
    ProjectMetric,
    DashboardAnalyticsResponse,
)

SECTION_TITLES = {
    1: "Project Management & Communication",
    2: "Technical Competence & Solution Quality",
    3: "Team Responsiveness & Collaboration",
    4: "Delivery & Execution Quality",
    5: "Value & Business Impact",
    6: "Qualitative Feedback & General Comments",
}

def get_project_analytics(db: Session, project_id: int) -> ProjectAnalyticsResponse:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID {project_id} not found."
        )

    surveys = db.query(Survey).filter(Survey.project_id == project_id).order_by(Survey.created_at.desc()).all()
    total_surveys = len(surveys)
    completed_surveys = [s for s in surveys if s.status == "Completed"]
    sent_surveys = [s for s in surveys if s.status in ("Sent", "Completed")]
    completed_count = len(completed_surveys)
    sent_count = len(sent_surveys)

    response_rate = round((completed_count / sent_count * 100), 1) if sent_count > 0 else 0.0

    # Overall CSAT
    scores = [s.average_score for s in completed_surveys if s.average_score is not None]
    overall_csat = round(sum(scores) / len(scores), 2) if scores else None

    # Latest response date
    latest_completed = max([s.completed_at for s in completed_surveys if s.completed_at], default=None)
    latest_response_date = latest_completed.strftime("%Y-%m-%d %H:%M") if latest_completed else None

    # Section-by-section breakdown (Sections 1-5)
    survey_ids = [s.id for s in completed_surveys]
    
    # Pre-populate section map
    section_data = {
        sec: {"scores": [], "dist": {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}}
        for sec in range(1, 6)
    }

    qualitative_comments = []

    if survey_ids:
        answers = (
            db.query(SurveyAnswer, SurveyQuestion, Survey)
            .join(SurveyQuestion, SurveyAnswer.question_id == SurveyQuestion.id)
            .join(Survey, SurveyAnswer.survey_id == Survey.id)
            .filter(SurveyAnswer.survey_id.in_(survey_ids))
            .order_by(SurveyAnswer.created_at.desc())
            .all()
        )

        for ans, q, s in answers:
            sec_num = q.section_number
            if 1 <= sec_num <= 5:
                if ans.rating_score is not None and 1 <= ans.rating_score <= 5:
                    section_data[sec_num]["scores"].append(ans.rating_score)
                    section_data[sec_num]["dist"][str(ans.rating_score)] += 1
            elif sec_num == 6:
                if ans.text_answer and ans.text_answer.strip():
                    qualitative_comments.append(
                        QualitativeComment(
                            id=ans.id,
                            survey_code=s.survey_code,
                            phase=s.phase,
                            question_text=q.question_text,
                            text_answer=ans.text_answer.strip(),
                            client_contact_name=s.client_contact_name,
                            client_contact_email=s.client_contact_email,
                            submitted_at=ans.created_at.strftime("%Y-%m-%d %H:%M") if ans.created_at else None,
                        )
                    )

    section_scores = []
    for sec_num in range(1, 6):
        sec_scores = section_data[sec_num]["scores"]
        avg = round(sum(sec_scores) / len(sec_scores), 2) if sec_scores else 0.0
        section_scores.append(
            SectionScore(
                section_number=sec_num,
                section_title=SECTION_TITLES.get(sec_num, f"Section {sec_num}"),
                average_score=avg,
                total_ratings=len(sec_scores),
                rating_distribution=section_data[sec_num]["dist"],
            )
        )

    timeline = [
        SurveyTimelineItem(
            id=s.id,
            survey_code=s.survey_code,
            phase=s.phase,
            status=s.status,
            average_score=s.average_score,
            client_contact_name=s.client_contact_name,
            client_contact_email=s.client_contact_email,
            sent_at=s.sent_at.strftime("%Y-%m-%d %H:%M") if s.sent_at else None,
            completed_at=s.completed_at.strftime("%Y-%m-%d %H:%M") if s.completed_at else None,
        )
        for s in surveys
    ]

    # ── Phase-wise CSAT Analytics as Percentages ────────────────────────────
    STANDARD_PHASES = ["Weekly", "Monthly", "Quarterly", "Closure"]
    phase_metrics = []
    completed_phases_count = 0
    current_phase_name = None

    for idx, ph in enumerate(STANDARD_PHASES, start=1):
        ph_surveys = [s for s in surveys if s.phase == ph]
        ph_completed = [s for s in ph_surveys if s.status == "Completed"]
        ph_scores = [s.average_score for s in ph_completed if s.average_score is not None]
        avg_ph = round(sum(ph_scores) / len(ph_scores), 2) if ph_scores else None
        pct_ph = round((avg_ph / 5.0) * 100, 1) if avg_ph is not None else None

        if len(ph_completed) > 0:
            ph_status = "Completed"
            completed_phases_count += 1
        elif len(ph_surveys) > 0:
            ph_status = "In Progress"
            if not current_phase_name:
                current_phase_name = ph
        else:
            ph_status = "Upcoming"

        phase_metrics.append(
            PhaseScore(
                phase=ph,
                phase_order=idx,
                csat_score=avg_ph,
                csat_percentage=pct_ph,
                completed_count=len(ph_completed),
                total_count=len(ph_surveys),
                status=ph_status,
            )
        )

    # Determine current and next phase
    if not current_phase_name:
        # If no phase is currently in progress, find first upcoming phase, or last completed
        upcoming = [p.phase for p in phase_metrics if p.status == "Upcoming"]
        current_phase_name = upcoming[0] if upcoming else STANDARD_PHASES[-1]

    curr_idx = STANDARD_PHASES.index(current_phase_name) if current_phase_name in STANDARD_PHASES else 0
    next_phase_name = STANDARD_PHASES[curr_idx + 1] if curr_idx + 1 < len(STANDARD_PHASES) else "All Phases Complete"
    overall_csat_percentage = round((overall_csat / 5.0) * 100, 1) if overall_csat is not None else None

    return ProjectAnalyticsResponse(
        project_id=project.id,
        project_code=project.project_code,
        project_name=project.name,
        client_id=project.client_id,
        client_name=project.client.name if project.client else "Client",
        team_name=project.team_name,
        status=project.status,
        overall_csat=overall_csat,
        overall_csat_percentage=overall_csat_percentage,
        total_surveys=total_surveys,
        completed_surveys=completed_count,
        sent_surveys=sent_count,
        response_rate=response_rate,
        latest_response_date=latest_response_date,
        current_phase=current_phase_name,
        next_phase=next_phase_name,
        total_phases=5,
        completed_phases_count=completed_phases_count,
        phases=phase_metrics,
        sections=section_scores,
        qualitative_comments=qualitative_comments,
        timeline=timeline,
    )

def get_system_overview(db: Session) -> SystemOverviewResponse:
    completed_surveys = db.query(Survey).filter(Survey.status == "Completed").all()
    sent_surveys = db.query(Survey).filter(Survey.status.in_(["Sent", "Completed"])).all()
    
    total_responses = len(completed_surveys)
    total_sent = len(sent_surveys)
    response_rate = round((total_responses / total_sent * 100), 1) if total_sent > 0 else 0.0

    scores = [s.average_score for s in completed_surveys if s.average_score is not None]
    overall_csat = round(sum(scores) / len(scores), 2) if scores else 0.0

    active_projects_count = db.query(Project).filter(Project.is_active.is_(True)).count()
    total_clients_count = db.query(Client).filter(Client.is_active.is_(True)).count()

    # Monthly trends
    monthly_data = defaultdict(list)
    for s in completed_surveys:
        if s.completed_at and s.average_score is not None:
            m_key = s.completed_at.strftime("%b %Y")
            monthly_data[m_key].append(s.average_score)

    monthly_trends = [
        MonthlyTrend(
            month=m,
            average_csat=round(sum(v) / len(v), 2),
            responses_count=len(v)
        )
        for m, v in monthly_data.items()
    ]

    return SystemOverviewResponse(
        overall_csat=overall_csat,
        total_responses=total_responses,
        total_surveys_sent=total_sent,
        response_rate=response_rate,
        active_projects_count=active_projects_count,
        total_clients_count=total_clients_count,
        monthly_trends=monthly_trends,
    )

def is_admin_user(user: Optional[User]) -> bool:
    """Helper to check if user has Admin privileges."""
    if not user or not user.role:
        return False
    return "admin" in user.role.strip().lower()

def get_dashboard_analytics(
    db: Session,
    client_id: Optional[int] = None,
    project_id: Optional[int] = None,
    phase: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Optional[User] = None,
) -> DashboardAnalyticsResponse:
    """
    Fetch comprehensive dashboard analytics including overall metrics,
    dynamically loaded category rating averages, and project-level breakdown.
    Strictly enforces role-based access control (Admin vs PMO User).
    """
    from sqlalchemy.orm import joinedload

    query = (
        db.query(Survey)
        .options(
            joinedload(Survey.client),
            joinedload(Survey.project),
        )
    )

    # 1. Role-Based Access Scoping: PMO Users see only their permitted surveys
    if current_user and not is_admin_user(current_user):
        query = query.filter(
            (Survey.creator_id == current_user.id) | (Survey.reviewer_id == current_user.id)
        )

    # 2. Apply Filters
    if client_id is not None:
        query = query.filter(Survey.client_id == client_id)
    if project_id is not None:
        query = query.filter(Survey.project_id == project_id)
    if phase and phase.strip().upper() != "ALL":
        query = query.filter(Survey.phase == phase.strip())
    if start_date and start_date.strip():
        try:
            parsed_start = datetime.strptime(start_date.strip(), "%Y-%m-%d")
            query = query.filter(Survey.created_at >= parsed_start)
        except Exception:
            pass
    if end_date and end_date.strip():
        try:
            parsed_end = datetime.strptime(end_date.strip(), "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            query = query.filter(Survey.created_at <= parsed_end)
        except Exception:
            pass

    all_surveys = query.all()
    total_created = len(all_surveys)

    # Dispatched surveys represent valid survey invitations sent to clients (Sent or Completed)
    dispatched = [s for s in all_surveys if s.status in ("Sent", "Completed")]
    total_dispatched = len(dispatched)

    # Responded surveys: valid final submissions completed by clients
    responded = [s for s in dispatched if s.status == "Completed" and s.completed_at is not None]
    responded_count = len(responded)

    # Awaiting Response surveys: successfully sent but no final submission yet
    awaiting = [s for s in dispatched if s.status == "Sent"]
    awaiting_count = len(awaiting)

    # Response Rate (%)
    response_rate = round((responded_count / total_dispatched * 100), 1) if total_dispatched > 0 else 0.0

    # 3. Overall CSAT Calculation
    completed_survey_ids = [s.id for s in responded]
    all_ratings = []
    if completed_survey_ids:
        raw_ratings = (
            db.query(SurveyAnswer.rating_score)
            .filter(
                SurveyAnswer.survey_id.in_(completed_survey_ids),
                SurveyAnswer.rating_score.isnot(None),
                SurveyAnswer.rating_score >= 1,
                SurveyAnswer.rating_score <= 5,
            )
            .all()
        )
        all_ratings = [r[0] for r in raw_ratings if r[0] is not None]

    if all_ratings:
        overall_avg_rating = round(sum(all_ratings) / len(all_ratings), 2)
        high_ratings_count = sum(1 for r in all_ratings if r >= 4)
        overall_csat_percentage = round((high_ratings_count / len(all_ratings)) * 100, 1)
    else:
        overall_avg_rating = None
        overall_csat_percentage = None

    # 4. Category-wise Analytics (Dynamic category names from database)
    configured_sections = (
        db.query(SurveyQuestion.section_number, SurveyQuestion.section_title)
        .filter(SurveyQuestion.section_number >= 1, SurveyQuestion.section_number <= 5)
        .distinct()
        .order_by(SurveyQuestion.section_number)
        .all()
    )
    category_names = {}
    for sec_num, sec_title in configured_sections:
        if sec_num not in category_names and sec_title:
            category_names[sec_num] = sec_title

    for sec_num in range(1, 6):
        if sec_num not in category_names:
            category_names[sec_num] = SECTION_TITLES.get(sec_num, f"Category {sec_num}")

    category_data = {
        sec_num: {
            "title": category_names[sec_num],
            "scores": [],
            "dist": {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0},
        }
        for sec_num in sorted(category_names.keys())
    }

    if completed_survey_ids:
        sec_ratings = (
            db.query(SurveyAnswer.rating_score, SurveyQuestion.section_number, SurveyQuestion.section_title)
            .join(SurveyQuestion, SurveyAnswer.question_id == SurveyQuestion.id)
            .filter(
                SurveyAnswer.survey_id.in_(completed_survey_ids),
                SurveyAnswer.rating_score.isnot(None),
                SurveyAnswer.rating_score >= 1,
                SurveyAnswer.rating_score <= 5,
            )
            .all()
        )
        for score, s_num, s_title in sec_ratings:
            if s_num not in category_data:
                category_data[s_num] = {
                    "title": s_title or f"Category {s_num}",
                    "scores": [],
                    "dist": {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0},
                }
            category_data[s_num]["scores"].append(score)
            category_data[s_num]["dist"][str(score)] += 1
            if s_title and not category_data[s_num]["title"]:
                category_data[s_num]["title"] = s_title

    categories_list = []
    for sec_num in sorted(category_data.keys()):
        c_item = category_data[sec_num]
        sc_list = c_item["scores"]
        if sc_list:
            c_avg = round(sum(sc_list) / len(sc_list), 2)
            c_csat = round((sum(1 for s in sc_list if s >= 4) / len(sc_list)) * 100, 1)
        else:
            c_avg = None
            c_csat = None
        categories_list.append(
            CategoryScore(
                section_number=sec_num,
                category_name=c_item["title"],
                average_rating=c_avg,
                total_ratings=len(sc_list),
                csat_percentage=c_csat,
                rating_distribution=c_item["dist"],
            )
        )

    # 5. Project-wise Analytics
    project_map = {}
    for s in dispatched:
        pid = s.project_id
        if pid not in project_map:
            project_map[pid] = {
                "project": s.project,
                "sent": 0,
                "responded": 0,
                "scores": [],
            }
        project_map[pid]["sent"] += 1
        if s.status == "Completed" and s.completed_at is not None:
            project_map[pid]["responded"] += 1
            if s.average_score is not None:
                project_map[pid]["scores"].append(s.average_score)

    projects_list = []
    for pid, pdata in project_map.items():
        proj = pdata["project"]
        s_cnt = pdata["sent"]
        r_cnt = pdata["responded"]
        a_cnt = s_cnt - r_cnt
        rate = round((r_cnt / s_cnt * 100), 1) if s_cnt > 0 else 0.0
        p_scores = pdata["scores"]
        if p_scores:
            p_avg = round(sum(p_scores) / len(p_scores), 2)
            p_pct = round((sum(1 for sc in p_scores if sc >= 4.0) / len(p_scores)) * 100, 1)
        else:
            p_avg = None
            p_pct = None

        projects_list.append(
            ProjectMetric(
                project_id=pid,
                project_name=proj.name if proj else f"Project {pid}",
                project_code=proj.project_code if proj else f"PRJ-{pid}",
                client_id=proj.client_id if proj else 0,
                client_name=proj.client.name if (proj and proj.client) else "Client",
                surveys_sent=s_cnt,
                submitted_responses=r_cnt,
                awaiting_responses=a_cnt,
                response_rate=rate,
                average_csat=p_avg,
                csat_percentage=p_pct,
                has_low_rating=(p_avg is not None and p_avg < 3.5),
                has_pending=(a_cnt > 0),
            )
        )
    projects_list.sort(key=lambda p: (p.submitted_responses, p.surveys_sent), reverse=True)

    return DashboardAnalyticsResponse(
        total_surveys=total_dispatched,
        total_created_surveys=total_created,
        responded_surveys=responded_count,
        awaiting_surveys=awaiting_count,
        overall_csat=overall_avg_rating,
        overall_csat_percentage=overall_csat_percentage,
        response_rate=response_rate,
        categories=categories_list,
        projects=projects_list,
    )

