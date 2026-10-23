import os
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import pytest
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.db.base import Base
from app.api.deps import get_db
from app.main import app
from app.models.user import User
from app.core.security import hash_password, create_access_token

# Use SQLite for isolated, fast, and repeatable unit testing
TEST_DATABASE_URL = "sqlite:///./test_csat.db"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists("./test_csat.db"):
        try:
            os.remove("./test_csat.db")
        except Exception:
            pass

@pytest.fixture
def db():
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    if transaction.is_active:
        transaction.rollback()
    connection.close()

@pytest.fixture
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def test_user(db):
    user = db.query(User).filter(User.email == "testadmin@example.com").first()
    if not user:
        user = User(
            email="testadmin@example.com",
            full_name="Test Administrator",
            hashed_password=hash_password("Password123!"),
            role="Admin",
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

@pytest.fixture
def auth_headers(test_user):
    token = create_access_token(data={"sub": str(test_user.id), "email": test_user.email})
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def test_client_and_project(db):
    from app.models.client import Client
    from app.models.project import Project
    c = Client(client_code="CLI-TEST", name="Test Client", is_active=True)
    db.add(c)
    db.commit()
    db.refresh(c)

    p = Project(project_code="PRJ-TEST", name="Test Project", client_id=c.id, is_active=True)
    db.add(p)
    db.commit()
    db.refresh(p)

    return c, p
