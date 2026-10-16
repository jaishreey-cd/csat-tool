from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.question_template import QuestionTemplate
from app.schemas.question import QuestionTemplateCreate, QuestionTemplateUpdate

SECTION_DEFAULT_TITLES = {
    1: "Project Management & Communication",
    2: "Technical Competence & Solution Quality",
    3: "Team Responsiveness & Collaboration",
    4: "Delivery & Execution Quality",
    5: "Value & Business Impact",
    6: "Qualitative Feedback & General Comments",
}

def get_questions(
    db: Session,
    section_number: Optional[int] = None,
    phase: Optional[str] = None,
    include_inactive: bool = False,
) -> List[QuestionTemplate]:
    """Retrieve template questions with optional section and phase filters."""
    query = db.query(QuestionTemplate)
    if not include_inactive:
        query = query.filter(QuestionTemplate.is_active == True)
    if section_number:
        query = query.filter(QuestionTemplate.section_number == section_number)

    questions = query.order_by(QuestionTemplate.section_number, QuestionTemplate.display_order, QuestionTemplate.id).all()

    # Filter by phase in Python if specified ('ALL' or matching phase)
    if phase and phase != "ALL":
        filtered = []
        for q in questions:
            if not q.applicable_phases or q.applicable_phases == "ALL" or phase.lower() in [p.strip().lower() for p in q.applicable_phases.split(",")]:
                filtered.append(q)
        return filtered

    return questions

def get_question_by_id(db: Session, question_id: int) -> QuestionTemplate:
    question = db.query(QuestionTemplate).filter(QuestionTemplate.id == question_id).first()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Question template with ID {question_id} not found."
        )
    return question

