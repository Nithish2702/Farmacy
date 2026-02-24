from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Date, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class DiseasePredictionHistory(Base):
    __tablename__ = "disease_prediction_history"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    prediction_id = Column(String(100), unique=True, nullable=False, index=True)
    crop_name = Column(String(100), nullable=True)
    query = Column(String(500), nullable=True)
    image_url = Column(String(500), nullable=True)
    prediction_result = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))

    user = relationship("User", back_populates="disease_predictions")

class UserCropTracking(Base):
    __tablename__ = "user_crop_tracking"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    crop_id = Column(Integer, ForeignKey("crops.id", ondelete="CASCADE"), nullable=False, index=True)
    start_date = Column(Date, nullable=False)
    current_week = Column(Integer, nullable=False, default=1)
    last_notification_date = Column(Date)
    notification_preferences = Column(JSON, nullable=False, default=lambda: {
        "daily_updates": True,
        "disease_alerts": True,
        "weather_alerts": True
    })
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))
    crop = relationship("Crop")

    __table_args__ = (
        # Ensure a user can only track a specific crop once
        # (they can start a new tracking after completing one)
        # This constraint might need to be modified based on your requirements
        # For example, you might want to allow multiple tracking entries for the same crop
        # if they're for different growing seasons
        UniqueConstraint("user_id", "crop_id", name="uix_user_crop"),
    )