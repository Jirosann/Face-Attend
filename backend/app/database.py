import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Load backend/.env (and cwd .env) before reading configuration.
_env_dir = Path(__file__).resolve().parent.parent
load_dotenv(_env_dir / ".env")
load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/face_attend"
)

# OPTIMIZED: Configure connection pool for better performance
connect_args = {}

# Configure connection pooling
pool_config = {
    "pool_size": 5,              # Maintain 5 idle connections
    "max_overflow": 10,          # Allow 10 extra connections when needed
    "pool_pre_ping": True,       # Verify connection health before use
    "pool_recycle": 3600,        # Recycle connections after 1 hour
}

# For SQLite local dev (if DATABASE_URL contains 'sqlite')
if "sqlite" in DATABASE_URL.lower():
    from sqlalchemy.pool import StaticPool
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
else:
    # PostgreSQL/Supabase: use connection pooling
    engine = create_engine(DATABASE_URL, **pool_config, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()