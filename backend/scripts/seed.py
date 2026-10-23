import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from datetime import datetime, timezone
from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User
from app.models.client import Client
from app.models.project import Project
from app.services.sync_service import confirm_sync

def seed():
    """
    Idempotently seed default admin user and initial clients/projects dataset.
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
                role="Admin",
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
            print(f"[SEED] Created initial admin user: {admin_email}")
        else:
            admin_user.role = "Admin"
            admin_user.hashed_password = hash_password(admin_password)
            db.commit()
            print(f"[SEED] Initial admin user verified: {admin_email}")

        # 2. Seed Reviewer User (Maker-Checker workflow)
        reviewer_email = settings.SEED_REVIEWER_EMAIL.strip().lower()
        reviewer_password = settings.SEED_REVIEWER_PASSWORD
        reviewer_user = db.query(User).filter(User.email == reviewer_email).first()

        if not reviewer_user:
            reviewer_user = User(
                email=reviewer_email,
                full_name="Reviewer User",
                hashed_password=hash_password(reviewer_password),
                role="PMO",
                is_active=True
            )
            db.add(reviewer_user)
            db.commit()
            db.refresh(reviewer_user)
            print(f"[SEED] Created reviewer user: {reviewer_email}")
        else:
            reviewer_user.hashed_password = hash_password(reviewer_password)
            reviewer_user.role = "PMO"
            db.commit()
            print(f"[SEED] Reviewer user verified: {reviewer_email}")

        # 3. Soft-archive legacy dummy test data (CL-1001 to CL-1005) if present
        dummy_clients = db.query(Client).filter(
            Client.client_code.in_(["CL-1001", "CL-1002", "CL-1003", "CL-1004", "CL-1005"])
        ).all()
        if dummy_clients:
            now = datetime.now(timezone.utc)
            for dc in dummy_clients:
                dc.is_active = False
                dc.archived_at = now
                for dp in dc.projects:
                    dp.is_active = False
                    dp.archived_at = now
            db.commit()
            print("[SEED] Soft-archived legacy dummy clients (CL-1001 to CL-1005)")

        # 4. Seed initial clients & projects from CSV (prefer Projects_Overview_Report.csv)
        candidates = [
            backend_dir.parent / "Projects_Overview_Report.csv",
            backend_dir / "Projects_Overview_Report.csv",
            backend_dir / "seed" / "clients_projects.csv",
        ]
        seed_csv_path = next((p for p in candidates if p.exists()), None)
        if not seed_csv_path:
            print(f"[WARN] No seed file found in {[str(p) for p in candidates]}, skipping data load.")
            return

        print(f"[SEED] Loading clients and projects from {seed_csv_path} via sync service...")
        with open(seed_csv_path, "rb") as f:
            file_bytes = f.read()

        result = confirm_sync(
            db=db,
            file_bytes=file_bytes,
            filename=seed_csv_path.name,
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
