from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from app.queries.fcm_register_background_task import register_and_notify_in_background, unregister_all_tokens_in_background, unregister_token_in_background
from app.core.config import IST_TIME
from app.database import get_db
from app.services.notification import NotificationService
from app.services.fcm import FCMService
from app.services.scheduler import notification_scheduler
from app.models.user import User
from app.models.fcm import NotificationTopic
from app.models.notification import NotificationType, NotificationPriority, UserNotification
from app.schemas.notification import (
    NotificationCreate,
    NotificationResponse,
    SubscribeTopicInput,
    TopicBroadCastMessage,
    TopicCreate,
    TopicResponse,
    NotificationSettingsUpdate
)
from app.dependencies.auth import get_current_user
from app.core.logger import logger

router = APIRouter(prefix="/notifications", tags=["notifications"])

# === BASIC NOTIFICATION OPERATIONS ===


@router.post("/", response_model=NotificationResponse)
async def create_notification(
    notification: NotificationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Create and send a notification."""
    try:
        db_notification = await NotificationService.create_and_send_notification(
            db=db,
            user_id=current_user.id,
            type=notification.type,
            title=notification.title,
            message=notification.message,
            priority=notification.priority,
            data=notification.data,
            scheduled_for=notification.scheduled_at.astimezone(
                IST_TIME) if notification.scheduled_at else None,
        )
        return db_notification
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    type: Optional[NotificationType] = None,
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get notifications for the current user."""
    notifications = await NotificationService.get_user_notifications(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        type=type,
        unread_only=unread_only
    )
    return notifications


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Mark a notification as read."""
    success = await NotificationService.mark_notification_as_read(
        db=db,
        notification_id=notification_id,
        user_id=current_user.id
    )
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}

@router.patch("/read-all")
async def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Mark all notifications as read for the current user."""
    count = await NotificationService.mark_all_notifications_as_read(
        db=db,
        user_id=current_user.id
    )
    return {"message": f"Marked {count} notifications as read"}

# === TEST NOTIFICATIONS ===


@router.post("/test/send")
async def send_test_notification(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
): 
    """Send an immediate test notification."""
    try:
        await NotificationService.create_and_send_notification(
            db=db,
            user_id=current_user.id,
            type=NotificationType.SYSTEM_ALERT,
            priority=NotificationPriority.MEDIUM,
            title="Test Notification",
            message=f"Test notification sent at {datetime.now(IST_TIME).strftime('%H:%M:%S')}",
            data={"test": True},
        )
        return {"message": "Test notification sent successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/test/schedule")
async def schedule_test_notification(
    minutes: int = Query(
        1, ge=1, le=60, description="Minutes from now to schedule"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Schedule a test notification for the future."""
    try:
        scheduled_time = datetime.now(IST_TIME) + timedelta(minutes=minutes)
        await NotificationService.create_and_send_notification(
            db=db,
            user_id=current_user.id,
            type=NotificationType.SYSTEM_ALERT,
            title="Scheduled Test",
            message=f"This notification was scheduled for {scheduled_time.strftime('%H:%M:%S')}",
            priority=NotificationPriority.MEDIUM,
            data={"test": True, "scheduled": True},
            scheduled_for=scheduled_time
        )
        return {"message": f"Test notification scheduled for {scheduled_time.strftime('%H:%M:%S')}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test/updates/start")
async def start_test_updates(
    interval_seconds: int = Query(
        30, ge=10, le=300, description="Interval in seconds"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Start sending test updates (daily and weather) periodically.

    Args:
        interval_seconds: Time between updates (10-300 seconds)
    """
    try:
        # Verify user has an FCM token
        fcm_token = await FCMService.get_user_token(db, current_user.id)
        if not fcm_token:
            raise HTTPException(
                status_code=400,
                detail="No FCM token found. Please register a device first."
            )

        # Start test updates
        notification_scheduler.start_test_updates(
            current_user.id, interval_seconds)
        logger.info(
            f"Started test updates for user {current_user.id} every {interval_seconds} seconds")

        return {
            "message": f"Started test updates every {interval_seconds} seconds",
            "interval": interval_seconds,
            "user_id": current_user.id,
            "updates": ["daily_crop", "weather"]
        }
    except Exception as e:
        logger.error(f"Error starting test updates: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test/updates/stop")
async def stop_test_updates(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Stop sending test updates."""
    try:
        notification_scheduler.stop_test_updates(current_user.id)
        logger.info(f"Stopped test updates for user {current_user.id}")

        return {
            "message": "Stopped test updates",
            "user_id": current_user.id
        }
    except Exception as e:
        logger.error(f"Error stopping test updates: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/test/active")
async def get_active_test_jobs(
    current_user=Depends(get_current_user)
):
    """Get information about currently running test notification jobs for the user."""
    try:
        is_test_user = current_user.id in notification_scheduler.test_users

        # Get all jobs for this user
        jobs = []
        if is_test_user:
            all_jobs = notification_scheduler.get_scheduled_jobs()
            user_job_ids = [
                f'test_notifications_{current_user.id}',
                f'test_updates_{current_user.id}'
            ]
            jobs = [job for job in all_jobs if job["id"] in user_job_ids]

        return {
            "active": is_test_user,
            "jobs": jobs
        }
    except Exception as e:
        logger.error(f"Error getting active test jobs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# === TOPIC MANAGEMENT ===


@router.post("/topics", response_model=TopicResponse)
async def create_topic(
    topic: TopicCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Create a new notification topic (Admin only)."""
    # if not current_user.is_admin:
    #     raise HTTPException(status_code=403, detail="Only admins can create topics")

    try:
        db_topic = await FCMService.create_topic(
            db=db,
            name=topic.name,
            description=topic.description,
            type=topic.type
        )
        return db_topic
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/topics", response_model=List[TopicResponse])
async def get_topics(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get all available notification topics."""
    topics = db.query(NotificationTopic).all()
    return topics


@router.post("/topics/subscribe")
async def subscribe_to_topic(
    topic: SubscribeTopicInput,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Subscribe to a notification topic."""
    try:
        success = await FCMService.subscribe_to_topic(db, current_user.id, topic.name)
        if not success:
            raise HTTPException(
                status_code=400, detail="Failed to subscribe to topic")
        return {"message": f"Successfully subscribed to {topic.name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/topics/unsubscribe")
async def unsubscribe_from_topic(
    topic: SubscribeTopicInput,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Unsubscribe from a notification topic."""
    try:
        success = await FCMService.unsubscribe_from_topic(db, current_user.id, topic.name)
        if not success:
            raise HTTPException(
                status_code=400, detail="Failed to unsubscribe from topic")
        return {"message": f"Successfully unsubscribed from {topic.name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# === FCM TOKEN MANAGEMENT ===

@router.post("/fcm/register")
async def register_fcm_token(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Register a new FCM token for push notifications."""
    try:
        body = await request.json()
        token = body.get("token")
        device_type = body.get("device_type")

        if not token or not device_type:
            raise HTTPException(
                status_code=400, detail="Token and device_type are required")

        # ⏳ Performing both register & notify in background
        background_tasks.add_task(
            register_and_notify_in_background,
            user_id=current_user.id,
            token=token,
            device_type=device_type
        )

        return {"message": "FCM token registered successfully"}
    except Exception as e:
        logger.error(f"Error registering FCM token: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/fcm/unregister")
async def unregister_fcm_token(
    token: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Unregister an FCM token."""
    try:
        background_tasks.add_task(
            unregister_token_in_background,
            user_id=current_user.id,
            token=token
        )
        return {"message": "FCM token unregistered successfully"}
    except Exception as e:
        logger.error("Error Unregistering: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/fcm/unregister-all")
async def unregister_all_fcm_tokens(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Unregister all FCM tokens for the current user (useful for logout)."""
    try:
        background_tasks.add_task(
            unregister_all_tokens_in_background,
            user_id=current_user.id,
        )
        return {"message": "All FCM tokens unregistered successfully"}
    except Exception as e:
        logger.error("Error unregistering all FCM tokens: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e))

# === USER SETTINGS ===

@router.get("/settings")
async def get_notification_settings(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get user's notification settings."""
    try:
        user = db.query(User).filter(User.id == current_user.id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Return notification settings or default values
        return user.notification_settings
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/settings")
async def update_notification_settings(
    settings: NotificationSettingsUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Update user's notification settings."""
    try:
        user = db.query(User).filter(User.id == current_user.id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Update notification settings
        if not user.notification_settings:
            user.notification_settings = {}

        user.notification_settings.update(
            settings.model_dump(exclude_none=True))
        db.commit()

        return {"message": "Notification settings updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# === ADMIN ENDPOINTS ===

@router.post("/admin/topic-broadcast")
async def send_topic_broadcast(
    broadcast_msg: TopicBroadCastMessage,
    type: NotificationType = NotificationType.SYSTEM_ALERT,
    priority: NotificationPriority = NotificationPriority.MEDIUM,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Send a broadcast notification to a topic (Admin only)."""
    # if not current_user.is_admin:
    #     raise HTTPException(status_code=403, detail="Only admins can send broadcast notifications")

    try:
        success = await NotificationService.send_topic_notification(
            db=db,
            topic_name=broadcast_msg.topic_name,
            type=type,
            title=broadcast_msg.title,
            message=broadcast_msg.message,
            priority=priority,
            data=broadcast_msg.data
        )
        if not success:
            raise HTTPException(
                status_code=500, detail="Failed to send broadcast notification")
        return {"message": f"Broadcast sent to {broadcast_msg.topic_name} topic"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/scheduler/jobs")
async def get_scheduler_jobs(
    current_user=Depends(get_current_user)
):
    """Get information about scheduled jobs (Admin only)."""
    # if not current_user.is_admin:
    #     raise HTTPException(status_code=403, detail="Only admins can view scheduler jobs")

    jobs = notification_scheduler.get_scheduled_jobs()
    return {"jobs": jobs}