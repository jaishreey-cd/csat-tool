from typing import Optional, Any
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog

def log_audit_event(
    db: Session,
    user_id: Optional[int],
    actor_email: str,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> AuditLog:
    """Create and persist an audit log entry."""
    entry = AuditLog(
        user_id=user_id,
        actor_email=actor_email,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        details=details,
        ip_address=ip_address,
    )
    db.add(entry)
    try:
        db.commit()
        db.refresh(entry)
    except Exception as e:
        db.rollback()
        print(f"[AUDIT LOG ERROR] Failed to record audit log: {e}")
    return entry
