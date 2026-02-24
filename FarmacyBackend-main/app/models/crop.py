from sqlalchemy import ARRAY, Column, Integer, String, Text, ForeignKey, DateTime, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class Crop(Base):
    __tablename__ = "crops"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False, index=True)
    image_urls = Column(ARRAY(String))
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))

    translations = relationship("CropTranslation", back_populates="crop", cascade="all, delete-orphan")
    weeks = relationship("Week", back_populates="crop", cascade="all, delete-orphan")
    stages = relationship("CropStage", back_populates="crop", cascade="all, delete-orphan")
    diseases = relationship("CropDisease", back_populates="crop", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Crop(id={self.id}, name='{self.name}', code='{self.code}')>"

class CropTranslation(Base):
    __tablename__ = "crop_translations"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    crop_id = Column(Integer, ForeignKey("crops.id", ondelete="CASCADE"), nullable=False, index=True)
    language = Column(String(10), nullable=False, index=True)
    cultivated_in = Column(String(200))
    name = Column(String(100), nullable=False)
    variety = Column(String(100), nullable=False)
    description = Column(Text)
    cultivation_overview = Column(Text)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))

    crop = relationship("Crop", back_populates="translations")

class Week(Base):
    __tablename__ = "weeks"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)  # Changed
    crop_id = Column(Integer, ForeignKey("crops.id", ondelete="CASCADE"), nullable=False, index=True)
    stage_id = Column(Integer, ForeignKey("crop_stages.id", ondelete="CASCADE"), nullable=True, index=True) # Need to update nullable later
    week_number = Column(Integer, nullable=False, index=True)
    image_urls = Column(ARRAY(String))
    video_urls = Column(ARRAY(String))

    crop = relationship("Crop", back_populates="weeks")
    stage = relationship("CropStage", back_populates="weeks")
    translations = relationship("WeekTranslation", back_populates="week", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("crop_id", "week_number", name="uix_crop_week_number"),)

class WeekTranslation(Base):
    __tablename__ = "week_translations"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)  # Changed
    week_id = Column(Integer, ForeignKey("weeks.id", ondelete="CASCADE"), nullable=False, index=True)
    language = Column(String(10), nullable=False, index=True)  # e.g., "en", "te", "hi"
    title = Column(String(200), nullable=False)
    day_range = Column(String(50))
    days = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    week = relationship("Week", back_populates="translations")

    __table_args__ = (UniqueConstraint("week_id", "language", name="uix_week_language"),)

class CropStage(Base):
    __tablename__ = "crop_stages"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    crop_id = Column(Integer, ForeignKey("crops.id", ondelete="CASCADE"), nullable=False, index=True)
    image_urls = Column(ARRAY(String))
    stage_number = Column(Integer, nullable=False, index=True)

    crop = relationship("Crop", back_populates="stages")
    weeks = relationship("Week", back_populates="stage", cascade="all, delete-orphan")
    translations = relationship("CropStageTranslation", back_populates="stage", cascade="all, delete-orphan")
    diseases = relationship("CropDisease", back_populates="crop_stages")

    __table_args__ = (UniqueConstraint("crop_id", "stage_number", name="uix_crop_stage_number"),)

class CropStageTranslation(Base):
    __tablename__ = "crop_stage_translations"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    stage_id = Column(Integer, ForeignKey("crop_stages.id", ondelete="CASCADE"), nullable=False, index=True)
    language = Column(String(10), nullable=False, index=True)  # e.g., "en", "te", "hi"
    title = Column(String(200), nullable=False)
    description = Column(JSON)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))

    stage = relationship("CropStage", back_populates="translations")

    __table_args__ = (UniqueConstraint("stage_id", "language", name="uix_stage_language"),)