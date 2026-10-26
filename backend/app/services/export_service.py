import io
import csv
import re
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from app.models.project import Project
from app.models.client import Client
from app.models.survey import Survey
from app.services.analytics_service import get_project_analytics, get_system_overview, SECTION_TITLES
from app.services.survey_service import get_surveys

def sanitize_filename(name: str) -> str:
    """
    Sanitize a project name to be safe for filenames across Windows/Linux/macOS.
    Removes invalid characters: / \ : * ? " < > | and strips whitespace/dots.
    """
    if not name:
        return "Survey_Export"
    cleaned = re.sub(r'[\\/*?:"<>|]', '_', str(name))
    cleaned = re.sub(r'[\r\n\t]+', ' ', cleaned).strip('. ')
    return cleaned or "Survey_Export"

# ── Styling Constants for XLSX ──────────────────────────────────────────────
HEADER_FILL = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
HEADER_FONT = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
TITLE_FONT = Font(name="Segoe UI", size=14, bold=True, color="0F172A")
SUBTITLE_FONT = Font(name="Segoe UI", size=10, italic=True, color="64748B")
DATA_FONT = Font(name="Segoe UI", size=10, color="1E293B")
BOLD_DATA_FONT = Font(name="Segoe UI", size=10, bold=True, color="0F172A")
BORDER_THIN = Side(border_style="thin", color="CBD5E1")
CELL_BORDER = Border(left=BORDER_THIN, right=BORDER_THIN, top=BORDER_THIN, bottom=BORDER_THIN)

def _autofit_columns(sheet):
    """Auto-adjusts column widths to content with safety margins."""
    for col in sheet.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val = str(cell.value or "")
            if len(val) > max_len:
                max_len = len(val)
        sheet.column_dimensions[col_letter].width = max(max_len + 3, 12)

