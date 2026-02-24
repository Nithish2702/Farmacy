from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, ForeignKey, Text
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, timezone

from app.database import Base

class UserLoginHistory(Base):
    __tablename__ = "user_login_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    login_time = Column(DateTime, default=datetime.now(timezone.utc), nullable=False)
    logout_time = Column(DateTime, nullable=True)
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    user_agent = Column(Text, nullable=True)  # Browser/Device info
    device_type = Column(String(20), nullable=True)  # mobile, desktop, tablet
    login_status = Column(Boolean, default=True)  # True for successful login, False for failed attempts
    
    user = relationship("User", back_populates="login_history")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    username = Column(String(50), nullable=True)
    email = Column(String(100), unique=True, nullable=True)  # Made nullable for phone-only auth
    phone_number = Column(String(20), unique=True, nullable=True, index=True)
    farm_type = Column(String(20), nullable=True)
    hashed_password = Column(String(100), nullable=True)  # Made nullable for Firebase auth
    full_name = Column(String(100))
    is_active = Column(Boolean, default=True)
    preferred_language = Column(String(10), default="en")
    
    # Firebase authentication fields
    firebase_uid = Column(String(128), unique=True, nullable=True, index=True)
    email_verified = Column(Boolean, default=False)
    phone_verified = Column(Boolean, default=False)
    last_login_at = Column(DateTime, nullable=True)
    refresh_token = Column(String(500), unique=True, nullable=True)
    refresh_token_expires_at = Column(DateTime, nullable=True)
    current_crop_tracking_id = Column(Integer, ForeignKey("user_crop_tracking.id", ondelete="SET NULL"), nullable=True)
    notification_settings = Column(MutableDict.as_mutable(JSON), nullable=False, default=lambda: {
        "email_notifications": True,
        "push_notifications": True,
        "sms_notifications": False,
        "notification_types": {
            "daily_updates": True,
            "disease_alerts": True,
            "weather_alerts": True,
            "market_updates": True,
            "news_alerts": True
        },
        "notification_times": {
            "daily_update_time": "08:00",  # 24-hour format
            "alert_time": "any"  # any, morning, afternoon, evening
        },
        "topics": {
            "weather": True,
            "market": True,
            "disease": True,
            "news": True
        }
    })
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))

    # New relationships
    disease_predictions = relationship("DiseasePredictionHistory", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("UserNotification", back_populates="user", cascade="all, delete-orphan")
    fcm_tokens = relationship("FCMToken", back_populates="user", cascade="all, delete-orphan")
    subscribed_topics = relationship("NotificationTopic", secondary="user_topic_subscriptions", back_populates="subscribers")
    login_history = relationship("UserLoginHistory", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.username}>"