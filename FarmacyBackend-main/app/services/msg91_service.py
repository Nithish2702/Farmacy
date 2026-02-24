import requests
import json
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta

from app.core.config import settings
from app.core.logger import logger
from app.core.security import create_access_token, create_refresh_token
from app.models.user import User
from app.schemas.otp import MSG91AccessTokenRequest, MSG91AccessTokenResponse, CreateUserRequest

class MSG91Service:
    """MSG91 OTP Widget service for access token verification"""
    
    def __init__(self):
        self.auth_key = getattr(settings, 'MSG91_AUTH_KEY', None)
        self.verify_url = "https://control.msg91.com/api/v5/widget/verifyAccessToken"
        
        if not self.auth_key:
            logger.warning("MSG91 AUTH_KEY not configured")
    
    def verify_access_token(self, db: Session, request: MSG91AccessTokenRequest) -> MSG91AccessTokenResponse:
        """Verify MSG91 access token and return user status"""
        try:
            if not self.auth_key:
                raise ValueError("MSG91 AUTH_KEY not configured")
            
            # Prepare request to MSG91 API
            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
            
            payload = {
                "authkey": self.auth_key,
                "access-token": request.access_token
            }
            
            logger.info(f"Verifying MSG91 access token: {request.access_token[:10]}...")
            
            # Make request to MSG91 API
            response = requests.post(
                self.verify_url,
                headers=headers,
                json=payload,
                timeout=30
            )
            
            logger.info(f"MSG91 API response status: {response.status_code}")
            
            if response.status_code != 200:
                logger.error(f"MSG91 API error: {response.status_code} - {response.text}")
                raise ValueError("Failed to verify access token with MSG91")
            
            msg91_data = response.json()
            logger.info(f"MSG91 API response: {msg91_data}")
            
            # Check if MSG91 verification was successful
            if msg91_data.get('type') != 'success':
                error_msg = msg91_data.get('message', 'Access token verification failed')
                logger.error(f"MSG91 verification failed: {error_msg}")
                raise ValueError(error_msg)
            
            # Extract phone number from MSG91 response
            # MSG91 returns phone number in the 'message' field when successful
            phone_number = msg91_data.get('message')
            if not phone_number:
                logger.error("Phone number not found in MSG91 response")
                raise ValueError("Phone number not found in verification response")
            
            # Ensure phone number has country code
            if not phone_number.startswith('+'):
                phone_number = f"+{phone_number}"
            
            logger.info(f"Successfully verified phone number: {phone_number}")
            
            # Check if user exists in our database
            user = db.query(User).filter(User.phone_number == phone_number).first()
            
            if user:
                # Existing user - generate tokens
                now = datetime.now(timezone.utc)
                access_token = create_access_token(str(user.id))
                refresh_token = create_refresh_token(str(user.id))
                user.is_active = True
                
                # Update user's refresh token
                user.refresh_token = refresh_token
                user.refresh_token_expires_at = now + timedelta(days=60)
                db.commit()
                
                logger.info(f"Existing user authenticated: {user.id}")
                
                return MSG91AccessTokenResponse(
                    success=True,
                    message="Access token verified successfully",
                    phone_number=phone_number,
                    user_exists=True,
                    access_token=access_token,
                    refresh_token=refresh_token
                )
            else:
                # New user - no tokens yet
                logger.info(f"New user detected: {phone_number}")
                
                return MSG91AccessTokenResponse(
                    success=True,
                    message="Access token verified successfully. Please complete your profile.",
                    phone_number=phone_number,
                    user_exists=False
                )
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error during MSG91 verification: {e}")
            raise ValueError("Network error during verification")
        except ValueError as e:
            # Re-raise ValueError as is
            raise e
        except Exception as e:
            logger.error(f"Unexpected error during MSG91 verification: {e}")
            raise ValueError("Failed to verify access token")
    
    def create_user(self, db: Session, request: CreateUserRequest) -> MSG91AccessTokenResponse:
        """Create a new user after MSG91 verification"""
        try:
            # Check if user already exists
            existing_user = db.query(User).filter(User.phone_number == request.phone_number).first()
            if existing_user:
                raise ValueError("User already exists")
            
            # Create new user
            user = User(
                username=request.username,
                phone_number=request.phone_number,
                farm_type=request.farm_type or "general",
                email=None,  # Will be set later if needed
                hashed_password=None,  # No password for phone auth
                is_active=True,
            )
            
            db.add(user)
            db.commit()
            db.refresh(user)
            
            # Generate tokens
            now = datetime.now(timezone.utc)
            access_token = create_access_token(str(user.id))
            refresh_token = create_refresh_token(str(user.id))
            
            # Update user's refresh token
            user.refresh_token = refresh_token
            user.refresh_token_expires_at = now + timedelta(days=60)
            db.commit()
            
            logger.info(f"New user created successfully: {user.id}")
            
            return MSG91AccessTokenResponse(
                success=True,
                message="User created successfully",
                phone_number=request.phone_number,
                user_exists=True,
                access_token=access_token,
                refresh_token=refresh_token
            )
            
        except ValueError as e:
            # Re-raise ValueError as is
            raise e
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            raise ValueError("Failed to create user")
    
    def get_service_info(self) -> Dict[str, Any]:
        """Get MSG91 service information"""
        return {
            "service_name": "MSG91 OTP Widget",
            "auth_key_configured": bool(self.auth_key),
            "verify_url": self.verify_url
        }