from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(30), nullable=False, default="PMO User")  # "PMO Admin" or "PMO User"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<User {self.username} ({self.role})>"


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(String(50), unique=True, index=True, nullable=False)
    client_name = Column(String(150), index=True, nullable=False)
    partner_name = Column(String(150), nullable=True)
    partner_id = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    projects = relationship("Project", back_populates="client")

    def __repr__(self):
        return f"<Client {self.client_name} ({self.client_id})>"


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(String(50), unique=True, index=True, nullable=False)
    project_name = Column(String(255), nullable=False)
    status = Column(String(50), default="Not Started")
    sub_status = Column(String(50), nullable=True)
    type = Column(String(50), nullable=True)
    start_date = Column(String(30), nullable=True)
    end_date = Column(String(30), nullable=True)
    effective_start = Column(String(30), nullable=True)
    effective_end = Column(String(30), nullable=True)
    resource_count = Column(Integer, default=0)
    resource_names = Column(Text, nullable=True)
    client_name = Column(String(150), nullable=True)
    partner_name = Column(String(150), nullable=True)
    billable = Column(String(30), nullable=True)
    client_id = Column(String(50), ForeignKey("clients.client_id"), nullable=True)
    partner_id = Column(String(50), nullable=True)
    uuid = Column(String(100), nullable=True)
    department_id = Column(String(50), nullable=True)
    department_name = Column(String(100), nullable=True)
    skills = Column(String(255), nullable=True)
    project_manager_employee_id = Column(String(50), nullable=True)
    project_manager_name = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="projects")

    def __repr__(self):
        return f"<Project {self.project_id} - {self.project_name}>"
