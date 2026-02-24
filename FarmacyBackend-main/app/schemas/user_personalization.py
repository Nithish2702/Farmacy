from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import date, datetime

class DiseaseInfo(BaseModel):
    name: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    symptoms: List[str] = Field(default_factory=list)
    causes: List[str] = Field(default_factory=list)
    treatment: List[str] = Field(default_factory=list)
    fertilizer_recommendations: List[str] = Field(default_factory=list)
    prevention_tips: List[str] = Field(default_factory=list)

class DiseasePredictionResponse(BaseModel):
    prediction_id: str
    crop_name: Optional[str] = None
    query: Optional[str] = None
    status: str  # HEALTHY, DISEASED, UNKNOWN
    primary_disease: Optional[DiseaseInfo] = None  # Main disease with highest confidence
    other_possible_diseases: List[DiseaseInfo] = Field(default_factory=list)  # Other potential diseases
    overall_confidence_score: float
    general_recommendations: List[str] = Field(default_factory=list)
    analysis: str

    model_config = {
        "from_attributes": True
    }

class DiseasePredictionHistoryResponse(BaseModel):
    id: int
    prediction_id: str
    crop_name: Optional[str]
    query: Optional[str]
    image_url: Optional[str]
    prediction_result: Dict[str, Any]
    created_at: datetime

    model_config = {
        "from_attributes": True
    }

class NotificationPreferences(BaseModel):
    daily_updates: bool = True
    disease_alerts: bool = True
    weather_alerts: bool = True

    model_config = {
        "from_attributes": True
    }

class UserCropTrackingCreate(BaseModel):
    crop_id: int
    start_date: date
    notification_preferences: Optional[NotificationPreferences] = None

    model_config = {
        "from_attributes": True
    }

class UserCropTrackingResponse(BaseModel):
    id: int
    crop_id: int 
    start_date: date
    current_week: int
    last_notification_date: Optional[date]
    notification_preferences: NotificationPreferences
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }

class DayData(BaseModel):
    tasks: List[Optional[str]] = []
    notes: List[Optional[str]] = []
    recommendations: List[Optional[str]] = []

class DailyCropUpdate(BaseModel):
    tracking_id: int
    lang: str = Field(default="en", description="Language code (e.g., 'en', 'hi', 'te')")
    week_number: int
    days: Dict[str, DayData]  # Map of day_number to day data
    title: str
    alerts: Optional[List[str]] = Field(default_factory=list)
    weather_info: Dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "from_attributes": True
    }

class HourlyForecast(BaseModel):
    time: str
    temperature: float
    humidity: int
    wind_speed: float
    description: str
    feels_like: float
    pressure: int  # Added pressure field
    icon_url: str  # Added icon_url field

    model_config = {
        "from_attributes": True
    }

class DailyForecast(BaseModel):
    date: str
    temperature: Dict[str, Optional[float]]
    humidity: float
    wind_speed: float
    description: str
    hourly_forecast: List[HourlyForecast]
    forecast_interval: str
    pressure: float  # Added pressure field
    icon_url: Optional[str] = None  # Added icon_url field for daily summary

    model_config = {
        "from_attributes": True
    }

class LocationDetails(BaseModel):
    name: str
    country: str
    state: Optional[str] = None
    lat: float
    lon: float

class WeatherForecast(BaseModel):
    coordinates: Dict[str, float]
    location: LocationDetails  # Restored location field
    forecast_interval_hours: int
    forecast: List[DailyForecast]

    model_config = {
        "from_attributes": True
    }
