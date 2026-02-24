from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import Boolean, String, and_, cast

from app.models.notification import UserNotification, NotificationType, NotificationPriority
from app.models.user import User
from app.models.user_personalization import UserCropTracking
from app.models.crop import CropTranslation, Week, WeekTranslation
from app.services.fcm import FCMService
from app.core.logger import logger
from app.core.config import IST_TIME

class NotificationService:
    @staticmethod
    def get_current_time() -> datetime:
        """Get current time in Indian timezone."""
        return datetime.now(IST_TIME)

    @staticmethod
    async def create_and_send_notification(
        db: Session,
        user_id: int,
        type: NotificationType,
        title: str,
        message: str,
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        data: Optional[Dict[str, Any]] = None,
        scheduled_for: Optional[datetime] = None
    ) -> UserNotification:
        """Create and optionally send a notification immediately."""
        try:
            # Convert scheduled_for to Indian timezone if provided
            if scheduled_for:
                if scheduled_for.tzinfo is None:
                    scheduled_for = scheduled_for.replace(tzinfo=IST_TIME)
                else:
                    scheduled_for = scheduled_for.astimezone(IST_TIME)

            # Create notification record
            notification = UserNotification(
                user_id=user_id,
                type=type,
                title=title,
                message=message,
                priority=priority,
                data=data or {},
                scheduled_for=scheduled_for,
                created_at=NotificationService.get_current_time()
            )
            
            db.add(notification)
            db.commit()
            db.refresh(notification)
            
            logger.info(f"Created notification {notification.id} for user {user_id}")
            
            # Send immediately if not scheduled or scheduled for now/past
            if not scheduled_for or scheduled_for <= NotificationService.get_current_time():
                logger.info("Sending Notification...")
                await NotificationService._send_notification(notification, db)
            
            return notification
            
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating notification: {str(e)}")
            raise

    @staticmethod
    def create_and_send_notification_sync(
        db: Session,
        user_id: int,
        type: NotificationType,
        title: str,
        message: str,
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        data: Optional[Dict[str, Any]] = None,
        scheduled_for: Optional[datetime] = None,
        sound: Optional[str] = None
    ) -> UserNotification:
        try:
            if scheduled_for:
                if scheduled_for.tzinfo is None:
                    scheduled_for = scheduled_for.replace(tzinfo=IST_TIME)
                else:
                    scheduled_for = scheduled_for.astimezone(IST_TIME)

            notification = UserNotification(
                user_id=user_id,
                type=type,
                title=title,
                message=message,
                priority=priority,
                data=data or {},
                scheduled_for=scheduled_for,
                created_at=NotificationService.get_current_time()
            )

            db.add(notification)
            db.commit()
            db.refresh(notification)

            logger.info(f"[SYNC] Created notification {notification.id} for user {user_id}")

            if not scheduled_for or scheduled_for <= NotificationService.get_current_time():
                logger.info("[SYNC] Sending Notification...")
                NotificationService._send_notification_sync(notification, db, sound)
            return notification

        except Exception as e:
            db.rollback()
            logger.error(f"[SYNC] Error creating notification: {str(e)}")
            raise

    @staticmethod
    async def _send_notification(notification: UserNotification, db: Session) -> bool:
        """Send a notification via FCM."""
        try:
            # Get user's FCM token
            fcm_token = FCMService.get_user_token(db, notification.user_id)
            
            if not fcm_token:
                logger.warning(f"No FCM token found for user {notification.user_id}")
                return False

            # Send via FCM
            success = await FCMService.send_notification(
                token=fcm_token,
                title=notification.title,
                body=notification.message,
                data={
                    "notification_id": str(notification.id),
                    "type": notification.type.value,
                    "priority": notification.priority.value,
                    **(notification.data or {})
                }
            )

            if success:
                # Mark as sent with Indian timezone
                notification.sent_at = NotificationService.get_current_time()
                db.commit()
                logger.info(f"Successfully sent notification {notification.id}")
                return True
            else:
                logger.error(f"Failed to send notification {notification.id}")
                return False

        except Exception as e:
            logger.error(f"Error sending notification {notification.id}: {str(e)}")
            return False
    @staticmethod
    def _send_notification_sync(notification: UserNotification, db: Session, sound: Optional[str] = None) -> bool:
        try:
            fcm_token = FCMService.get_user_token(db, notification.user_id)
            if not fcm_token:
                logger.warning(f"[SYNC] No FCM token found for user {notification.user_id}")
                return False

            # Extract image_url from data and remove it from data payload
            image_url = None
            data_without_image = {}
            if notification.data:
                for key, value in notification.data.items():
                    if key == 'image_url':
                        image_url = value
                    else:
                        data_without_image[key] = value

            success = FCMService._send_notification_sync(
                user_id=notification.user_id,
                token=fcm_token,
                title=notification.title,
                body=notification.message,
                data={
                    "notification_id": str(notification.id),
                    "type": notification.type.value,
                    "priority": notification.priority.value,
                    **data_without_image
                },
                image=image_url,
                sound=sound
            )

            if success:
                notification.sent_at = NotificationService.get_current_time()
                db.commit()
                logger.info(f"[SYNC] Successfully sent notification {notification.id}")
                return True
            else:
                logger.error(f"[SYNC] Failed to send notification {notification.id}")
                return False

        except Exception as e:
            logger.error(f"[SYNC] Error sending notification {notification.id}: {str(e)}")
            return False

    @staticmethod
    def send_scheduled_notifications_sync(db: Session):
        """Synchronous version of send_scheduled_notifications for background tasks."""
        try:
            current_time = NotificationService.get_current_time()
            
            # Get all pending scheduled notifications
            pending_notifications = db.query(UserNotification).filter(
                and_(
                    UserNotification.scheduled_for <= current_time,
                    UserNotification.sent_at.is_(None)
                )
            ).all()

            sent_count = 0
            for notification in pending_notifications:
                try:
                    success = NotificationService._send_notification_sync(notification, db)
                    if success:
                        sent_count += 1
                except Exception as e:
                    logger.error(f"[SYNC] Error sending scheduled notification {notification.id}: {str(e)}")
            
            logger.info(f"[SYNC] Processed {len(pending_notifications)} scheduled notifications, sent {sent_count}")
            return sent_count
            
        except Exception as e:
            logger.error(f"[SYNC] Error processing scheduled notifications: {str(e)}")
            return 0

    @staticmethod
    async def send_scheduled_notifications(db: Session):
        """Process and send all due scheduled notifications."""
        try:
            current_time = NotificationService.get_current_time()
            
            # Get all pending scheduled notifications
            pending_notifications = db.query(UserNotification).filter(
                and_(
                    UserNotification.scheduled_for <= current_time,
                    UserNotification.sent_at.is_(None)
                )
            ).all()

            sent_count = 0
            for notification in pending_notifications:
                try:
                    success = await NotificationService._send_notification(notification, db)
                    if success:
                        sent_count += 1
                except Exception as e:
                    logger.error(f"Error sending scheduled notification {notification.id}: {str(e)}")
            
            logger.info(f"Processed {len(pending_notifications)} scheduled notifications, sent {sent_count}")
            return sent_count
            
        except Exception as e:
            logger.error(f"Error processing scheduled notifications: {str(e)}")
            return 0

    @staticmethod
    def send_daily_crop_updates_sync(db: Session):
        """Synchronous version of send_daily_crop_updates for background tasks."""
        try:
            # Get users who want daily updates
            users_query = db.query(User).filter(
                cast(User.notification_settings.op('->')('notification_types').op('->>')('daily_updates'), Boolean) == True,
                cast(User.notification_settings.op('->>')('push_notifications'), Boolean) == True
            )
            logger.info(f"[SYNC] Found {users_query.count()} users for daily crop updates")
            if users_query.count() == 0:
                logger.info("[SYNC] No users subscribed for daily crop updates")
                return 0

            sent_count = 0
            for user in users_query.all():
                try:
                    if not user.current_crop_tracking_id:
                        continue
                    # Get user's active crop tracking
                    crop_tracking = db.query(UserCropTracking).filter(
                        UserCropTracking.id == user.current_crop_tracking_id,
                    ).first()

                    if not crop_tracking:
                        continue

                    # Get current week data
                    current_week = db.query(Week).filter(
                        Week.crop_id == crop_tracking.crop_id,
                        Week.week_number == crop_tracking.current_week
                    ).first()

                    if not current_week:
                        continue

                    # Get localized content
                    language = user.preferred_language or 'en'
                    week_translation = db.query(WeekTranslation).filter(
                        WeekTranslation.week_id == current_week.id,
                        WeekTranslation.language == language
                    ).first()

                    crop_translation = db.query(CropTranslation).filter(
                        CropTranslation.crop_id == crop_tracking.crop_id,
                        CropTranslation.language == language
                    ).first()

                    if not week_translation:
                        continue
                    

                    logger.info(f"[SYNC] Sending daily update to user {user.id} for crop {crop_tracking.crop_id}, week {crop_tracking.current_week}")
                    # Create and send notification
                    NotificationService.create_and_send_notification_sync(
                        db=db,
                        user_id=user.id,
                        type=NotificationType.DAILY_UPDATE,
                        title=f"Daily Update - {crop_translation.name} (Week {crop_tracking.current_week})",
                        message=f"{week_translation.title} 👋 Here's your tip Today!!",
                        priority=NotificationPriority.MEDIUM,
                        data={
                            "crop_id": crop_tracking.crop_id,
                            "week_number": crop_tracking.current_week,
                            "crop_name": crop_translation.name,
                            "crop_variety": crop_translation.variety,
                            "image_url": current_week.image_urls[0] if len(current_week.image_urls) > 0 else None,
                            "deeplink": f"/crops?crop_id={crop_tracking.crop_id}&week_number={crop_tracking.current_week}"
                        },
                        sound="sound1"
                    )
                    sent_count += 1

                except Exception as e:
                    logger.error(f"[SYNC] Error sending daily update to user {user.id}: {str(e)}")

            logger.info(f"[SYNC] Sent {sent_count} daily crop update notifications")
            return sent_count

        except Exception as e:
            logger.error(f"[SYNC] Error processing daily crop updates: {str(e)}")
            return 0

    @staticmethod
    async def send_daily_crop_updates(db: Session):
        """Send daily crop update notifications to users."""
        try:
            # Get users who want daily updates
            users_query = db.query(User).filter(
                cast(User.notification_settings.op('->')('notification_types').op('->>')('daily_updates'), Boolean) == True,
                cast(User.notification_settings.op('->>')('push_notifications'), Boolean) == True
            )
            logger.info(f"Found {users_query.count()} users for daily crop updates")
            if users_query.count() == 0:
                logger.info("No users subscribed for daily crop updates")
                return 0

            sent_count = 0
            for user in users_query.all():
                try:
                    if not user.current_crop_tracking_id:
                        continue
                    # Get user's active crop tracking
                    crop_tracking = db.query(UserCropTracking).filter(
                        UserCropTracking.id == user.current_crop_tracking_id,
                    ).first()

                    if not crop_tracking:
                        continue

                    # Get current week data
                    current_week = db.query(Week).filter(
                        Week.crop_id == crop_tracking.crop_id,
                        Week.week_number == crop_tracking.current_week
                    ).first()

                    if not current_week:
                        continue

                    # Get localized content
                    language = user.preferred_language or 'en'
                    week_translation = db.query(WeekTranslation).filter(
                        WeekTranslation.week_id == current_week.id,
                        WeekTranslation.language == language
                    ).first()

                    crop_translation = db.query(CropTranslation).filter(
                        CropTranslation.crop_id == crop_tracking.crop_id,
                        CropTranslation.language == language
                    ).first()

                    if not week_translation:
                        continue
                    

                    logger.info(f"Sending daily update to user {user.id} for crop {crop_tracking.crop_id}, week {crop_tracking.current_week}")
                    # Create and send notification
                    await NotificationService.create_and_send_notification(
                        db=db,
                        user_id=user.id,
                        type=NotificationType.DAILY_UPDATE,
                        title=f"Daily Update - {crop_translation.name} (Week {crop_tracking.current_week})",
                        message=f"{week_translation.title} 👋 Here's your tip Today!!",
                        priority=NotificationPriority.MEDIUM,
                        data={
                            "crop_id": crop_tracking.crop_id,
                            "week_number": crop_tracking.current_week,
                            "crop_name": crop_translation.name,
                            "crop_variety": crop_translation.variety,
                        }
                    )
                    sent_count += 1

                except Exception as e:
                    logger.error(f"Error sending daily update to user {user.id}: {str(e)}")

            logger.info(f"Sent {sent_count} daily crop update notifications")
            return sent_count

        except Exception as e:
            logger.error(f"Error processing daily crop updates: {str(e)}")
            return 0

    @staticmethod
    async def send_topic_notification(
        db: Session,
        topic_name: str,
        type: NotificationType,
        title: str,
        message: str,
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Send notification to all users subscribed to a topic."""
        try:
            success = await FCMService.send_topic_message(
                topic_name=topic_name,
                title=title,
                body=message,
                data={
                    "type": type.value,
                    "priority": priority.value,
                    **(data or {})
                }
            )

            if success:
                logger.info(f"Successfully sent topic notification to {topic_name}")
            else:
                logger.error(f"Failed to send topic notification to {topic_name}")
            
            return success

        except Exception as e:
            logger.error(f"Error sending topic notification to {topic_name}: {str(e)}")
            return False

    @staticmethod
    def send_topic_notification_sync(
        db: Session,
        topic_name: str,
        type: NotificationType,
        title: str,
        message: str,
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Synchronous version of send_topic_notification for background tasks."""
        try:
            success = FCMService.send_topic_message_sync(
                topic_name=topic_name,
                title=title,
                body=message,
                data={
                    "type": type.value,
                    "priority": priority.value,
                    **(data or {})
                }
            )

            if success:
                logger.info(f"[SYNC] Successfully sent topic notification to {topic_name}")
            else:
                logger.error(f"[SYNC] Failed to send topic notification to {topic_name}")
            
            return success

        except Exception as e:
            logger.error(f"[SYNC] Error sending topic notification to {topic_name}: {str(e)}")
            return False

    @staticmethod
    async def get_user_notifications(
        db: Session,
        user_id: int,
        skip: int = 0,
        limit: int = 100,
        type: Optional[NotificationType] = None,
        unread_only: bool = False
    ) -> List[UserNotification]:
        """Get notifications for a user."""
        query = db.query(UserNotification).filter(UserNotification.user_id == user_id)
        
        if type:
            query = query.filter(UserNotification.type == type)
        
        if unread_only:
            query = query.filter(UserNotification.is_read == False)
        
        return query.order_by(UserNotification.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def get_user_notifications_sync(
        db: Session,
        user_id: int,
        skip: int = 0,
        limit: int = 100,
        type: Optional[NotificationType] = None,
        unread_only: bool = False
    ) -> List[UserNotification]:
        """Synchronous version of get_user_notifications for background tasks."""
        query = db.query(UserNotification).filter(UserNotification.user_id == user_id)
        
        if type:
            query = query.filter(UserNotification.type == type)
        
        if unread_only:
            query = query.filter(UserNotification.is_read == False)
        
        return query.order_by(UserNotification.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    async def mark_notification_as_read(db: Session, notification_id: int, user_id: int) -> bool:
        """Mark a notification as read."""
        try:
            notification = db.query(UserNotification).filter(
                UserNotification.id == notification_id,
                UserNotification.user_id == user_id
            ).first()
            
            if not notification:
                return False
            
            notification.is_read = True
            notification.read_at = NotificationService.get_current_time()
            db.commit()
            
            return True
            
        except Exception as e:
            logger.error(f"Error marking notification as read: {str(e)}")
            return False

    @staticmethod
    def mark_notification_as_read_sync(db: Session, notification_id: int, user_id: int) -> bool:
        """Synchronous version of mark_notification_as_read for background tasks."""
        try:
            notification = db.query(UserNotification).filter(
                UserNotification.id == notification_id,
                UserNotification.user_id == user_id
            ).first()
            
            if not notification:
                return False
            
            notification.is_read = True
            notification.read_at = NotificationService.get_current_time()
            db.commit()
            
            return True
            
        except Exception as e:
            logger.error(f"[SYNC] Error marking notification as read: {str(e)}")
            return False

    @staticmethod
    async def mark_all_notifications_as_read(db: Session, user_id: int) -> int:
        """Mark all notifications as read for a user."""
        try:
            updated_count = db.query(UserNotification).filter(
                UserNotification.user_id == user_id,
                UserNotification.is_read == False
            ).update({
                "is_read": True,
                "read_at": NotificationService.get_current_time()
            })
            
            db.commit()
            return updated_count
            
        except Exception as e:
            logger.error(f"Error marking all notifications as read: {str(e)}")
            return 0

    @staticmethod
    def mark_all_notifications_as_read_sync(db: Session, user_id: int) -> int:
        """Synchronous version of mark_all_notifications_as_read for background tasks."""
        try:
            updated_count = db.query(UserNotification).filter(
                UserNotification.user_id == user_id,
                UserNotification.is_read == False
            ).update({
                "is_read": True,
                "read_at": NotificationService.get_current_time()
            })
            
            db.commit()
            return updated_count
            
        except Exception as e:
            logger.error(f"[SYNC] Error marking all notifications as read: {str(e)}")
            return 0