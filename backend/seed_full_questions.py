import re
from app.db.session import SessionLocal
from app.models.question_template import QuestionTemplate

# Load QUESTION_BANK from frontend/src/data/questionBank.js
frontend_js_path = "../frontend/src/data/questionBank.js"
with open(frontend_js_path, "r", encoding="utf-8") as f:
    content = f.read()

# Parse sections and questions using regex
sections_data = [
    (1, "Project Management & Communication", "star_rating"),
    (2, "Technical Competence & Solution Quality", "star_rating"),
    (3, "Team Responsiveness & Collaboration", "star_rating"),
    (4, "Delivery & Execution Quality", "star_rating"),
    (5, "Value & Business Impact", "star_rating"),
    (6, "Qualitative Feedback & General Comments", "free_text"),
]

db = SessionLocal()
try:
    # First, let's see how many exist
    existing = db.query(QuestionTemplate).all()
    existing_texts = {q.question_text.strip().lower() for q in existing}
    print(f"Existing questions in DB before seeding: {len(existing)}")

    # Extract all { id: "...", text: "..." } blocks
    pattern = re.compile(r'\{\s*id:\s*"q(\d)_(\d+)",\s*text:\s*"([^"]+)"\s*\}')
    matches = pattern.findall(content)
    print(f"Found {len(matches)} questions in questionBank.js")

    added_count = 0
    for sec_str, q_num_str, q_text in matches:
        sec_num = int(sec_str)
        q_text_clean = q_text.strip()
        if q_text_clean.lower() not in existing_texts:
            sec_info = next((s for s in sections_data if s[0] == sec_num), (sec_num, f"Section {sec_num}", "star_rating"))
            q_template = QuestionTemplate(
                section_number=sec_num,
                section_title=sec_info[1],
                question_text=q_text_clean,
                response_type=sec_info[2],
                applicable_phases="ALL",
                display_order=int(q_num_str),
                is_active=True,
            )
            db.add(q_template)
            existing_texts.add(q_text_clean.lower())
            added_count += 1

    db.commit()
    total_now = db.query(QuestionTemplate).count()
    print(f"Added {added_count} new questions. Total questions now in DB: {total_now}")

    # Check breakdown per section
    for sec_num, sec_title, _ in sections_data:
        cnt = db.query(QuestionTemplate).filter(QuestionTemplate.section_number == sec_num).count()
        print(f"Section {sec_num} ({sec_title}): {cnt} questions in DB")

finally:
    db.close()
