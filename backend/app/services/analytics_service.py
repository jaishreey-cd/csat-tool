from collections import defaultdict
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

from app.models.project import Project
from app.models.client import Client
from app.models.survey import Survey, SurveyQuestion, SurveyAnswer
from app.schemas.analytics import (
    ProjectAnalyticsResponse,
    SectionScore,
    QualitativeComment,
    SurveyTimelineItem,
    SystemOverviewResponse,
    MonthlyTrend,
    PhaseScore,
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
    STANDARD_PHASES = ["Weekly", "Monthly", "Mid-Project", "Project Completion", "Post-Launch"]
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
    next_phase_name = STANDARD_PHASES[curr_idx + 1] if curr_idx + 1 < len(STANDARD_PHASES) else "All 5 Phases Complete"
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
