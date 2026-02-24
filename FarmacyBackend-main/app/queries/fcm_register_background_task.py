from app.database import safe_session
from app.services.fcm import FCMService
from app.services.notification import NotificationService
from app.models.notification import NotificationType, NotificationPriority
from datetime import datetime, timezone
from app.core.logger import logger

def register_and_notify_in_background(user_id: int, token: str, device_type: str):
    db = None
    try:
        db = safe_session()

        # Register FCM Token
        FCMService.register_token(db, user_id, token, device_type)

        # Send Test Notification
        # NotificationService.create_and_send_notification_sync(
        #     db=db,
        #     user_id=user_id,
        #     type=NotificationType.SYSTEM_ALERT,
        #     priority=NotificationPriority.MEDIUM,
        #     title="Test Notification",
        #     message=f"Test notification sent at {datetime.now(timezone.utc).strftime('%H:%M:%S')}",
        #     data={"test": True},
        # )
    except Exception as e:
        logger.error(f"Error in background FCM registration: {str(e)}")
    finally:
        if db:
            db.close()

def unregister_token_in_background(user_id: int, token: str):
    db = None
    try:
        db = safe_session()
        FCMService.unregister_token(db, token, user_id)
    except Exception as e:
        logger.error(f"Error in background unregister: {str(e)}")
    finally:
        if db:
            db.close()

def unregister_all_tokens_in_background(user_id: int):
    db = None
    try:
        db = safe_session()
        FCMService.unregister_all_user_tokens(db, user_id)
    except Exception as e:
        logger.error(f"Error in background unregister all: {str(e)}")
    finally:
        if db:
            db.close()