# ── Project Analytics Export ────────────────────────────────────────────────
def export_project_analytics(db: Session, project_id: int, format: str = "csv") -> Tuple[bytes, str, str]:
    """
    Exports comprehensive analytics for a project in CSV or XLSX format.
    Returns: (file_bytes, filename, media_type)
    """
    analytics = get_project_analytics(db, project_id)
    safe_code = analytics.project_code.replace(" ", "_")

    if format.lower() == "xlsx":
        wb = openpyxl.Workbook()
        
        # ── Sheet 1: Project CSAT Summary ──────────────────────────────────
        ws1 = wb.active
        ws1.title = "Project CSAT Summary"

        # Title Block
        ws1.cell(row=1, column=1, value=f"{analytics.project_name}").font = TITLE_FONT
        ws1.cell(row=2, column=1, value=f"Client: {analytics.client_name} | Generated CSAT Performance Report").font = SUBTITLE_FONT

        # KPI Block
        kpis = [
            ("Overall CSAT Score", f"{analytics.overall_csat:.2f} / 5.0" if analytics.overall_csat is not None else "N/A"),
            ("Response Rate", f"{analytics.response_rate}%"),
            ("Total Surveys", analytics.total_surveys),
            ("Completed Surveys", analytics.completed_surveys),
            ("Latest Response Date", analytics.latest_response_date or "N/A"),
            ("Delivery Team", analytics.team_name or "N/A"),
        ]
        
        ws1.cell(row=4, column=1, value="Metric").font = HEADER_FONT
        ws1.cell(row=4, column=1).fill = HEADER_FILL
        ws1.cell(row=4, column=2, value="Value").font = HEADER_FONT
        ws1.cell(row=4, column=2).fill = HEADER_FILL

        for r_idx, (metric, val) in enumerate(kpis, start=5):
            c1 = ws1.cell(row=r_idx, column=1, value=metric)
            c2 = ws1.cell(row=r_idx, column=2, value=val)
            c1.font = DATA_FONT
            c2.font = BOLD_DATA_FONT
            c1.border = CELL_BORDER
            c2.border = CELL_BORDER

        # Section Scores Table
        sec_start = 13
        ws1.cell(row=sec_start - 1, column=1, value="Core Evaluation Sections Performance").font = TITLE_FONT
        sec_headers = ["Section", "Evaluation Area", "Average (1-5)", "Ratings Count", "1★", "2★", "3★", "4★", "5★"]
        for c_idx, h in enumerate(sec_headers, start=1):
            cell = ws1.cell(row=sec_start, column=c_idx, value=h)
            cell.font = HEADER_FONT
            cell.fill = HEADER_FILL
            cell.alignment = Alignment(horizontal="center" if c_idx >= 3 else "left")

        for r_idx, sec in enumerate(analytics.sections, start=sec_start + 1):
            row_vals = [
                f"Section {sec.section_number}",
                sec.section_title,
                sec.average_score,
                sec.total_ratings,
                sec.rating_distribution.get("1", 0),
                sec.rating_distribution.get("2", 0),
                sec.rating_distribution.get("3", 0),
                sec.rating_distribution.get("4", 0),
                sec.rating_distribution.get("5", 0),
            ]
            for c_idx, val in enumerate(row_vals, start=1):
                cell = ws1.cell(row=r_idx, column=c_idx, value=val)
                cell.font = DATA_FONT
                cell.border = CELL_BORDER
                if c_idx >= 3:
                    cell.alignment = Alignment(horizontal="center")

        _autofit_columns(ws1)

        # ── Sheet 2: Surveys History ───────────────────────────────────────
        ws2 = wb.create_sheet(title="Survey Registry")
        ws2_headers = ["Phase", "Status", "CSAT Score", "Client Contact", "Contact Email", "Sent At", "Completed At"]
        for c_idx, h in enumerate(ws2_headers, start=1):
            cell = ws2.cell(row=1, column=c_idx, value=h)
            cell.font = HEADER_FONT
            cell.fill = HEADER_FILL

        for r_idx, item in enumerate(analytics.timeline, start=2):
            vals = [
                item.phase,
                item.status,
                f"{item.average_score:.2f}" if item.average_score is not None else "-",
                item.client_contact_name or "-",
                item.client_contact_email or "-",
                item.sent_at or "-",
                item.completed_at or "-",
            ]
            for c_idx, val in enumerate(vals, start=1):
                cell = ws2.cell(row=r_idx, column=c_idx, value=val)
                cell.font = DATA_FONT
                cell.border = CELL_BORDER

        _autofit_columns(ws2)

        # ── Sheet 3: Qualitative Client Feedback ───────────────────────────
        ws3 = wb.create_sheet(title="Qualitative Feedback")
        ws3_headers = ["Survey Code", "Phase", "Evaluation Question", "Client Comment / Actionable Feedback", "Client Contact", "Submitted At"]
        for c_idx, h in enumerate(ws3_headers, start=1):
            cell = ws3.cell(row=1, column=c_idx, value=h)
            cell.font = HEADER_FONT
            cell.fill = HEADER_FILL

        for r_idx, comment in enumerate(analytics.qualitative_comments, start=2):
            vals = [
                comment.survey_code,
                comment.phase,
                comment.question_text,
                comment.text_answer,
                f"{comment.client_contact_name or ''} <{comment.client_contact_email or ''}>",
                comment.submitted_at or "-",
            ]
            for c_idx, val in enumerate(vals, start=1):
                cell = ws3.cell(row=r_idx, column=c_idx, value=val)
                cell.font = DATA_FONT
                cell.border = CELL_BORDER

        _autofit_columns(ws3)

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        filename = f"{safe_code}_CSAT_Report.xlsx"
        return output.getvalue(), filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    else:
        # Default: CSV Export
        output = io.StringIO()
        writer = csv.writer(output)

        # Header Block
        writer.writerow(["=== CSAT PROJECT PERFORMANCE REPORT ==="])
        writer.writerow(["Project Name", analytics.project_name])
        writer.writerow(["Client", analytics.client_name])
        writer.writerow(["Delivery Team", analytics.team_name or "N/A"])
        writer.writerow(["Overall CSAT Score", f"{analytics.overall_csat:.2f}" if analytics.overall_csat is not None else "N/A"])
        writer.writerow(["Response Rate", f"{analytics.response_rate}%"])
        writer.writerow(["Total Surveys", analytics.total_surveys])
        writer.writerow(["Completed Surveys", analytics.completed_surveys])
        writer.writerow(["Latest Response Date", analytics.latest_response_date or "N/A"])
        writer.writerow([])

        # Section Performance Table
        writer.writerow(["=== SECTION-BY-SECTION EVALUATION BREAKDOWN ==="])
        writer.writerow(["Section Number", "Section Title", "Average Score (1-5)", "Ratings Count", "1-Star", "2-Star", "3-Star", "4-Star", "5-Star"])
        for sec in analytics.sections:
            writer.writerow([
                sec.section_number,
                sec.section_title,
                sec.average_score,
                sec.total_ratings,
                sec.rating_distribution.get("1", 0),
                sec.rating_distribution.get("2", 0),
                sec.rating_distribution.get("3", 0),
                sec.rating_distribution.get("4", 0),
                sec.rating_distribution.get("5", 0),
            ])
        writer.writerow([])

        # Survey Registry Table
        writer.writerow(["=== PROJECT SURVEY REGISTRY ==="])
        writer.writerow(["Phase", "Status", "Average Score", "Client Contact", "Contact Email", "Sent At", "Completed At"])
        for item in analytics.timeline:
            writer.writerow([
                item.phase,
                item.status,
                f"{item.average_score:.2f}" if item.average_score is not None else "-",
                item.client_contact_name or "-",
                item.client_contact_email or "-",
                item.sent_at or "-",
                item.completed_at or "-",
            ])
        writer.writerow([])

        # Qualitative Feedback
        writer.writerow(["=== QUALITATIVE CLIENT FEEDBACK & COMMENTS ==="])
        writer.writerow(["Phase", "Question", "Client Comment", "Contact Name", "Contact Email", "Submitted At"])
        for c in analytics.qualitative_comments:
            writer.writerow([
                c.phase,
                c.question_text,
                c.text_answer,
                c.client_contact_name or "-",
                c.client_contact_email or "-",
                c.submitted_at or "-",
            ])

        content = ("\ufeff" + output.getvalue()).encode("utf-8")
        safe_name = sanitize_filename(analytics.project_name)
        filename = f"{safe_name}.csv"
        return content, filename, "text/csv; charset=utf-8"

