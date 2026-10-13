from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

# Handle connection args per DB type:
# - SQLite: needs check_same_thread=False
# - Neon/PostgreSQL: needs pool_pre_ping=True (handles idle connection drops)
connect_args = {}
engine_kwargs = {"pool_pre_ping": True}

if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
elif "neon.tech" in settings.DATABASE_URL or "sslmode=require" in settings.DATABASE_URL:
    # Neon requires SSL; psycopg2 reads sslmode from the URL automatically
    # Add connection pool settings suitable for serverless
    engine_kwargs.update({
        "pool_size": 5,
        "max_overflow": 2,
        "pool_recycle": 300,
        "pool_timeout": 30,
    })

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    **engine_kwargs,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
