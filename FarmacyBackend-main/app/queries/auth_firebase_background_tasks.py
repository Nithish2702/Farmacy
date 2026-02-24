from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal, get_db, init_db, safe_session
from app.models.user import User, UserLoginHistory
from app.core.logger import logger

def save_login_history_in_background(user_id: str, ip: str, ua: str, device_type: str):
    db: Session = safe_session()
    try:
        login_record = UserLoginHistory(
            user_id=user_id,
            ip_address=ip,
            user_agent=ua,
            device_type=device_type,
            login_status=True
        )
        db.add(login_record)
        db.commit()
        logger.info(f"[LOGIN] Login history recorded for user {user_id}")
    except Exception as e:
        db.rollback()
        logger.error(f"[LOGIN] Failed to save login history for {user_id}: {e}")
    finally:
        db.close()