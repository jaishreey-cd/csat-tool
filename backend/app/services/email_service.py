import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings

logger = logging.getLogger(__name__)

def send_survey_invitation_email(
    recipient_email: str,
    recipient_name: str,
    survey_code: str,
    project_name: str,
    client_name: str,
    phase: str,
    survey_token: str,
) -> dict:
    """
    Sends an invitation email containing the unique secure survey link to the client stakeholder.
    If SMTP credentials (e.g. Gmail) are configured in .env, delivers via SMTP.
    If SMTP credentials are not yet configured, logs the invitation details and simulates delivery.
    """
    survey_url = f"{settings.FRONTEND_URL}/s/{survey_token}"
    subject = f"Invitation: CSAT Evaluation for {project_name} ({phase})"

    # Plain text version
    text_content = f"""Dear {recipient_name},

You have been invited by the PMO team to submit your Customer Satisfaction (CSAT) feedback for the following project:

Client: {client_name}
Project: {project_name}
Phase: {phase}
Survey Code: {survey_code}

Please access your secure survey evaluation link below to submit your feedback:
{survey_url}

Thank you for your valuable partnership.

Best regards,
{settings.SMTP_FROM_NAME}
"""

    # Modern responsive HTML email
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Customer Satisfaction Survey</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1329; margin: 0; padding: 24px; color: #e2e8f0; }}
    .container {{ max-width: 600px; margin: 0 auto; background: #0d1b2a; border-radius: 12px; border: 1px solid rgba(96, 165, 250, 0.25); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
    .header {{ background: linear-gradient(135deg, #1d4ed8 0%, #0d1b2a 100%); padding: 32px 28px; text-align: center; border-bottom: 1px solid rgba(96, 165, 250, 0.2); }}
    .header h1 {{ color: #ffffff; font-size: 22px; margin: 0; font-weight: 700; }}
    .header p {{ color: #94a3b8; font-size: 14px; margin: 8px 0 0; }}
    .body {{ padding: 28px; font-size: 15px; line-height: 1.6; color: #cbd5e1; }}
    .info-card {{ background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(96, 165, 250, 0.2); border-radius: 8px; padding: 16px 20px; margin: 22px 0; }}
    .info-row {{ display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }}
    .info-row:last-child {{ margin-bottom: 0; }}
    .info-label {{ color: #64748b; font-weight: 600; }}
    .info-value {{ color: #ffffff; font-weight: 600; text-align: right; }}
    .btn-container {{ text-align: center; margin: 32px 0 24px; }}
    .btn {{ display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 34px; border-radius: 8px; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4); }}
    .url-fallback {{ background: rgba(10, 22, 40, 0.9); padding: 12px 14px; border-radius: 6px; font-family: monospace; font-size: 12px; color: #93c5fd; word-break: break-all; margin-top: 8px; border: 1px solid rgba(96, 165, 250, 0.2); }}
    .footer {{ padding: 20px 28px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid rgba(96, 165, 250, 0.1); background: rgba(10, 22, 40, 0.5); }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Customer Satisfaction (CSAT) Survey</h1>
      <p>We value your partnership and continuous feedback</p>
    </div>
    <div class="body">
      <p>Dear <strong>{recipient_name}</strong>,</p>
      <p>You are cordially invited to complete our Customer Satisfaction evaluation for your ongoing project engagement. Your feedback is confidential and will directly guide our delivery enhancements.</p>
      
      <div class="info-card">
        <div class="info-row"><span class="info-label">Client:</span> <span class="info-value">{client_name}</span></div>
        <div class="info-row"><span class="info-label">Project:</span> <span class="info-value">{project_name}</span></div>
        <div class="info-row"><span class="info-label">Phase:</span> <span class="info-value">{phase}</span></div>
        <div class="info-row"><span class="info-label">Survey Code:</span> <span class="info-value" style="color:#60a5fa; font-family:monospace;">{survey_code}</span></div>
      </div>

      <div class="btn-container">
        <a href="{survey_url}" class="btn" target="_blank">Start CSAT Evaluation &rarr;</a>
      </div>

      <p style="font-size: 13px; color: #94a3b8; margin-top: 24px;">If the button above does not open directly, copy and paste this link into your browser:</p>
      <div class="url-fallback">{survey_url}</div>
    </div>
    <div class="footer">
      <p>Dispatched by {settings.SMTP_FROM_NAME} &bull; Confidential &bull; Single-response secure link</p>
    </div>
  </div>
</body>
</html>
"""

    raw_from = (settings.SMTP_FROM_EMAIL or "").strip()
    smtp_user = settings.SMTP_USER.strip()
    smtp_password = settings.SMTP_PASSWORD.strip().replace(" ", "")

    from_email = raw_from if ("@" in raw_from) else (smtp_user or "noreply@csat.local")
    from_header = f'"{settings.SMTP_FROM_NAME}" <{from_email}>'

    # If SMTP credentials are not configured, simulate and log
    if not smtp_user or not smtp_password:
        print(f"\n[EMAIL DISPATCH SIMULATION]")
        print(f"To: {recipient_name} <{recipient_email}>")
        print(f"Subject: {subject}")
        print(f"Survey URL: {survey_url}")
        print(f"[Note: Add SMTP_USER and SMTP_PASSWORD to backend/.env to send real emails via Gmail/SMTP]\n")
        logger.info(f"[EMAIL SIMULATION] Sent survey link to {recipient_email}: {survey_url}")
        return {
            "success": True,
            "mode": "simulated",
            "message": f"Simulated dispatch to {recipient_email}. (Configure SMTP_USER & SMTP_PASSWORD in .env for live Gmail delivery)",
            "recipient": recipient_email,
            "survey_url": survey_url,
        }

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_header
        msg["To"] = recipient_email

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
            if settings.SMTP_TLS:
                server.starttls()

        server.login(smtp_user, smtp_password)
        server.sendmail(from_email, [recipient_email], msg.as_string())
        server.quit()

        print(f"[EMAIL DISPATCH SUCCESS] Real email sent to {recipient_email} via {settings.SMTP_HOST}")
        logger.info(f"[EMAIL DISPATCH SUCCESS] Real email sent to {recipient_email}")
        return {
            "success": True,
            "mode": "live",
            "message": f"Survey link successfully emailed to {recipient_email}!",
            "recipient": recipient_email,
            "survey_url": survey_url,
        }
    except Exception as e:
        print(f"[EMAIL DISPATCH ERROR] Failed to send email to {recipient_email}: {e}")
        logger.error(f"[EMAIL DISPATCH ERROR] {e}")
        return {
            "success": False,
            "mode": "error",
            "message": f"Failed to deliver email: {str(e)}",
            "recipient": recipient_email,
            "survey_url": survey_url,
        }

def send_survey_reminder_email(
    recipient_email: str,
    recipient_name: str,
    survey_code: str,
    project_name: str,
    client_name: str,
    phase: str,
    survey_token: str,
) -> dict:
    """
    Sends a follow-up reminder email to client contact for pending survey evaluations.
    """
    survey_url = f"{settings.FRONTEND_URL}/s/{survey_token}"
    subject = f"Gentle Reminder: CSAT Feedback for {project_name} ({phase})"

    text_content = f"""Dear {recipient_name},

This is a gentle follow-up regarding the Customer Satisfaction (CSAT) evaluation for {project_name} ({client_name}).

Your perspective is invaluable to our engineering and PMO teams in ensuring the highest delivery standards.

Please take 2-3 minutes to submit your evaluation using your private link:
{survey_url}

Survey Code: {survey_code}

Thank you for your continued partnership.

Best regards,
{settings.SMTP_FROM_NAME}
"""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CSAT Reminder</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1329; margin: 0; padding: 24px; color: #e2e8f0; }}
    .container {{ max-width: 600px; margin: 0 auto; background: #0d1b2a; border-radius: 12px; border: 1px solid rgba(245, 158, 11, 0.35); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
    .header {{ background: linear-gradient(135deg, #b45309 0%, #0d1b2a 100%); padding: 32px 28px; text-align: center; border-bottom: 1px solid rgba(245, 158, 11, 0.2); }}
    .header h1 {{ color: #ffffff; font-size: 22px; margin: 0; font-weight: 700; }}
    .header p {{ color: #fde68a; font-size: 14px; margin: 8px 0 0; }}
    .body {{ padding: 28px; font-size: 15px; line-height: 1.6; color: #cbd5e1; }}
    .info-card {{ background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 8px; padding: 16px 20px; margin: 22px 0; }}
    .info-row {{ display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }}
    .info-row:last-child {{ margin-bottom: 0; }}
    .info-label {{ color: #94a3b8; font-weight: 600; }}
    .info-value {{ color: #ffffff; font-weight: 600; text-align: right; }}
    .btn-container {{ text-align: center; margin: 32px 0 24px; }}
    .btn {{ display: inline-block; background: #f59e0b; color: #0b1329 !important; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 34px; border-radius: 8px; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4); }}
    .url-fallback {{ background: rgba(10, 22, 40, 0.9); padding: 12px 14px; border-radius: 6px; font-family: monospace; font-size: 12px; color: #fde68a; word-break: break-all; margin-top: 8px; border: 1px solid rgba(245, 158, 11, 0.2); }}
    .footer {{ padding: 20px 28px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid rgba(245, 158, 11, 0.1); background: rgba(10, 22, 40, 0.5); }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CSAT Evaluation Reminder</h1>
      <p>Gentle follow-up regarding your recent project milestone</p>
    </div>
    <div class="body">
      <p>Dear <strong>{recipient_name}</strong>,</p>
      <p>We recently sent you an invitation for Customer Satisfaction feedback on <strong>{project_name}</strong>. If you haven't had a chance to complete it yet, we would love to hear your thoughts.</p>
      
      <div class="info-card">
        <div class="info-row"><span class="info-label">Client:</span> <span class="info-value">{client_name}</span></div>
        <div class="info-row"><span class="info-label">Project:</span> <span class="info-value">{project_name}</span></div>
        <div class="info-row"><span class="info-label">Phase:</span> <span class="info-value">{phase}</span></div>
        <div class="info-row"><span class="info-label">Survey Code:</span> <span class="info-value" style="color:#fbbf24; font-family:monospace;">{survey_code}</span></div>
      </div>

      <div class="btn-container">
        <a href="{survey_url}" class="btn" target="_blank">Complete Evaluation Now &rarr;</a>
      </div>

      <p style="font-size: 13px; color: #94a3b8; margin-top: 24px;">Link:</p>
      <div class="url-fallback">{survey_url}</div>
    </div>
    <div class="footer">
      <p>Dispatched by {settings.SMTP_FROM_NAME} &bull; Confidential &bull; Single-response secure link</p>
    </div>
  </div>
</body>
</html>
"""

    raw_from = (settings.SMTP_FROM_EMAIL or "").strip()
    smtp_user = settings.SMTP_USER.strip()
    smtp_password = settings.SMTP_PASSWORD.strip().replace(" ", "")

    from_email = raw_from if ("@" in raw_from) else (smtp_user or "noreply@csat.local")
    from_header = f'"{settings.SMTP_FROM_NAME}" <{from_email}>'

    if not smtp_user or not smtp_password:
        print(f"\n[EMAIL REMINDER SIMULATION]")
        print(f"To: {recipient_name} <{recipient_email}>")
        print(f"Subject: {subject}")
        print(f"Survey URL: {survey_url}")
        logger.info(f"[EMAIL REMINDER SIMULATION] Sent reminder to {recipient_email}: {survey_url}")
        return {
            "success": True,
            "mode": "simulated",
            "message": f"Simulated reminder dispatch to {recipient_email}.",
            "recipient": recipient_email,
            "survey_url": survey_url,
        }

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_header
        msg["To"] = recipient_email

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
            if settings.SMTP_TLS:
                server.starttls()

        server.login(smtp_user, smtp_password)
        server.sendmail(from_email, [recipient_email], msg.as_string())
        server.quit()

        print(f"[EMAIL REMINDER SUCCESS] Reminder email sent to {recipient_email}")
        logger.info(f"[EMAIL REMINDER SUCCESS] Reminder email sent to {recipient_email}")
        return {
            "success": True,
            "mode": "live",
            "message": f"Reminder email sent to {recipient_email}!",
            "recipient": recipient_email,
            "survey_url": survey_url,
        }
    except Exception as e:
        print(f"[EMAIL REMINDER ERROR] {e}")
        logger.error(f"[EMAIL REMINDER ERROR] {e}")
        return {
            "success": False,
            "mode": "error",
            "message": f"Failed to deliver reminder email: {str(e)}",
            "recipient": recipient_email,
            "survey_url": survey_url,
        }

def verify_smtp_status() -> dict:
    """Verifies whether the configured SMTP server is reachable and credentials are valid."""
    smtp_user = settings.SMTP_USER.strip()
    smtp_password = settings.SMTP_PASSWORD.strip().replace(" ", "")

    if not smtp_user or not smtp_password:
        return {
            "configured": False,
            "connected": False,
            "host": settings.SMTP_HOST,
            "port": settings.SMTP_PORT,
            "from_email": settings.SMTP_FROM_EMAIL or "Not configured",
            "message": "SMTP credentials are not configured in .env (simulation mode active)."
        }

    try:
        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=8)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=8)
            if settings.SMTP_TLS:
                server.starttls()

        server.login(smtp_user, smtp_password)
        server.quit()
        return {
            "configured": True,
            "connected": True,
            "host": settings.SMTP_HOST,
            "port": settings.SMTP_PORT,
            "sender_email": settings.SMTP_USER,
            "from_name": settings.SMTP_FROM_NAME,
            "message": f"Connected and authenticated successfully with {settings.SMTP_HOST}."
        }
    except Exception as e:
        return {
            "configured": True,
            "connected": False,
            "host": settings.SMTP_HOST,
            "port": settings.SMTP_PORT,
            "sender_email": settings.SMTP_USER,
            "error": str(e),
            "message": f"SMTP connection failed: {str(e)}"
        }

def send_test_email(recipient_email: str) -> dict:
    """Sends a test diagnostic email to confirm end-to-end delivery."""
    smtp_user = settings.SMTP_USER.strip()
    smtp_password = settings.SMTP_PASSWORD.strip().replace(" ", "")

    if not smtp_user or not smtp_password:
        return {
            "success": False,
            "message": "SMTP credentials are not configured in backend/.env"
        }

    raw_from = (settings.SMTP_FROM_EMAIL or "").strip()
    from_email = raw_from if ("@" in raw_from) else smtp_user
    from_header = f'"{settings.SMTP_FROM_NAME}" <{from_email}>'

    subject = f"Test Email from {settings.PROJECT_NAME} System"
    text_content = f"This is a test email sent from the {settings.PROJECT_NAME} platform to confirm SMTP delivery configuration is operational."
    html_content = f"""<div style="font-family:sans-serif; background:#0b1329; color:#e2e8f0; padding:24px; border-radius:8px;">
        <h2 style="color:#60a5fa;">{settings.PROJECT_NAME} Email Verification</h2>
        <p>This email confirms that real SMTP email dispatch is verified and operational.</p>
        <p style="color:#94a3b8; font-size:12px;">Sent via {settings.SMTP_HOST}:{settings.SMTP_PORT}</p>
    </div>"""

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_header
        msg["To"] = recipient_email
        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=12)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=12)
            if settings.SMTP_TLS:
                server.starttls()

        server.login(smtp_user, smtp_password)
        server.sendmail(from_email, [recipient_email], msg.as_string())
        server.quit()

        return {
            "success": True,
            "message": f"Test email successfully dispatched to {recipient_email}!"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to send test email: {str(e)}"
        }

def send_response_followup_email(
    recipient_email: str,
    recipient_name: str,
    project_name: str,
    client_name: str,
    phase: str,
    average_score: float = None,
    custom_message: str = None,
) -> dict:
    """
    Sends a follow-up email to the client regarding their submitted survey response,
    acknowledging receipt, thanking them, and offering follow-up discussion.
    """
    subject = f"Thank you for your feedback: CSAT Evaluation for {project_name}"
    
    score_text = f"Overall CSAT Rating Recorded: {average_score} / 5.0\n" if average_score else ""
    note_text = f"\nPMO Team Follow-up Note:\n{custom_message}\n" if custom_message else ""

    text_content = f"""Dear {recipient_name},

Thank you for completing the CSAT survey for {project_name} ({client_name}) - Phase: {phase}.
{score_text}{note_text}
Your insights are invaluable in driving our continuous service improvements and delivering excellence.
Our project team and leadership review all feedback carefully. If you have any further observations or would like to schedule a discussion, please feel free to reach out to us directly.

Thank you again for your trusted partnership.

Best regards,
{settings.SMTP_FROM_NAME}
"""

    score_badge_html = f"""
    <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 12px 18px; margin: 16px 0; text-align: center;">
      <span style="color: #6ee7b7; font-size: 14px; font-weight: 600;">Recorded Rating: </span>
      <span style="color: #ffffff; font-size: 18px; font-weight: 700; margin-left: 6px;">{average_score} / 5.0</span>
    </div>
    """ if average_score else ""

    custom_note_html = f"""
    <div style="background: rgba(96, 165, 250, 0.1); border-left: 3px solid #3b82f6; border-radius: 4px; padding: 12px 16px; margin: 16px 0; color: #e2e8f0; font-size: 14px;">
      <strong style="color: #93c5fd; display: block; margin-bottom: 4px;">PMO Follow-up Message:</strong>
      {custom_message}
    </div>
    """ if custom_message else ""

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Thank You for Your CSAT Feedback</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b1329; margin: 0; padding: 24px; color: #e2e8f0; }}
    .container {{ max-width: 600px; margin: 0 auto; background: #0d1b2a; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.25); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
    .header {{ background: linear-gradient(135deg, #059669 0%, #0d1b2a 100%); padding: 32px 28px; text-align: center; border-bottom: 1px solid rgba(16, 185, 129, 0.2); }}
    .header h1 {{ color: #ffffff; font-size: 22px; margin: 0; font-weight: 700; }}
    .header p {{ color: #a7f3d0; font-size: 14px; margin: 8px 0 0; }}
    .body {{ padding: 28px; font-size: 15px; line-height: 1.6; color: #cbd5e1; }}
    .footer {{ padding: 20px 28px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid rgba(16, 185, 129, 0.1); background: rgba(10, 22, 40, 0.5); }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Thank You for Your Feedback</h1>
      <p>Your CSAT evaluation has been recorded</p>
    </div>
    <div class="body">
      <p>Dear <strong>{recipient_name}</strong>,</p>
      <p>We gratefully acknowledge receipt of your CSAT evaluation for <strong>{project_name}</strong> ({client_name}) - Phase: <strong>{phase}</strong>.</p>
      {score_badge_html}
      {custom_note_html}
      <p>Our delivery leads and PMO team review all feedback closely to maintain the highest quality of service. We appreciate your valuable time and collaboration.</p>
    </div>
    <div class="footer">
      <p>{settings.SMTP_FROM_NAME} &bull; Customer Satisfaction Program</p>
    </div>
  </div>
</body>
</html>
"""

    raw_from = (settings.SMTP_FROM_EMAIL or "").strip()
    smtp_user = settings.SMTP_USER.strip()
    smtp_password = settings.SMTP_PASSWORD.strip().replace(" ", "")

    from_email = raw_from if ("@" in raw_from) else (smtp_user or "noreply@csat.local")
    from_header = f'"{settings.SMTP_FROM_NAME}" <{from_email}>'

    if not smtp_user or not smtp_password:
        print(f"\n[RESPONSE FOLLOW-UP EMAIL SIMULATION]")
        print(f"To: {recipient_name} <{recipient_email}>")
        print(f"Subject: {subject}")
        logger.info(f"[RESPONSE FOLLOW-UP SIMULATION] Sent follow-up to {recipient_email}")
        return {
            "success": True,
            "mode": "simulated",
            "message": f"Simulated response follow-up sent to {recipient_email}.",
            "recipient": recipient_email,
        }

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_header
        msg["To"] = recipient_email

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15)
            if settings.SMTP_TLS:
                server.starttls()

        server.login(smtp_user, smtp_password)
        server.sendmail(from_email, [recipient_email], msg.as_string())
        server.quit()

        logger.info(f"[RESPONSE FOLLOW-UP SUCCESS] Email sent to {recipient_email}")
        return {
            "success": True,
            "mode": "live",
            "message": f"Response follow-up email sent to {recipient_email}!",
            "recipient": recipient_email,
        }
    except Exception as e:
        logger.error(f"[RESPONSE FOLLOW-UP ERROR] {e}")
        return {
            "success": False,
            "mode": "error",
            "message": f"Failed to deliver response follow-up email: {str(e)}",
            "recipient": recipient_email,
        }


