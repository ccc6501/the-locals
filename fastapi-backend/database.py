"""
Database configuration and session management
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

# Database URL from environment variable
# Use /app/data for persistent storage in Docker
db_path = os.getenv("DATABASE_URL", "sqlite:////app/data/admin_panel.db")
# Create data directory if it doesn't exist
os.makedirs("/app/data", exist_ok=True) if db_path.startswith("sqlite:////app/data") else None
DATABASE_URL = db_path

# Create engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db():
    """
    Dependency for getting database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
