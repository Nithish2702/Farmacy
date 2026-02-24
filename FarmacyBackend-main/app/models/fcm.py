from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

# Association table for user-topic subscriptions
user_topic_subscriptions = Table(
    'user_topic_subscriptions',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete="CASCADE")),
    Column('topic_id', Integer, ForeignKey('notification_topics.id', ondelete="CASCADE"))
)

class FCMToken(Base):
    __tablename__ = "fcm_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(String(255), nullable=False, index=True)
    device_type = Column(String(20))  # android, ios, web
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    last_used_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))

    # Remove unique constraints to allow multiple tokens per user and token reuse
    # The application logic will handle duplicate prevention

    user = relationship("User", back_populates="fcm_tokens")

class NotificationTopic(Base):
    __tablename__ = "notification_topics"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    name = Column(String(50), nullable=False, unique=True)
    description = Column(String(200))
    type = Column(String(50))  # weather, market, disease, news, etc.
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))

    # Relationship with users through the association table
    subscribers = relationship("User", secondary=user_topic_subscriptions, back_populates="subscribed_topics") 