def create_question(db: Session, question_in: QuestionTemplateCreate) -> QuestionTemplate:
    """Create a new independent question template in the question bank."""
    title = question_in.section_title or SECTION_DEFAULT_TITLES.get(question_in.section_number, f"Section {question_in.section_number}")
    response_type = "free_text" if question_in.section_number == 6 else question_in.response_type

    question = QuestionTemplate(
        section_number=question_in.section_number,
        section_title=title,
        question_text=question_in.question_text.strip(),
        response_type=response_type,
        applicable_phases=question_in.applicable_phases.strip() if question_in.applicable_phases else "ALL",
        display_order=question_in.display_order,
        is_active=True,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return question

def update_question(db: Session, question_id: int, question_in: QuestionTemplateUpdate) -> QuestionTemplate:
    """Update an existing question template."""
    question = get_question_by_id(db, question_id)

    if question_in.section_number is not None:
        question.section_number = question_in.section_number
    if question_in.section_title is not None:
        question.section_title = question_in.section_title
    if question_in.question_text is not None:
        question.question_text = question_in.question_text.strip()
    if question_in.response_type is not None:
        question.response_type = question_in.response_type
    if question_in.applicable_phases is not None:
        question.applicable_phases = question_in.applicable_phases.strip()
    if question_in.display_order is not None:
        question.display_order = question_in.display_order
    if question_in.is_active is not None:
        question.is_active = question_in.is_active

    db.commit()
    db.refresh(question)
    return question

def delete_question(db: Session, question_id: int) -> dict:
    """Permanently delete a question template from the database."""
    question = get_question_by_id(db, question_id)
    db.delete(question)
    db.commit()
    return {"status": "success", "message": f"Question {question_id} has been permanently deleted from database."}

def seed_default_questions_if_empty(db: Session):
    """Initializes standard question templates if the question_templates table is empty."""
    existing_count = db.query(QuestionTemplate).count()
    if existing_count > 0:
        return

    default_seed = [
        # Section 1
        (1, "Project Management & Communication", "Clarity of project milestones, scope definitions, and deliverables.", "star_rating", "ALL"),
        (1, "Project Management & Communication", "Adherence to agreed project timelines, schedules, and sprint commitments.", "star_rating", "ALL"),
        (1, "Project Management & Communication", "Proactive communication regarding potential risks, blockers, and changes.", "star_rating", "ALL"),
        (1, "Project Management & Communication", "Effectiveness and value of status meetings and weekly progress reports.", "star_rating", "ALL"),
        (1, "Project Management & Communication", "Promptness and thoroughness in responding to urgent requests and inquiries.", "star_rating", "ALL"),
        (1, "Project Management & Communication", "Transparency during unexpected challenges or requirement shifts.", "star_rating", "Mid-Project,Project Completion"),
        (1, "Project Management & Communication", "Overall satisfaction with project management governance and leadership.", "star_rating", "ALL"),

        # Section 2
        (2, "Technical Competence & Solution Quality", "Depth of technical expertise demonstrated by the engineering team.", "star_rating", "ALL"),
        (2, "Technical Competence & Solution Quality", "Architectural robustness, scalability, and maintainability of the solution.", "star_rating", "ALL"),
        (2, "Technical Competence & Solution Quality", "Code quality, best practices, and adherence to security guidelines.", "star_rating", "ALL"),
        (2, "Technical Competence & Solution Quality", "Effectiveness of automated testing, unit testing, and code coverage.", "star_rating", "Mid-Project,Project Completion"),
        (2, "Technical Competence & Solution Quality", "Solution performance, responsiveness, and resource optimization.", "star_rating", "ALL"),
        (2, "Technical Competence & Solution Quality", "Overall technical confidence and competence delivered by the engineering group.", "star_rating", "ALL"),

        # Section 3
        (3, "Team Responsiveness & Collaboration", "Ease of collaborating with the team members on a day-to-day basis.", "star_rating", "ALL"),
        (3, "Team Responsiveness & Collaboration", "Agility in adapting to urgent requirement shifts or reprioritization.", "star_rating", "ALL"),
        (3, "Team Responsiveness & Collaboration", "Openness to constructive critique and collaborative brainstorming.", "star_rating", "ALL"),
        (3, "Team Responsiveness & Collaboration", "Speed in acknowledging messages on shared communication channels (Slack/Teams).", "star_rating", "Weekly,Monthly"),
        (3, "Team Responsiveness & Collaboration", "Overall positive collaboration and cultural alignment.", "star_rating", "ALL"),

        # Section 4
        (4, "Delivery & Execution Quality", "Completeness and thoroughness of user acceptance testing (UAT) releases.", "star_rating", "Mid-Project,Project Completion"),
        (4, "Delivery & Execution Quality", "Low defect density and minimal post-release regression issues.", "star_rating", "ALL"),
        (4, "Delivery & Execution Quality", "Speed and accuracy of bug fixes and remediation during QA cycles.", "star_rating", "ALL"),
        (4, "Delivery & Execution Quality", "Clarity and usefulness of user manuals, release notes, and documentation.", "star_rating", "Project Completion,Post-Launch"),
        (4, "Delivery & Execution Quality", "Overall delivery execution and quality of release artifacts.", "star_rating", "ALL"),

        # Section 5
        (5, "Value & Business Impact", "Tangible business value and return on investment delivered by the solution.", "star_rating", "ALL"),
        (5, "Value & Business Impact", "Cost-effectiveness and adherence to budget and contracted resource allocations.", "star_rating", "Mid-Project,Project Completion"),
        (5, "Value & Business Impact", "Proactive recommendations by the vendor to optimize total cost of ownership (TCO).", "star_rating", "ALL"),
        (5, "Value & Business Impact", "Likelihood of recommending our engagement team to peers or other business units.", "star_rating", "ALL"),
        (5, "Value & Business Impact", "Overall satisfaction with commercial governance and partnership value.", "star_rating", "ALL"),

        # Section 6 (Qualitative - Free Text)
        (6, "Qualitative Feedback & General Comments", "What did our delivery team do exceptionally well during this milestone?", "free_text", "ALL"),
        (6, "Qualitative Feedback & General Comments", "What is the single most critical area our engineering team should improve?", "free_text", "ALL"),
        (6, "Qualitative Feedback & General Comments", "Any additional perspectives, compliments, or suggestions for our leadership?", "free_text", "ALL"),
    ]

    for order_idx, (sec_num, title, text, r_type, phases) in enumerate(default_seed):
        q = QuestionTemplate(
            section_number=sec_num,
            section_title=title,
            question_text=text,
            response_type=r_type,
            applicable_phases=phases,
            display_order=order_idx,
            is_active=True,
        )
        db.add(q)
    db.commit()
    print(f"[SEED] Seeded {len(default_seed)} default question templates in database.")
