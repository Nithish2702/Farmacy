from pydantic import BaseModel
from typing import Optional

# MSG91 Access Token Verification Schema
class MSG91AccessTokenRequest(BaseModel):
    access_token: str

class MSG91AccessTokenResponse(BaseModel):
    success: bool
    message: str
    phone_number: Optional[str] = None
    user_exists: Optional[bool] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None

# User Creation Schema (for new users after MSG91 verification)
class CreateUserRequest(BaseModel):
    phone_number: str
    username: str
    full_name: Optional[str] = None
    farm_type: Optional[str] = "general"

