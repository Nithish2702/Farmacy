from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Boolean, Enum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from app.database import Base

class NotificationType(str, enum.Enum):
    DAILY_UPDATE = "daily_update"
    DISEASE_ALERT = "disease_alert"
    WEATHER_ALERT = "weather_alert"
    MARKET_UPDATE = "market_update"
    NEWS_ALERT = "news_alert"
    SYSTEM_ALERT = "system_alert"

class NotificationPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

class UserNotification(Base):
    __tablename__ = "user_notifications"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(Enum(NotificationType), nullable=False)
    priority = Column(Enum(NotificationPriority), nullable=False, default=NotificationPriority.MEDIUM)
    title = Column(String(200), nullable=False)
    message = Column(String(1000), nullable=False)
    data = Column(JSON)  # Additional data like crop_id, disease_id, etc.
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    scheduled_for = Column(DateTime)  # For scheduled notifications
    sent_at = Column(DateTime)  # When the notification was actually sent

    user = relationship("User", back_populates="notifications")

class NotificationTemplate(Base):
    __tablename__ = "notification_templates"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    type = Column(Enum(NotificationType), nullable=False)
    language = Column(String(10), nullable=False)
    title_template = Column(String(200), nullable=False)
    message_template = Column(String(1000), nullable=False)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))

    __table_args__ = (
        # Ensure unique templates per type and language
        # UniqueConstraint("type", "language", name="uix_notification_template"),
    ) 