import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "PMO CSAT Survey System"
    API_V1_STR: str = "/api"
    
    # Database URL: Defaults to PostgreSQL (per architecture diagram)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/csat_db")
    
    # JWT Auth Settings
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "super-secret-csat-pmo-jwt-key-2026-secure-random-token")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 hours
    
    # CSV Data File Path
    CSV_FILE_PATH: str = os.getenv("CSV_FILE_PATH", "Projects_Overview_Report.csv")

    # Microsoft Azure AD / Entra ID SSO Settings
    AAD_CLIENT_ID: str = os.getenv("AAD_CLIENT_ID", "")
    AAD_CLIENT_SECRET: str = os.getenv("AAD_CLIENT_SECRET", "")
    AAD_TENANT_ID: str = os.getenv("AAD_TENANT_ID", "")
    AAD_REDIRECT_URI: str = os.getenv("AAD_REDIRECT_URI", "http://localhost:5173/auth/callback")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