# ── Surveys Registry Export ─────────────────────────────────────────────────
def export_surveys_registry(
    db: Session,
    status_filter: Optional[str] = None,
    client_id: Optional[int] = None,
    project_id: Optional[int] = None,
    survey_id: Optional[int] = None,
    format: str = "csv"
) -> Tuple[bytes, str, str]:
    """
    Exports all or filtered surveys from the surveys registry.
    Returns: (file_bytes, filename, media_type)
    """
    surveys = get_surveys(db, status_filter=status_filter, client_id=client_id, project_id=project_id)
    target_project_name = None
    if survey_id is not None:
        surveys = [s for s in surveys if s.id == survey_id]
        if surveys and surveys[0].project and surveys[0].project.name:
            target_project_name = surveys[0].project.name
    elif project_id is not None:
        proj = db.query(Project).filter(Project.id == project_id).first()
        if proj and proj.name:
            target_project_name = proj.name
    elif len(surveys) == 1 and surveys[0].project and surveys[0].project.name:
        target_project_name = surveys[0].project.name

    if target_project_name:
        clean_name = sanitize_filename(target_project_name)
        csv_filename = f"{clean_name}.csv"
        xlsx_filename = f"{clean_name}.xlsx"
    else:
        csv_filename = "CSAT_Surveys_Registry.csv"
        xlsx_filename = "CSAT_Surveys_Registry.xlsx"

    headers = [
        "Client Name",
        "Project Name",
        "Phase",
        "Status",
        "Average CSAT (1-5)",
        "Client Contact Name",
        "Client Contact Email",
        "Created At",
        "Sent At",
        "Completed At",
        "Follow-up Reminded At",
    ]

    if format.lower() == "xlsx":
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "CSAT Surveys"

        for c_idx, h in enumerate(headers, start=1):
            cell = ws.cell(row=1, column=c_idx, value=h)
            cell.font = HEADER_FONT
            cell.fill = HEADER_FILL

        for r_idx, s in enumerate(surveys, start=2):
            vals = [
                s.client.name if s.client else "-",
                s.project.name if s.project else "-",
                s.phase,
                s.status,
                f"{s.average_score:.2f}" if s.average_score is not None else "-",
                s.client_contact_name or "-",
                s.client_contact_email or "-",
                s.created_at.strftime("%Y-%m-%d %H:%M") if s.created_at else "-",
                s.sent_at.strftime("%Y-%m-%d %H:%M") if s.sent_at else "-",
                s.completed_at.strftime("%Y-%m-%d %H:%M") if s.completed_at else "-",
                s.followup_sent_at.strftime("%Y-%m-%d %H:%M") if s.followup_sent_at else "-",
            ]
            for c_idx, val in enumerate(vals, start=1):
                cell = ws.cell(row=r_idx, column=c_idx, value=val)
                cell.font = DATA_FONT
                cell.border = CELL_BORDER

        _autofit_columns(ws)

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output.getvalue(), xlsx_filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    else:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)

        for s in surveys:
            writer.writerow([
                s.client.name if s.client else "-",
                s.project.name if s.project else "-",
                s.phase,
                s.status,
                f"{s.average_score:.2f}" if s.average_score is not None else "-",
                s.client_contact_name or "-",
                s.client_contact_email or "-",
                s.created_at.strftime("%Y-%m-%d %H:%M") if s.created_at else "-",
                s.sent_at.strftime("%Y-%m-%d %H:%M") if s.sent_at else "-",
                s.completed_at.strftime("%Y-%m-%d %H:%M") if s.completed_at else "-",
                s.followup_sent_at.strftime("%Y-%m-%d %H:%M") if s.followup_sent_at else "-",
            ])

        return output.getvalue().encode("utf-8"), csv_filename, "text/csv"

