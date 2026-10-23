import os
import csv
from datetime import datetime
from sqlalchemy.orm import Session

from app.database import engine, SessionLocal, Base
from app.models import User, Client, Project
from app.auth import hash_password
from app.config import settings

def find_csv_path() -> str:
    """Search possible paths for Projects_Overview_Report.csv."""
    candidates = [
        settings.CSV_FILE_PATH,
        os.path.join(os.path.dirname(__file__), "..", "..", "Projects_Overview_Report.csv"),
        os.path.join(os.getcwd(), "Projects_Overview_Report.csv"),
        os.path.join(os.path.dirname(__file__), "Projects_Overview_Report.csv"),
        "F:/pmo-tool/Projects_Overview_Report.csv"
    ]
    for path in candidates:
        if os.path.isfile(path):
            return os.path.abspath(path)
    return candidates[0]

def seed_database():
    """Initializes tables, seeds default PMO users, and imports data from CSV."""
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # 1. Seed Default PMO Users
        default_users = [
            {
                "username": "pmo_admin",
                "email": "admin@pmo.com",
                "full_name": "Jaishree (PMO Admin)",
                "password": "Password@123",
                "role": "PMO Admin"
            },
            {
                "username": "pmo_user",
                "email": "user@pmo.com",
                "full_name": "PMO User",
                "password": "Password@123",
                "role": "PMO User"
            }
        ]

        users_created = 0
        for u_data in default_users:
            existing = db.query(User).filter(
                (User.username == u_data["username"]) | (User.email == u_data["email"])
            ).first()
            if not existing:
                new_user = User(
                    username=u_data["username"],
                    email=u_data["email"],
                    full_name=u_data["full_name"],
                    hashed_password=hash_password(u_data["password"]),
                    role=u_data["role"],
                    is_active=True
                )
                db.add(new_user)
                users_created += 1

        db.commit()

        # 2. Parse and Seed Utiliza CSV
        csv_path = find_csv_path()
        clients_created = 0
        clients_updated = 0
        projects_created = 0
        projects_updated = 0

        if not os.path.isfile(csv_path):
            print(f"[WARN] CSV file not found at: {csv_path}. Skipping CSV seed.")
            return {
                "users_created": users_created,
                "clients_created": 0,
                "projects_created": 0,
                "csv_found": False
            }

        print(f"[INFO] Importing Utiliza data from: {csv_path}")

        with open(csv_path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            
            # First pass: collect unique clients
            clients_dict = {}
            rows = list(reader)

            for row in rows:
                c_id = row.get("client_id", "").strip()
                c_name = row.get("client_name", "").strip()
                p_name = row.get("partner_name", "").strip()
                p_id = row.get("partner_id", "").strip()

                if c_id and c_id != "N/A":
                    if c_id not in clients_dict:
                        clients_dict[c_id] = {
                            "client_id": c_id,
                            "client_name": c_name if c_name else "Unknown Client",
                            "partner_name": p_name if p_name != "N/A" else None,
                            "partner_id": p_id if p_id != "N/A" else None,
                        }

            # Pre-fetch existing records to avoid N+1 network queries over Neon SSL
            existing_clients = {c.client_id: c for c in db.query(Client).all()}
            existing_projects = {p.project_id: p for p in db.query(Project).all()}

            # Upsert Clients
            for c_id, c_info in clients_dict.items():
                existing_client = existing_clients.get(c_id)
                if not existing_client:
                    new_client = Client(
                        client_id=c_info["client_id"],
                        client_name=c_info["client_name"],
                        partner_name=c_info["partner_name"],
                        partner_id=c_info["partner_id"],
                    )
                    db.add(new_client)
                    existing_clients[c_id] = new_client
                    clients_created += 1
                else:
                    existing_client.client_name = c_info["client_name"]
                    existing_client.partner_name = c_info["partner_name"]
                    existing_client.partner_id = c_info["partner_id"]
                    clients_updated += 1

            # Second pass: Upsert Projects
            for row in rows:
                p_id = row.get("project_id", "").strip()
                if not p_id:
                    continue

                res_count_raw = row.get("resource_count", "0").strip()
                try:
                    res_count = int(res_count_raw)
                except ValueError:
                    res_count = 0

                c_id_val = row.get("client_id", "").strip()
                if c_id_val == "N/A" or not c_id_val:
                    c_id_val = None

                existing_proj = existing_projects.get(p_id)
                if not existing_proj:
                    new_proj = Project(
                        project_id=p_id,
                        project_name=row.get("project_name", "").strip(),
                        status=row.get("status", "Not Started").strip(),
                        sub_status=row.get("sub_status", "").strip(),
                        type=row.get("type", "").strip(),
                        start_date=row.get("start_date", "").strip(),
                        end_date=row.get("end_date", "").strip(),
                        effective_start=row.get("effective_start", "").strip(),
                        effective_end=row.get("effective_end", "").strip(),
                        resource_count=res_count,
                        resource_names=row.get("resource_names", "").strip(),
                        client_name=row.get("client_name", "").strip(),
                        partner_name=row.get("partner_name", "").strip(),
                        billable=row.get("billable", "").strip(),
                        client_id=c_id_val,
                        partner_id=row.get("partner_id", "").strip(),
                        uuid=row.get("uuid", "").strip(),
                        department_id=row.get("department_id", "").strip(),
                        department_name=row.get("department_name", "").strip(),
                        skills=row.get("skills", "").strip(),
                        project_manager_employee_id=row.get("project_manager_employee_id", "").strip(),
                        project_manager_name=row.get("project_manager_name", "").strip(),
                    )
                    db.add(new_proj)
                    existing_projects[p_id] = new_proj
                    projects_created += 1
                else:
                    existing_proj.project_name = row.get("project_name", "").strip()
                    existing_proj.status = row.get("status", "Not Started").strip()
                    existing_proj.sub_status = row.get("sub_status", "").strip()
                    existing_proj.type = row.get("type", "").strip()
                    existing_proj.start_date = row.get("start_date", "").strip()
                    existing_proj.end_date = row.get("end_date", "").strip()
                    existing_proj.resource_count = res_count
                    existing_proj.resource_names = row.get("resource_names", "").strip()
                    existing_proj.client_name = row.get("client_name", "").strip()
                    existing_proj.partner_name = row.get("partner_name", "").strip()
                    existing_proj.billable = row.get("billable", "").strip()
                    existing_proj.client_id = c_id_val
                    existing_proj.department_name = row.get("department_name", "").strip()
                    existing_proj.project_manager_name = row.get("project_manager_name", "").strip()
                    projects_updated += 1

            db.commit()

        print(f"[SUCCESS] Database seeded successfully:")
        print(f"  - Users added: {users_created}")
        print(f"  - Clients: {clients_created} created, {clients_updated} updated")
        print(f"  - Projects: {projects_created} created, {projects_updated} updated")

        return {
            "users_created": users_created,
            "clients_created": clients_created,
            "clients_updated": clients_updated,
            "projects_created": projects_created,
            "projects_updated": projects_updated,
            "csv_found": True
        }

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seeding error: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
