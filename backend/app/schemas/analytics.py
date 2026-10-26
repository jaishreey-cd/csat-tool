from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class SectionScore(BaseModel):
    section_number: int
    section_title: str
    average_score: float
    total_ratings: int
    rating_distribution: Dict[str, int]

class QualitativeComment(BaseModel):
    id: int
    survey_code: str
    phase: str
    question_text: str
    text_answer: str
    client_contact_name: Optional[str] = None
    client_contact_email: Optional[str] = None
    submitted_at: Optional[str] = None

class SurveyTimelineItem(BaseModel):
    id: int
    survey_code: str
    phase: str
    status: str
    average_score: Optional[float] = None
    client_contact_name: Optional[str] = None
    client_contact_email: Optional[str] = None
    sent_at: Optional[str] = None
    completed_at: Optional[str] = None

class PhaseScore(BaseModel):
    phase: str
    phase_order: int
    csat_score: Optional[float] = None
    csat_percentage: Optional[float] = None
    completed_count: int
    total_count: int
    status: str  # 'Completed', 'In Progress', 'Upcoming'

class ProjectAnalyticsResponse(BaseModel):
    project_id: int
    project_code: str
    project_name: str
    client_id: int
    client_name: str
    team_name: Optional[str] = None
    status: Optional[str] = None
    overall_csat: Optional[float] = None
    overall_csat_percentage: Optional[float] = None
    total_surveys: int
    completed_surveys: int
    sent_surveys: int
    response_rate: float
    latest_response_date: Optional[str] = None
    current_phase: Optional[str] = None
    next_phase: Optional[str] = None
    total_phases: int = 5
    completed_phases_count: int = 0
    phases: List[PhaseScore] = []
    sections: List[SectionScore]
    qualitative_comments: List[QualitativeComment]
    timeline: List[SurveyTimelineItem]

class MonthlyTrend(BaseModel):
    month: str
    average_csat: float
    responses_count: int

class SystemOverviewResponse(BaseModel):
    overall_csat: float
    total_responses: int
    total_surveys_sent: int
    response_rate: float
    active_projects_count: int
    total_clients_count: int
    monthly_trends: List[MonthlyTrend]

class CategoryScore(BaseModel):
    section_number: int
    category_name: str
    average_rating: Optional[float] = None
    total_ratings: int = 0
    csat_percentage: Optional[float] = None
    rating_distribution: Dict[str, int] = {}

class AssignedPmo(BaseModel):
    id: int
    full_name: Optional[str] = None
    email: str

class ProjectPmoAssignRequest(BaseModel):
    user_ids: List[int]

class ProjectMetric(BaseModel):
    project_id: int
    project_name: str
    project_code: str
    client_id: int
    client_name: str
    surveys_sent: int = 0
    submitted_responses: int = 0
    awaiting_responses: int = 0
    response_rate: float = 0.0
    average_csat: Optional[float] = None
    csat_percentage: Optional[float] = None
    has_low_rating: bool = False
    has_pending: bool = False
    assigned_pmos: List[AssignedPmo] = []

class DashboardAnalyticsResponse(BaseModel):
    total_surveys: int
    total_created_surveys: int
    responded_surveys: int
    awaiting_surveys: int
    overall_csat: Optional[float] = None
    overall_csat_percentage: Optional[float] = None
    response_rate: float = 0.0
    categories: List[CategoryScore] = []
    projects: List[ProjectMetric] = []
    pmo_users: List[AssignedPmo] = []
    definition_note: str = (
        "CSAT percentage represents the share of valid submitted ratings that are 4 or 5 on a 5-point scale. "
        "Pending surveys and unanswered questions are strictly excluded from rating averages."
    )
