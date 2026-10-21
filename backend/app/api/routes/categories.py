from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_admin
from app.models.user import User
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/categories", tags=["Feedback Categories"])

@router.get("", response_model=List[CategoryResponse])
def get_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all feedback categories. Available to all authenticated PMO users.
    """
    return db.query(Category).order_by(Category.order_index, Category.id).all()

@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    cat_in: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Create a new feedback category. Restricted to Admin only (User returns 403 Forbidden).
    """
    existing = db.query(Category).filter(Category.name.ilike(cat_in.name.strip())).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category '{cat_in.name}' already exists."
        )

    category = Category(
        name=cat_in.name.strip(),
        description=cat_in.description,
        is_active=cat_in.is_active,
        order_index=cat_in.order_index,
    )
    db.add(category)
    db.commit()
    db.refresh(category)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        actor_email=current_user.email,
        action="CREATE_CATEGORY",
        resource_type="CATEGORY",
        resource_id=category.id,
        details=f"Created feedback category '{category.name}'",
    )
    return category

@router.put("/{cat_id}", response_model=CategoryResponse)
def update_category(
    cat_id: int,
    cat_in: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Update feedback category. Restricted to Admin only (User returns 403 Forbidden).
    """
    category = db.query(Category).filter(Category.id == cat_id).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    update_data = cat_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)

    db.commit()
    db.refresh(category)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        actor_email=current_user.email,
        action="UPDATE_CATEGORY",
        resource_type="CATEGORY",
        resource_id=category.id,
        details=f"Updated category #{category.id}: {', '.join(update_data.keys())}",
    )
    return category

@router.patch("/{cat_id}/toggle", response_model=CategoryResponse)
def toggle_category_status(
    cat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Toggle category active/inactive. Restricted to Admin only.
    """
    category = db.query(Category).filter(Category.id == cat_id).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    category.is_active = not category.is_active
    db.commit()
    db.refresh(category)

    log_audit_event(
        db=db,
        user_id=current_user.id,
        actor_email=current_user.email,
        action="TOGGLE_CATEGORY",
        resource_type="CATEGORY",
        resource_id=category.id,
        details=f"{'Activated' if category.is_active else 'Deactivated'} category '{category.name}'",
    )
    return category

@router.delete("/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    cat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Delete a category. Restricted to Admin only.
    """
    category = db.query(Category).filter(Category.id == cat_id).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    name = category.name
    db.delete(category)
    db.commit()

    log_audit_event(
        db=db,
        user_id=current_user.id,
        actor_email=current_user.email,
        action="DELETE_CATEGORY",
        resource_type="CATEGORY",
        resource_id=cat_id,
        details=f"Deleted category '{name}'",
    )
    return None
