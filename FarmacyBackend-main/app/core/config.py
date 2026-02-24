from zoneinfo import ZoneInfo
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
from typing import Optional
import os

BASE_DIR = Path(__file__).resolve().parent.parent.parent
MAIN_DIR = BASE_DIR / "app"

IST_TIME = ZoneInfo("Asia/Kolkata")

class Settings(BaseSettings):
    # Database settings
    DATABASE_URL: str
    ENV: str = "dev"

    # SMTP settings for email notifications
    SMTP_HOST: str
    SMTP_PORT: int
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: str
    SMTP_TLS: bool = True

    # SMS service settings
    SMS_API_URL: str
    SMS_API_KEY: str
    
    # MSG91 SMS settings (Primary SMS provider)
    MSG91_API_KEY: Optional[str] = None
    MSG91_SENDER_ID: str = "FARMACY"
    MSG91_TEMPLATE_ID: Optional[str] = None
    MSG91_AUTH_KEY: Optional[str] = None
    
    # Twilio SMS settings (Fallback SMS provider)
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None

    # Firebase and google cloud settings
    FIREBASE_CREDENTIALS_PATH: str
    GOOGLE_CLOUD_SERVICE_ACC_CREDENTIALS_PATH: str

    # Supabase settings for image storage
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_BUCKET: str = "farmacy"
    SUPABASE_EMAIL: str
    SUPABASE_PASSWORD: str

    # Weather API settings
    WEATHER_API_KEY: str
    WEATHER_API_URL: str
    OPENWEATHER_API_KEY: str

    # Market data API settings
    MARKET_API_KEY: str
    MARKET_API_URL: str

    # News API settings
    NEWS_API_KEY: str
    NEWS_API_URL: str

    # Authentication and caching settings
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 240
    GROQ_API_KEY: str
    REDIS_HOST: str
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str
    PORT: int = 5000
    GOOGLE_CLOUD_API: str
    GEMINI_API_KEY: str
    GEMINI_MODEL: str

    OTP_EXPIRY_MINUTES: int = 5
    MAX_OTP_PER_DAY: int = 5
    
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra='allow'
    )

settings = Settings()
