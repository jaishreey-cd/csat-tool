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

engine = create_engine(
    db_url,
    connect_args=connect_args,
    **engine_kwargs
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
