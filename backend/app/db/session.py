from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

db_url = settings.DATABASE_URL

# Normalize postgresql:// to postgresql+psycopg:// if psycopg v3 is preferred, or psycopg2
# If starting with postgresql:// without driver specification, psycopg or psycopg2 will be selected
connect_args = {}
engine_kwargs = {"pool_pre_ping": True}

if db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False
else:
    if "neon.tech" in db_url or "pooler" in db_url:
        engine_kwargs.update({
            "pool_size": 10,
            "max_overflow": 5,
            "pool_recycle": 300,
            "pool_timeout": 30,
        })

try:
    engine = create_engine(
        db_url,
        connect_args=connect_args,
        **engine_kwargs
    )
except (ImportError, Exception) as e:
    print(f"[WARN] Could not load database driver for {db_url.split('@')[-1] if '@' in db_url else db_url}: {e}")
    print("[INFO] Falling back to SQLite: sqlite:///./csat_pmo.db")
    engine = create_engine(
        "sqlite:///./csat_pmo.db",
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
