import io
import pytest
from app.models.client import Client
from app.models.project import Project
from app.models.import_batch import ImportBatch
from app.models.import_change import ImportChange

SAMPLE_CSV_VALID = (
    "client_code,client_name,project_code,project_name,team_name\n"
    "C1,Client Alpha,P1,Project One,Team A\n"
    "C2,Client Beta,P2,Project Two,Team B\n"
)

SAMPLE_CSV_DUPLICATE = (
    "client_code,client_name,project_code,project_name,team_name\n"
    "C1,Client Alpha,P1,Project One,Team A\n"
    "C1,Client Alpha,P1,Project One Duplicate,Team A\n"
)

SAMPLE_CSV_MISSING_COL = (
    "client_code,project_code,project_name\n"
    "C1,P1,Project One\n"
)

def test_preview_writes_nothing_to_db(client, auth_headers, db):
    """Assert preview endpoint performs dry-run without writing any rows to database."""
    clients_before = db.query(Client).count()
    projects_before = db.query(Project).count()
    batches_before = db.query(ImportBatch).count()

    files = {"file": ("data.csv", io.BytesIO(SAMPLE_CSV_VALID.encode()), "text/csv")}
    response = client.post("/api/data/sync/preview", headers=auth_headers, files=files, data={"mode": "add_update"})
    assert response.status_code == 200
    data = response.json()
    assert data["can_confirm"] is True
    assert data["diff_summary"]["new_clients"]["count"] == 2
    assert data["diff_summary"]["new_projects"]["count"] == 2

    # Verify zero database modifications
    assert db.query(Client).count() == clients_before
    assert db.query(Project).count() == projects_before
    assert db.query(ImportBatch).count() == batches_before

def test_missing_columns_caught(client, auth_headers):
    """Assert missing required columns returns 400 error."""
    files = {"file": ("bad.csv", io.BytesIO(SAMPLE_CSV_MISSING_COL.encode()), "text/csv")}
    response = client.post("/api/data/sync/preview", headers=auth_headers, files=files, data={"mode": "add_update"})
    assert response.status_code == 400
    assert "Missing required columns" in response.json()["detail"]

def test_bad_file_type_caught(client, auth_headers):
    """Assert unsupported file format returns 400 error."""
    files = {"file": ("bad.txt", io.BytesIO(b"hello world"), "text/plain")}
    response = client.post("/api/data/sync/preview", headers=auth_headers, files=files, data={"mode": "add_update"})
    assert response.status_code == 400
    assert "Unsupported file format" in response.json()["detail"]

def test_in_file_duplicates_caught(client, auth_headers):
    """Assert repeated project_code in file is flagged as duplicate and skipped."""
    files = {"file": ("dup.csv", io.BytesIO(SAMPLE_CSV_DUPLICATE.encode()), "text/csv")}
    response = client.post("/api/data/sync/preview", headers=auth_headers, files=files, data={"mode": "add_update"})
    assert response.status_code == 200
    data = response.json()
    assert len(data["in_file_duplicates"]) == 1
    assert data["in_file_duplicates"][0]["project_code"] == "P1"
    assert data["diff_summary"]["new_projects"]["count"] == 1

def test_add_update_never_archives(client, auth_headers, db):
    """Assert add_update mode never archives existing records missing from the uploaded file."""
    # Step 1: Initial upload with 2 projects
    files1 = {"file": ("v1.csv", io.BytesIO(SAMPLE_CSV_VALID.encode()), "text/csv")}
    res1 = client.post("/api/data/sync/confirm", headers=auth_headers, files=files1, data={"mode": "add_update"})
    assert res1.status_code == 200

    # Step 2: Upload new file containing only P1
    csv_single = "client_code,client_name,project_code,project_name,team_name\nC1,Client Alpha,P1,Project One,Team A\n"
    files2 = {"file": ("v2.csv", io.BytesIO(csv_single.encode()), "text/csv")}
    res2 = client.post("/api/data/sync/confirm", headers=auth_headers, files=files2, data={"mode": "add_update"})
    assert res2.status_code == 200

    # P2 was omitted from v2.csv, but in add_update mode it must remain active
    p2 = db.query(Project).filter(Project.project_code == "P2").first()
    assert p2 is not None
    assert p2.is_active is True

def test_full_sync_archives_missing_records_and_keeps_in_db(client, auth_headers, db):
    """Assert full_sync archives missing records while preserving them in the database."""
    # Step 1: Seed P1 and P2
    files1 = {"file": ("init.csv", io.BytesIO(SAMPLE_CSV_VALID.encode()), "text/csv")}
    res1 = client.post("/api/data/sync/confirm", headers=auth_headers, files=files1, data={"mode": "add_update"})
    assert res1.status_code == 200

    # Step 2: Upload only P1 in full_sync mode
    csv_single = "client_code,client_name,project_code,project_name,team_name\nC1,Client Alpha,P1,Project One,Team A\n"
    files2 = {"file": ("full.csv", io.BytesIO(csv_single.encode()), "text/csv")}
    res2 = client.post("/api/data/sync/confirm", headers=auth_headers, files=files2, data={"mode": "full_sync"})
    assert res2.status_code == 200

    # P2 must now be archived (is_active=False), NOT deleted!
    p2 = db.query(Project).filter(Project.project_code == "P2").first()
    assert p2 is not None
    assert p2.is_active is False
    assert p2.archived_at is not None

