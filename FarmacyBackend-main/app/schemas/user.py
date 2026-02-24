from datetime import datetime
from typing import Dict, Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, constr, Field

class UserBase(BaseModel):
    username: str
    email: Optional[EmailStr] = None  # Made optional for phone-only auth
    phone_number: Optional[str] = None
    farm_type: Optional[str] = None


class UserCreate(UserBase):
    email: EmailStr  # Still required for traditional signup
    password: constr(min_length=8)


class FirebaseUserCreate(BaseModel):
    """Schema for creating users via Firebase phone authentication"""
    username: str = Field(..., min_length=3, max_length=50, description="Username (3-50 characters)")
    full_name: str = Field(..., min_length=2, max_length=100, description="Full name")
    farm_type: str = Field("general", description="Type of farming")
    phone_number: Optional[str] = Field(None, description="Phone number (extracted from Firebase token)")


class UserRead(BaseModel):
    id: int
    username: str
    email: Optional[str] = None  # Made optional for phone-only auth
    phone_number: Optional[str] = None
    farm_type: Optional[str] = None
    full_name: Optional[str] = None
    is_active: bool
    preferred_language: str
    firebase_uid: Optional[str] = None
    email_verified: Optional[bool] = False
    phone_verified: Optional[bool] = False
    current_crop_tracking_id: Optional[int] = None
    notification_settings: Dict
    created_at: datetime
    updated_at: datetime
    current_crop_tracking_id: Optional[int] = None

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class FirebasePhoneLogin(BaseModel):
    """Schema for Firebase phone authentication (login/signup)"""
    firebase_id_token: str = Field(..., description="Firebase ID token from phone verification")
    # Optional fields for new user creation
    username: Optional[str] = Field(None, min_length=3, max_length=50, description="Username (required for new users)")
    full_name: Optional[str] = Field(None, min_length=2, max_length=100, description="Full name (required for new users)")
    farm_type: Optional[str] = Field("general", description="Type of farming")


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[constr(min_length=8)] = None
    phone_number: Optional[str] = None
    farm_type: Optional[str] = None
    current_crop_tracking_id: Optional[int] = None


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: Optional[UserRead] = None

class TokenPayload(BaseModel):
    sub: str  # user id
    exp: datetime
    type: str  # "access" or "refresh" 


class AuthResponse(BaseModel):
    """Response model for authentication endpoints"""
    success: bool = True
    message: str
    user: Optional[UserRead] = None
    tokens: Optional[Token] = None


class UserExistsResponse(BaseModel):
    """Response for checking if user exists"""
    exists: bool
    user_id: Optional[int] = None
    username: Optional[str] = None
    phone_verified: Optional[bool] = None
    email_verified: Optional[bool] = None
    message: Optional[str] = None 