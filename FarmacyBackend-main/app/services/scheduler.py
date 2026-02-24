import asyncio
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db_session
from app.services.notification import NotificationService
from app.models.notification import NotificationType, NotificationPriority
from app.core.logger import logger
from firebase_admin._messaging_utils import UnregisteredError

# Define Indian timezone offset
INDIAN_TIMEZONE = timezone(timedelta(hours=5, minutes=30))

class NotificationScheduler:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(NotificationScheduler, cls).__new__(cls)
            cls._instance.scheduler = AsyncIOScheduler(timezone=INDIAN_TIMEZONE)
            cls._instance.test_users = set()  # Track users in test mode
        return cls._instance

    async def start(self):
        """Start the scheduler with all jobs."""
        if self.scheduler.running:
            return
            
        # Setup all scheduled jobs
        await self._setup_jobs()
        
        # Start the scheduler
        self.scheduler.start()
        logger.info("Notification scheduler started")

    async def stop(self):
        """Stop the scheduler."""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("Notification scheduler stopped")

    async def _setup_jobs(self):
        """Setup all scheduled notification jobs."""
        
        # Process scheduled notifications every minute
        self.scheduler.add_job(
            self._process_scheduled_notifications,
            IntervalTrigger(minutes=1),
            id='process_scheduled',
            replace_existing=True
        )
        
        # Daily crop updates at 8:00 AM IST
        self.scheduler.add_job(
            self._send_daily_crop_updates,
            CronTrigger(hour=22, minute=8, timezone=INDIAN_TIMEZONE),
            id='daily_crop_updates',
            replace_existing=True
        )
        
        # # System health check every 6 hours
        # self.scheduler.add_job(
        #     self._send_system_alerts,
        #     IntervalTrigger(hours=6),
        #     id='system_alerts',
        #     replace_existing=True
        # )

    async def _process_scheduled_notifications(self):
        """Process all scheduled notifications that are due."""
        try:
            with get_db_session() as db:
                NotificationService.send_scheduled_notifications_sync(db)
        except Exception as e:
            logger.error(f"Error in scheduled notifications job: {str(e)}")

    async def _send_daily_crop_updates(self):
        """Send daily crop update notifications."""
        try:
            with get_db_session() as db:
                NotificationService.send_daily_crop_updates_sync(db)
        except Exception as e:
            logger.error(f"Error in daily crop updates job: {str(e)}")

    async def _send_system_alerts(self):
        """Send system alert notifications if needed."""
        try:
            with get_db_session() as db:
                # Example: Send system maintenance alerts
                NotificationService.send_topic_notification_sync(
                    db=db,
                    topic_name="system_alerts",
                    type=NotificationType.SYSTEM_ALERT,
                    title="System Status",
                    message="System is running normally",
                    priority=NotificationPriority.LOW
                )
        except Exception as e:
            logger.error(f"Error in system alerts job: {str(e)}")

    async def schedule_notification(
        self,
        user_id: int,
        type: NotificationType,
        title: str,
        message: str,
        scheduled_for: datetime,
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        data: dict = None
    ):
        """Schedule a one-time notification for a specific time."""
        try:
            with get_db_session() as db:
                NotificationService.create_and_send_notification_sync(
                    db=db,
                    user_id=user_id,
                    type=type,
                    title=title,
                    message=message,
                    priority=priority,
                    data=data,
                    scheduled_for=scheduled_for
                )
            logger.info(f"Scheduled notification for user {user_id} at {scheduled_for}")
        except Exception as e:
            logger.error(f"Error scheduling notification: {str(e)}")

    def start_test_notifications(self, user_id: int, interval_seconds: int = 30):
        """Start sending test notifications to a user."""
        if user_id in self.test_users:
            return  # Already running
            
        self.test_users.add(user_id)
        
        # Schedule recurring test notifications
        job_id = f'test_notifications_{user_id}'
        self.scheduler.add_job(
            self._send_test_notification,
            IntervalTrigger(seconds=interval_seconds),
            args=[user_id],
            id=job_id,
            replace_existing=True
        )
        
        logger.info(f"Started test notifications for user {user_id} every {interval_seconds} seconds")

    def stop_test_notifications(self, user_id: int):
        """Stop sending test notifications to a user."""
        if user_id not in self.test_users:
            return
            
        self.test_users.discard(user_id)
        
        # Remove the job
        job_id = f'test_notifications_{user_id}'
        try:
            self.scheduler.remove_job(job_id)
            logger.info(f"Stopped test notifications for user {user_id}")
        except Exception as e:
            logger.error(f"Error stopping test notifications for user {user_id}: {str(e)}")

    async def _send_test_notification(self, user_id: int):
        """Send a test notification to a user."""
        if user_id not in self.test_users:
            # User stopped test mode, remove job
            self.stop_test_notifications(user_id)
            return
            
        try:
            with get_db_session() as db:
                current_time = datetime.now(INDIAN_TIMEZONE)
                NotificationService.create_and_send_notification_sync(
                    db=db,
                    user_id=user_id,
                    type=NotificationType.SYSTEM_ALERT,
                    title="Test Notification",
                    message=f"Test notification sent at {current_time.strftime('%H:%M:%S')} IST",
                    priority=NotificationPriority.MEDIUM,
                    data={
                        "test": True,
                        "timestamp": current_time.isoformat()
                    }
                )
        except Exception as e:
            logger.error(f"Error sending test notification to user {user_id}: {str(e)}")

    async def _send_test_updates(self, user_id: int):
        """Send test updates simulating daily and weather updates."""
        if user_id not in self.test_users:
            return
            
        try:
            with get_db_session() as db:
                current_time = datetime.now(INDIAN_TIMEZONE)
                
                # Simulate daily crop update
                NotificationService.create_and_send_notification_sync(
                    db=db,
                    user_id=user_id,
                    type=NotificationType.DAILY_UPDATE,
                    title="Test Daily Update",
                    message=f"Test daily update for your crops at {current_time.strftime('%H:%M:%S')} IST",
                    priority=NotificationPriority.MEDIUM,
                    data={
                        "test": True,
                        "type": "daily_update",
                        "timestamp": current_time.isoformat(),
                        "crop_id": 1,
                        "week_number": 2,
                        "crop_name": "Test Crop"
                    }
                )
                
                # Simulate weather update
                weather_conditions = ["Sunny", "Rainy", "Cloudy", "Windy"]
                current_weather = weather_conditions[current_time.second % len(weather_conditions)]
                
                NotificationService.create_and_send_notification_sync(
                    db=db,
                    user_id=user_id,
                    type=NotificationType.WEATHER_ALERT,
                    title="Test Weather Update",
                    message=f"Test weather update: {current_weather} conditions at {current_time.strftime('%H:%M:%S')} IST",
                    priority=NotificationPriority.HIGH,
                    data={
                        "test": True,
                        "type": "weather_update",
                        "timestamp": current_time.isoformat(),
                        "weather": current_weather,
                        "temperature": 25 + (current_time.second % 10),
                        "humidity": 60 + (current_time.second % 20)
                    }
                )
                
                logger.info(f"Sent test updates to user {user_id}")
                
        except Exception as e:
            logger.error(f"Error sending test updates to user {user_id}: {str(e)}")

    def start_test_updates(self, user_id: int, interval_seconds: int = 30):
        """Start sending test updates to a user."""
        if user_id in self.test_users:
            return  # Already running
            
        self.test_users.add(user_id)
        
        # Schedule recurring test updates
        job_id = f'test_updates_{user_id}'
        self.scheduler.add_job(
            self._send_test_updates,
            IntervalTrigger(seconds=interval_seconds),
            args=[user_id],
            id=job_id,
            replace_existing=True
        )
        
        logger.info(f"Started test updates for user {user_id} every {interval_seconds} seconds")

    def stop_test_updates(self, user_id: int):
        """Stop sending test updates to a user."""
        if user_id not in self.test_users:
            return
            
        self.test_users.discard(user_id)
        
        # Remove the job
        job_id = f'test_updates_{user_id}'
        try:
            self.scheduler.remove_job(job_id)
            logger.info(f"Stopped test updates for user {user_id}")
        except Exception as e:
            logger.error(f"Error stopping test updates for user {user_id}: {str(e)}")

    def get_scheduled_jobs(self):
        """Get information about all scheduled jobs."""
        jobs = []
        for job in self.scheduler.get_jobs():
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger)
            })
        return jobs


# Create global scheduler instance
notification_scheduler = NotificationScheduler()