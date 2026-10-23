from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import auth_router, clients_router, data_sync_router, surveys_router, analytics_router, questions_router

import asyncio

async def _periodic_followup_checker():
    """Background task to periodically scan and trigger automated follow-ups every 12 hours."""
    await asyncio.sleep(15)  # initial delay after startup
    while True:
        try:
            from app.db.session import SessionLocal
            from app.services.survey_service import check_and_trigger_automated_followups
            with SessionLocal() as db:
                result = check_and_trigger_automated_followups(db, threshold_days=15)
                if result.get("reminded_count", 0) > 0:
                    print(f"[AUTOMATED FOLLOWUP] Auto-reminded {result['reminded_count']} overdue survey(s)")
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[AUTOMATED FOLLOWUP ERROR] {e}")
        try:
            await asyncio.sleep(12 * 3600)  # repeat every 12 hours
        except asyncio.CancelledError:
            break

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables created with Base.metadata.create_all()
    from app.db.session import engine
    from app.db.base import Base
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    try:
        from scripts.seed import seed
        seed()
    except Exception as e:
        print(f"[WARN] Startup seeding warning: {e}")

    try:
        from app.db.session import SessionLocal
        from app.services.question_service import seed_default_questions_if_empty
        with SessionLocal() as db:
            seed_default_questions_if_empty(db)
    except Exception as e:
        print(f"[WARN] Question template seeding warning: {e}")

    print(f"[INFO] Started {settings.PROJECT_NAME} Backend")

    # Start automated follow-up periodic background task
    followup_task = asyncio.create_task(_periodic_followup_checker())

    yield

    # Shutdown
    followup_task.cancel()
    try:
        await followup_task
    except asyncio.CancelledError:
        pass
    print(f"[INFO] Shutting down {settings.PROJECT_NAME} Backend")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="CSAT Backend API",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS Middleware ────────────────────────────────────────────────────────
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    settings.FRONTEND_URL,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Router Registration (/api prefix) ──────────────────────────────────────
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(clients_router, prefix=settings.API_V1_STR)
app.include_router(data_sync_router, prefix=settings.API_V1_STR)
app.include_router(surveys_router, prefix=settings.API_V1_STR)
app.include_router(analytics_router, prefix=settings.API_V1_STR)
app.include_router(questions_router, prefix=settings.API_V1_STR)

@app.get("/api/health", tags=["Health"])
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "system": settings.PROJECT_NAME,
        "version": "1.0.0",
        "database": settings.DATABASE_URL.split("://")[0]
    }
