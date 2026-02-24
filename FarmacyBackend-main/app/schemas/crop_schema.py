from pydantic import BaseModel, Field, field_validator
from typing import Dict, List, Optional
from uuid import UUID
from datetime import datetime
import re

class DayData(BaseModel):
    tasks: List[str]
    notes: Optional[List[str]] = None
    

class WeekDataCreate(BaseModel):
    week_number: int = Field(..., ge=1, description="Week number (e.g., 1 for week_1)")
    title: str = Field(..., max_length=200)
    day_range: str = Field(..., max_length=50, description="e.g., 'Days 1–7'")
    days: Dict[str, DayData] = Field(..., description="Dictionary of days, e.g., {'day_1': {...}}")

    @field_validator("day_range")
    def validate_day_range(cls, v):
        if not re.match(r"Days \d+–\d+$", v):
            raise ValueError("day_range must be in format 'Days X–Y'")
        return v

class WeekDataResponse(WeekDataCreate):
    id: UUID
    crop_id: UUID
    language: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CropTranslationCreate(BaseModel):
    language: str = Field(..., max_length=10, description="Language code (e.g., 'en', 'te', 'hi')")
    name: str = Field(..., max_length=100)
    variety: str = Field(..., max_length=100)
    description: Optional[str] = None
    cultivation_overview: Optional[str] = None

    @field_validator("language")
    def validate_language(cls, v):
        if v not in {"en", "te", "hi"}:
            raise ValueError("Language must be 'en', 'te', or 'hi'")
        return v

class CropTranslationResponse(CropTranslationCreate):
    id: UUID
    crop_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CropCreate(BaseModel):
    code: str = Field(..., max_length=50)
    cultivated_in: Optional[str] = Field(None, max_length=100)
    image_paths: Optional[List[str]] = Field(None, description="List of image paths, stored as comma-separated string")
    translations: List[CropTranslationCreate] = Field(..., min_items=1)
    weeks: List[WeekDataCreate] = Field(default_factory=list)

    @field_validator("image_paths")
    def validate_image_paths(cls, v):
        if v:
            for path in v:
                if not path or len(path) > 255:
                    raise ValueError("Each image path must be non-empty and <= 255 characters")
            return v
        return v

class CropResponse(BaseModel):
    id: UUID
    code: str
    cultivated_in: Optional[str]
    image_paths: Optional[str]
    created_at: datetime
    updated_at: datetime
    translations: List[CropTranslationResponse]
    weeks: List[WeekDataResponse]

    class Config:
        from_attributes = True

    @field_validator("image_paths")
    def split_image_paths(cls, v):
        if isinstance(v, list):
            return ",".join(v) if v else None
        return v

class CropUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=50)
    cultivated_in: Optional[str] = Field(None, max_length=100)
    image_paths: Optional[List[str]] = Field(None, description="List of image paths, stored as comma-separated string")

    @field_validator("image_paths")
    def validate_image_paths(cls, v):
        if v:
            for path in v:
                if not path or len(path) > 255:
                    raise ValueError("Each image path must be non-empty and <= 255 characters")
            return v
        return v