from sqlalchemy import Column, Enum, Integer, String, Text, ForeignKey, DateTime, JSON, ARRAY, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class Disease(Base):
    __tablename__ = "diseases"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    image_urls = Column(ARRAY(String))
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))

    crops = relationship("CropDisease", back_populates="disease", cascade="all, delete-orphan")
    translations = relationship("DiseaseTranslation", back_populates="disease", cascade="all, delete-orphan")

class DiseaseTranslation(Base):
    __tablename__ = "disease_translations"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    disease_id = Column(Integer, ForeignKey("diseases.id", ondelete="CASCADE"), nullable=False, index=True)
    language = Column(String(10), nullable=False, index=True)  # e.g., "en", "te", "hi"
    name = Column(String(200), nullable=False)
    type = Column(String(50), nullable=False, index=True)
    description = Column(JSON)
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))

    disease = relationship("Disease", back_populates="translations")

class CropDisease(Base):
    __tablename__ = "crop_diseases"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    crop_code = Column(String(100), ForeignKey("crops.code", ondelete="CASCADE"), nullable=False, index=True)
    disease_id = Column(Integer, ForeignKey("diseases.id", ondelete="CASCADE"), nullable=False, index=True)
    stage_id = Column(Integer, ForeignKey("crop_stages.id", ondelete="SET NULL"), nullable=True, index=True) # Nullable for diseases not tied to a week
    created_at = Column(DateTime, default=datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=datetime.now(timezone.utc), onupdate=datetime.now(timezone.utc))

    crop = relationship("Crop", back_populates="diseases")
    disease = relationship("Disease", back_populates="crops")
    crop_stages = relationship("CropStage", back_populates="diseases")

    __table_args__ = (UniqueConstraint("crop_code", "disease_id", "stage_id", name="uix_crop_disease_week"),)