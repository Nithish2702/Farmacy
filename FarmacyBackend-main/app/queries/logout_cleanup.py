from app.models.user import UserLoginHistory
from app.database import SessionLocal, init_db, safe_session
from sqlalchemy.orm import Session
from app.services.fcm import FCMService
from app.core.logger import logger
from datetime import datetime, timezone

def run_logout_cleanup(user_id: str):
    db: Session = safe_session()
    try:
        # Unregister FCM tokens
        try:
            FCMService.unregister_all_user_tokens(db, user_id)
            logger.info(f"FCM tokens unregistered for user {user_id}")
        except Exception as e:
            logger.warning(f"FCM unregistration failed for user {user_id}: {e}")

        # Update login history logout_time
        last_login = db.query(UserLoginHistory).filter(
            UserLoginHistory.user_id == user_id,
            UserLoginHistory.logout_time.is_(None),
            UserLoginHistory.login_status == True
        ).order_by(UserLoginHistory.login_time.desc()).first()

        if last_login:
            last_login.logout_time = datetime.now(timezone.utc)
            db.commit()
            logger.info(f"Logout time updated for user {user_id}")
    except Exception as e:
        logger.error(f"Background logout cleanup failed for user {user_id}: {e}")
        db.rollback()
    finally:
        db.close()