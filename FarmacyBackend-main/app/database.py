from sqlalchemy import create_engine, NullPool
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import urllib.parse
from app.core.config import settings
from app.core.logger import logger
from contextlib import contextmanager

engine = None
SessionLocal = None
Base = declarative_base()

def init_db():
    global engine, SessionLocal
    try:
        password = urllib.parse.quote_plus(settings.SUPABASE_PASSWORD)
        url = f"postgresql://postgres.nacafqowabfdrldyvjic:{password}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
        if engine is None or SessionLocal is None:
            engine = create_engine(
                url,
                pool_pre_ping=True,
                poolclass=NullPool,
                pool_recycle=1800,
            )
            logger.info(f"Connecting to database: {url}")
            with engine.connect() as connection:
                logger.info("Database connection successful")
            SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    except Exception as e:
        logger.error(f"Database connection error: {str(e)}")
        raise

def get_db():
    if SessionLocal is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@contextmanager
def get_db_session():
    """Context manager for database sessions that can be used in non-async contexts."""
    if SessionLocal is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def safe_session() -> Session:
    """
    Safely get a SessionLocal instance.
    Reinitializes the DB connection if SessionLocal is None (e.g., in background tasks).
    """
    from app.database import init_db  # Avoid circular import
    global SessionLocal
    if SessionLocal is None:
        logger.warning("SessionLocal was None, reinitializing DB...")
        init_db()
    if SessionLocal is None:
        raise RuntimeError("Failed to initialize SessionLocal.")
    return SessionLocal()
