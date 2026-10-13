from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.config import settings
from app.database import engine, Base
from app.routers import auth, data, sso
from app.seed_data import seed_database

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist and seed initial data from CSV if needed
    print("[INFO] Starting PMO CSAT Survey System Backend...")
    try:
        Base.metadata.create_all(bind=engine)
        seed_database()
        print("[INFO] Startup database initialization & seeding complete.")
    except Exception as e:
        print(f"[ERROR] Failed during startup seeding: {e}")
    yield
    print("[INFO] Shutting down PMO CSAT System Backend...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "Backend API for CSAT Survey System — "
        "Login, Authentication (JWT + Microsoft SSO), Role-Based Access & Utiliza Data Store"
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Allow React dev server (5173) and any production origin
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    settings.FRONTEND_URL,
    "*",  # Remove '*' in production and list explicit origins instead
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(sso.router,  prefix=settings.API_V1_STR)
app.include_router(data.router, prefix=settings.API_V1_STR)

@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "system": "PMO CSAT Survey System",
        "version": "1.0.0",
        "database": settings.DATABASE_URL.split("://")[0],  # e.g. "postgresql"
        "sso_configured": bool(settings.AAD_CLIENT_ID and settings.AAD_CLIENT_ID != "your-azure-ad-client-id-here"),
    }
