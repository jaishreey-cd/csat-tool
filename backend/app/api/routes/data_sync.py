from typing import List, Literal
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.models.user import User
from app.schemas.data_sync import (
    PreviewResponse,
    ConfirmResponse,
    ImportBatchItem,
    RollbackResponse,
)
from app.services.sync_service import (
    preview_sync,
    confirm_sync,
    list_imports,
    rollback_latest_batch,
)
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/data", tags=["Data Sync"])

@router.post("/sync/preview", response_model=PreviewResponse)
async def preview_data_sync(
    file: UploadFile = File(...),
    mode: str = Form("add_update"),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Parse and validate uploaded dataset WITHOUT writing anything to the database.
    Returns diff summary: new, updated (with field changes), unchanged, reactivated,
    and would_be_archived (for full_sync), plus row-level validation errors & in-file duplicates.
    Restricted to Admin only.
    """
    if mode not in ["add_update", "full_sync"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mode must be either 'add_update' or 'full_sync'."
        )

    file_bytes = await file.read()
    return preview_sync(db, file_bytes=file_bytes, filename=file.filename, mode=mode)

@router.post("/sync/confirm", response_model=ConfirmResponse)
async def confirm_data_sync(
    file: UploadFile = File(...),
    mode: str = Form("add_update"),
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Re-validate and apply merge inside ONE atomic database transaction.
    Stores original file in UPLOAD_DIR for audit trail.
    Writes ImportBatch and individual ImportChange records.
    Restricted to Admin only.
    """
    if mode not in ["add_update", "full_sync"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mode must be either 'add_update' or 'full_sync'."
        )

    file_bytes = await file.read()
    result = confirm_sync(
        db,
        file_bytes=file_bytes,
        filename=file.filename,
        mode=mode,
        user_id=admin_user.id
    )
    log_audit_event(
        db=db,
        user_id=admin_user.id,
        actor_email=admin_user.email,
        action="IMPORT_DATA",
        resource_type="IMPORT_BATCH",
        resource_id=result.batch_id,
        details=f"Imported file '{file.filename}' (mode: {mode}): {result.new_clients} new clients, {result.new_projects} new projects",
    )
    return result

@router.get("/imports", response_model=List[ImportBatchItem])
def get_import_history(
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get import history newest first with batch counts, user, and timestamps. Restricted to Admin only."""
    return list_imports(db)

@router.post("/imports/{batch_id}/rollback", response_model=RollbackResponse)
def rollback_import(
    batch_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Rollback changes of the most recent applied import batch.
    Returns 409 if batch is not the latest applied batch.
    Restricted to Admin only.
    """
    result = rollback_latest_batch(db, batch_id=batch_id)
    log_audit_event(
        db=db,
        user_id=admin_user.id,
        actor_email=admin_user.email,
        action="ROLLBACK_IMPORT",
        resource_type="IMPORT_BATCH",
        resource_id=batch_id,
        details=f"Rolled back import batch #{batch_id}",
    )
    return result
