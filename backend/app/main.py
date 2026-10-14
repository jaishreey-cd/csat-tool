from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import auth_router, clients_router, data_sync_router

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
    print(f"[INFO] Started {settings.PROJECT_NAME} Backend")
    yield
    # Shutdown
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

@app.get("/api/health", tags=["Health"])
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "system": settings.PROJECT_NAME,
        "version": "1.0.0",
        "database": settings.DATABASE_URL.split("://")[0]
    }
