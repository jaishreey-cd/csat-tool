import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User
from app.services.sync_service import confirm_sync

def seed():
    """
    Idempotently seed default admin user, reviewer user, and initial clients/projects dataset.
    Never logs or returns password hashes.
    """
    db = SessionLocal()
    try:
        # 1. Seed Admin User
        admin_email = settings.SEED_ADMIN_EMAIL.strip().lower()
        admin_password = settings.SEED_ADMIN_PASSWORD
        admin_user = db.query(User).filter(User.email == admin_email).first()

        if not admin_user:
            admin_user = User(
                email=admin_email,
                full_name="Admin User",
                hashed_password=hash_password(admin_password),
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
            print(f"[SEED] Created admin user: {admin_email}")
        else:
            # Update password hash if needed
            admin_user.hashed_password = hash_password(admin_password)
            db.commit()
            print(f"[SEED] Admin user verified: {admin_email}")

        # 2. Seed Reviewer User (Maker-Checker workflow)
        reviewer_email = settings.SEED_REVIEWER_EMAIL.strip().lower()
        reviewer_password = settings.SEED_REVIEWER_PASSWORD
        reviewer_user = db.query(User).filter(User.email == reviewer_email).first()

        if not reviewer_user:
            reviewer_user = User(
                email=reviewer_email,
                full_name="Reviewer User",
                hashed_password=hash_password(reviewer_password),
                is_active=True
            )
            db.add(reviewer_user)
            db.commit()
            db.refresh(reviewer_user)
            print(f"[SEED] Created reviewer user: {reviewer_email}")
        else:
            reviewer_user.hashed_password = hash_password(reviewer_password)
            db.commit()
            print(f"[SEED] Reviewer user verified: {reviewer_email}")

        # 3. Seed initial clients & projects from CSV
        seed_csv_path = backend_dir / "seed" / "clients_projects.csv"
        if not seed_csv_path.exists():
            print(f"[WARN] Seed file not found at {seed_csv_path}, skipping data load.")
            return

        print(f"[SEED] Loading clients and projects from {seed_csv_path} via sync service...")
        with open(seed_csv_path, "rb") as f:
            file_bytes = f.read()

        result = confirm_sync(
            db=db,
            file_bytes=file_bytes,
            filename="clients_projects.csv",
            mode="add_update",
            user_id=admin_user.id
        )

        print("[SEED] Data sync complete:")
        print(f"       • Clients created: {result.clients_created}, updated: {result.clients_updated}")
        print(f"       • Projects created: {result.projects_created}, updated: {result.projects_updated}")
        print(f"       • Unchanged records: {result.unchanged}")
        print(f"       • Batch ID: {result.batch_id}")
        print("[SEED] Database seeding completed successfully!")

    finally:
        db.close()

if __name__ == "__main__":
    seed()