# ── Portfolio Overview Export ───────────────────────────────────────────────
def export_portfolio_overview(db: Session, format: str = "csv") -> Tuple[bytes, str, str]:
    """
    Exports executive portfolio-level CSAT analytics across all clients and projects.
    Returns: (file_bytes, filename, media_type)
    """
    overview = get_system_overview(db)

    headers = [
        "Project Name",
        "Client Name",
        "Project Manager",
        "Total Surveys",
        "Completed Surveys",
        "Response Rate %",
        "Average CSAT (1-5)",
    ]

    projects = db.query(Project).filter(Project.is_active == True).all()

    if format.lower() == "xlsx":
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Executive CSAT Summary"

        ws.cell(row=1, column=1, value="CSAT Portfolio Executive Summary").font = TITLE_FONT
        csat_str = f"{overview.overall_csat:.2f} / 5.0" if overview.overall_csat is not None else "N/A"
        ws.cell(row=2, column=1, value=f"Overall CSAT: {csat_str} | Total Surveys: {overview.total_surveys_sent} | Response Rate: {overview.response_rate}%").font = SUBTITLE_FONT

        row_start = 4
        for c_idx, h in enumerate(headers, start=1):
            cell = ws.cell(row=row_start, column=c_idx, value=h)
            cell.font = HEADER_FONT
            cell.fill = HEADER_FILL

        for r_idx, p in enumerate(projects, start=row_start + 1):
            p_surveys = db.query(Survey).filter(Survey.project_id == p.id, Survey.status != "Archived").all()
            p_completed = [s for s in p_surveys if s.status == "Completed"]
            p_scores = [s.average_score for s in p_completed if s.average_score is not None]
            avg_score = round(sum(p_scores) / len(p_scores), 2) if p_scores else None
            resp_rate = round(len(p_completed) / len(p_surveys) * 100, 1) if p_surveys else 0.0

            vals = [
                p.name,
                p.client.name if p.client else "-",
                p.team_name or "-",
                len(p_surveys),
                len(p_completed),
                f"{resp_rate}%",
                f"{avg_score:.2f}" if avg_score is not None else "-",
            ]
            for c_idx, val in enumerate(vals, start=1):
                cell = ws.cell(row=r_idx, column=c_idx, value=val)
                cell.font = DATA_FONT
                cell.border = CELL_BORDER

        _autofit_columns(ws)

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output.getvalue(), "CSAT_Portfolio_Overview.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    else:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["=== CSAT PORTFOLIO OVERVIEW ==="])
        writer.writerow(["Overall Portfolio CSAT", f"{overview.overall_csat:.2f}" if overview.overall_csat is not None else "N/A"])
        writer.writerow(["Portfolio Response Rate", f"{overview.response_rate}%"])
        writer.writerow(["Total Surveys Sent", overview.total_surveys_sent])
        writer.writerow(["Total Responses", overview.total_responses])
        writer.writerow(["Total Clients", overview.total_clients_count])
        writer.writerow(["Active Projects", overview.active_projects_count])
        writer.writerow([])

        writer.writerow(headers)
        for p in projects:
            p_surveys = db.query(Survey).filter(Survey.project_id == p.id, Survey.status != "Archived").all()
            p_completed = [s for s in p_surveys if s.status == "Completed"]
            p_scores = [s.average_score for s in p_completed if s.average_score is not None]
            avg_score = round(sum(p_scores) / len(p_scores), 2) if p_scores else None
            resp_rate = round(len(p_completed) / len(p_surveys) * 100, 1) if p_surveys else 0.0

            writer.writerow([
                p.name,
                p.client.name if p.client else "-",
                p.team_name or "-",
                len(p_surveys),
                len(p_completed),
                f"{resp_rate}%",
                f"{avg_score:.2f}" if avg_score is not None else "-",
            ])

        return output.getvalue().encode("utf-8"), "CSAT_Portfolio_Overview.csv", "text/csv"