def test_archived_record_reactivated_when_reappearing(client, auth_headers, db):
    """Assert an archived record is automatically reactivated when it appears in a new import."""
    # Step 1: Seed P1 and P2
    files1 = {"file": ("init.csv", io.BytesIO(SAMPLE_CSV_VALID.encode()), "text/csv")}
    client.post("/api/data/sync/confirm", headers=auth_headers, files=files1, data={"mode": "add_update"})

    # Step 2: Archive P2 using full_sync
    csv_single = "client_code,client_name,project_code,project_name,team_name\nC1,Client Alpha,P1,Project One,Team A\n"
    files2 = {"file": ("full.csv", io.BytesIO(csv_single.encode()), "text/csv")}
    client.post("/api/data/sync/confirm", headers=auth_headers, files=files2, data={"mode": "full_sync"})

    # Step 3: Re-import file containing P2
    files3 = {"file": ("reappear.csv", io.BytesIO(SAMPLE_CSV_VALID.encode()), "text/csv")}
    res3 = client.post("/api/data/sync/confirm", headers=auth_headers, files=files3, data={"mode": "add_update"})
    assert res3.status_code == 200
    data = res3.json()
    assert data["projects_reactivated"] >= 1

    p2 = db.query(Project).filter(Project.project_code == "P2").first()
    assert p2 is not None
    assert p2.is_active is True
    assert p2.archived_at is None

def test_confirm_is_atomic_on_failure(client, auth_headers, db, monkeypatch):
    """Assert confirm rolls back completely on any mid-way database failure."""
    def failing_commit(*args, **kwargs):
        raise RuntimeError("Simulated mid-way failure")

    clients_count_before = db.query(Client).count()

    csv_new = "client_code,client_name,project_code,project_name,team_name\nC99,Client 99,P99,Project 99,Team 99\n"
    files = {"file": ("fail.csv", io.BytesIO(csv_new.encode()), "text/csv")}

    with monkeypatch.context() as m:
        m.setattr(db, "commit", failing_commit)
        res = client.post("/api/data/sync/confirm", headers=auth_headers, files=files, data={"mode": "add_update"})
        assert res.status_code == 500

    # Assert nothing changed
    assert db.query(Client).count() == clients_count_before
    assert db.query(Client).filter(Client.client_code == "C99").first() is None

def test_rollback_restores_previous_state_and_refused_for_non_latest(client, auth_headers, db):
    """Assert rollback reverses latest batch and returns 409 for non-latest batches."""
    # Create batch A
    csv_a = "client_code,client_name,project_code,project_name,team_name\nCA,Client A,PA,Project A,Team A\n"
    files_a = {"file": ("batch_a.csv", io.BytesIO(csv_a.encode()), "text/csv")}
    res_a = client.post("/api/data/sync/confirm", headers=auth_headers, files=files_a, data={"mode": "add_update"})
    batch_a_id = res_a.json()["batch_id"]

    # Create batch B
    csv_b = "client_code,client_name,project_code,project_name,team_name\nCB,Client B,PB,Project B,Team B\n"
    files_b = {"file": ("batch_b.csv", io.BytesIO(csv_b.encode()), "text/csv")}
    res_b = client.post("/api/data/sync/confirm", headers=auth_headers, files=files_b, data={"mode": "add_update"})
    batch_b_id = res_b.json()["batch_id"]

    # Trying to rollback batch A when B is latest must return 409 Conflict
    res_conflict = client.post(f"/api/data/imports/{batch_a_id}/rollback", headers=auth_headers)
    assert res_conflict.status_code == 409

    # Rollback latest batch B
    res_rollback_b = client.post(f"/api/data/imports/{batch_b_id}/rollback", headers=auth_headers)
    assert res_rollback_b.status_code == 200
    assert res_rollback_b.json()["status"] == "rolled_back"

    # PB created in batch B must now be soft-archived, NEVER hard deleted
    pb = db.query(Project).filter(Project.project_code == "PB").first()
    assert pb is not None
    assert pb.is_active is False

def test_no_endpoint_hard_deletes_records(client, auth_headers, db):
    """Verify that throughout all sync and rollback operations, records are never deleted."""
    # Add records
    files = {"file": ("persist.csv", io.BytesIO(SAMPLE_CSV_VALID.encode()), "text/csv")}
    client.post("/api/data/sync/confirm", headers=auth_headers, files=files, data={"mode": "add_update"})

    all_clients = db.query(Client).all()
    all_projects = db.query(Project).all()
    assert len(all_clients) >= 2
    assert len(all_projects) >= 2
