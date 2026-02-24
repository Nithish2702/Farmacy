from typing import Annotated, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone, timedelta
import firebase_admin
from firebase_admin import auth as firebase_auth
from pydantic import BaseModel, Field
import uuid

from app.core.security import (
    create_access_token,
    create_refresh_token,
)
from fastapi import BackgroundTasks
from app.queries.auth_firebase_background_tasks import (
    save_login_history_in_background
)
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User, UserLoginHistory
from app.schemas.user import UserRead, Token
from app.core.logger import logger

router = APIRouter(prefix="/auth", tags=["firebase-auth"])

class FirebasePhoneAuthRequest(BaseModel):
    """Request model for Firebase phone authentication (both signup and login)"""
    firebase_id_token: str = Field(...,
                                   description="Firebase ID token from phone verification")

    # Optional fields for user creation (used only during first-time signup)
    username: Optional[str] = Field(
        None, description="Username (required for new users)")
    full_name: Optional[str] = Field(
        None, description="Full name (required for new users)")
    farm_type: str = Field("general", description="Type of farming")

class FirebaseAuthRequest(BaseModel):
    firebase_id_token: str
    user_data: Optional[dict] = None

class LinkFirebaseRequest(BaseModel):
    firebase_id_token: str

class DeleteUsersRequest(BaseModel):
    """Request model for deleting users by user IDs"""
    user_ids: List[str] = Field(..., description="Array of user IDs to delete")


class DeleteUserResponse(BaseModel):
    """Response model for user deletion results"""
    user_id: str
    deleted_from_firebase: bool
    deleted_from_database: bool
    firebase_uid: Optional[str] = None
    phone_number: Optional[str] = None
    error_message: Optional[str] = None


def verify_firebase_token(id_token: str) -> dict:
    """Verify Firebase ID token and return decoded token."""
    try:
        # Check if Firebase app is initialized
        if not firebase_admin._apps:
            logger.error("Firebase Admin SDK not initialized")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Firebase service not available"
            )

        # Verify the ID token
        decoded_token = firebase_auth.verify_id_token(
            id_token, check_revoked=False)
        logger.info(
            f"Firebase token verified for UID: {decoded_token.get('uid')}")
        return decoded_token

    except firebase_auth.InvalidIdTokenError as ie:
        logger.error(
            f"Firebase token verification failed - Invalid token: {str(ie)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase token"
        )

    except firebase_auth.ExpiredIdTokenError as ee:
        logger.error(
            f"Firebase token verification failed - Expired token: {str(ee)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase token expired"
        )

    except firebase_auth.RevokedIdTokenError as re:
        logger.error(
            f"Firebase token verification failed - Revoked token: {str(re)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase token revoked"
        )

    except firebase_auth.CertificateFetchError as ce:
        logger.error(
            f"Firebase token verification failed - Certificate error: {str(ce)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Firebase service error"
        )

    except Exception as e:
        logger.error(f"Firebase token verification failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase token"
        )


def get_device_type(user_agent: str) -> str:
    """Determine device type from user agent."""
    if not user_agent:
        return "unknown"

    user_agent_lower = user_agent.lower()
    if "mobile" in user_agent_lower or "android" in user_agent_lower:
        return "mobile"
    elif "iphone" in user_agent_lower or "ipad" in user_agent_lower:
        return "ios"
    elif "tablet" in user_agent_lower:
        return "tablet"
    else:
        return "web"


def generate_unique_username(base_name: str, db: Session) -> str:
    """Generate a unique username by appending numbers if needed."""
    original_username = base_name
    counter = 1

    while db.query(User).filter(User.username == base_name).first():
        base_name = f"{original_username}_{counter}"
        counter += 1

    return base_name


@router.post("/firebase-phone-auth", response_model=Token)
async def firebase_phone_auth(
    background_tasks: BackgroundTasks,
    request_data: FirebasePhoneAuthRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Universal Firebase Phone Authentication Endpoint

    This endpoint handles both signup and login for Firebase phone authentication:
    - If user exists with firebase_uid: logs them in
    - If user doesn't exist: creates a new user account

    For new users, username and full_name are required.
    """
    try:
        decoded_token = verify_firebase_token(request_data.firebase_id_token)
        firebase_uid = decoded_token.get('uid')
        phone_number = decoded_token.get('phone_number')

        if not firebase_uid or not phone_number:
            raise HTTPException(
                status_code=400, detail="Invalid Firebase token")

        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()

        ip = request.client.host
        ua = request.headers.get("user-agent")
        device = get_device_type(ua)

        if user:
            user.is_active = True
            user.last_login_at = datetime.now(timezone.utc)
            user.phone_verified = True
            user.phone_number = phone_number
            access_token = create_access_token(str(user.id))
            refresh_token = create_refresh_token(str(user.id))
            user.refresh_token = refresh_token
            user.refresh_token_expires_at = datetime.now(
                timezone.utc) + timedelta(days=60)
            db.commit()

            # ✅ Run background login history save
            background_tasks.add_task(
                save_login_history_in_background,
                user_id=str(user.id),
                ip=ip,
                ua=ua,
                device_type=device
            )

            return Token(
                access_token=access_token,
                refresh_token=refresh_token,
                user=UserRead.model_validate(user)
            )

        # New user flow
        # if not request_data.username or not request_data.full_name:
        #     raise HTTPException(
        #         status_code=400, detail="Username and full_name required")

        # Create user immediately for new users to get proper user ID
        new_user = User(
            username=request_data.username if request_data.username else "Farmer",
            full_name=request_data.full_name if request_data.full_name else "Farmer",
            phone_number=phone_number,
            firebase_uid=firebase_uid,
            farm_type=request_data.farm_type,
            is_active=True,
            preferred_language="en",
            phone_verified=True,
            email_verified=False,
            notification_settings={
                "email_notifications": True,
                "push_notifications": True,
                "sms_notifications": False,
                "notification_types": {
                    "daily_updates": True,
                    "disease_alerts": True,
                    "weather_alerts": True,
                    "market_updates": True,
                    "news_alerts": True
                },
                "notification_times": {
                    "daily_update_time": "08:00",
                    "alert_time": "any"
                },
                "topics": {
                    "weather": True,
                    "market": True,
                    "disease": True,
                    "news": True
                }
            },
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Generate tokens with actual user ID
        print("Creating new access: ", new_user.id)
        access_token = create_access_token(str(new_user.id))
        refresh_token = create_refresh_token(str(new_user.id))
        
        # Store refresh token
        new_user.refresh_token = refresh_token
        new_user.refresh_token_expires_at = datetime.now(timezone.utc) + timedelta(days=60)
        db.commit()
        
        # ✅ Run login history in background
        background_tasks.add_task(
            save_login_history_in_background,
            user_id=str(new_user.id),
            ip=ip,
            ua=ua,
            device_type=device
        )

        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserRead.model_validate(new_user)
        )

    except Exception as e:
        db.rollback()
        logger.error(f"[AUTH ERROR] {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/firebase-user/{firebase_uid}")
async def check_firebase_user(firebase_uid: str, db: Session = Depends(get_db)):
    """Check if user exists with given Firebase UID."""
    try:
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
        if not user:
            return {"exists": False, "message": "User not found"}

        return {
            "exists": True,
            "user_id": user.id,
            "username": user.username,
            "phone_verified": user.phone_verified,
            "email_verified": user.email_verified
        }

    except Exception as e:
        logger.error(f"Error checking Firebase user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )

@router.post("/link-firebase", response_model=Token)
async def link_firebase_account(
    request_data: LinkFirebaseRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Link existing backend user account with Firebase."""
    try:
        # Verify Firebase token
        decoded_token = verify_firebase_token(request_data.firebase_id_token)
        firebase_uid = decoded_token.get('uid')

        # Check if Firebase UID is already linked to another user
        existing_user = db.query(User).filter(
            User.firebase_uid == firebase_uid,
            User.id != current_user.id
        ).first()

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Firebase account is already linked to another user"
            )

        # Link Firebase UID to current user
        current_user.firebase_uid = firebase_uid
        if decoded_token.get('phone_number'):
            current_user.phone_number = decoded_token.get('phone_number')
            current_user.phone_verified = True

        # Generate new tokens
        access_token = create_access_token(str(current_user.id))
        refresh_token = create_refresh_token(str(current_user.id))

        # Store refresh token
        current_user.refresh_token = refresh_token
        current_user.refresh_token_expires_at = datetime.now(
            timezone.utc) + timedelta(days=60)

        db.commit()

        logger.info(f"Firebase account linked to user {current_user.id}")

        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserRead.model_validate(current_user)
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error linking Firebase account: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during account linking"
        )


@router.delete("/delete-users", response_model=List[DeleteUserResponse])
async def delete_users_by_ids(
    request_data: DeleteUsersRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete users from both Firebase and database based on user IDs.
    
    This endpoint requires authentication and will delete users from:
    1. Firebase Authentication (using firebase_uid from database)
    2. Database (by user ID)
    
    Returns detailed results for each user ID processed.
    """
    try:
        results = []
        
        for user_id_str in request_data.user_ids:
            result = DeleteUserResponse(
                user_id=user_id_str,
                deleted_from_firebase=False,
                deleted_from_database=False
            )
            
            try:
                # Convert string user_id to integer
                user_id = int(user_id_str)
                
                # Step 1: Find user in database by user ID
                db_user = db.query(User).filter(User.id == user_id).first()
                
                if db_user:
                    result.phone_number = db_user.phone_number
                    result.firebase_uid = db_user.firebase_uid
                    
                    # Step 2: Delete from Firebase if firebase_uid exists
                    if db_user.firebase_uid:
                        try:
                            firebase_auth.delete_user(db_user.firebase_uid)
                            result.deleted_from_firebase = True
                            logger.info(f"Deleted Firebase user with UID: {db_user.firebase_uid}")
                        except firebase_auth.UserNotFoundError:
                            logger.warning(f"Firebase user not found for UID: {db_user.firebase_uid}")
                            result.deleted_from_firebase = True  # Consider it deleted if not found
                        except Exception as e:
                            logger.error(f"Error deleting Firebase user {db_user.firebase_uid}: {str(e)}")
                            result.error_message = f"Firebase deletion failed: {str(e)}"
                    
                    # Step 3: Delete from database
                    try:
                        db.delete(db_user)
                        db.commit()
                        result.deleted_from_database = True
                        logger.info(f"Deleted database user with ID: {db_user.id}")
                    except Exception as e:
                        db.rollback()
                        logger.error(f"Error deleting database user {db_user.id}: {str(e)}")
                        result.error_message = f"Database deletion failed: {str(e)}"
                else:
                    # User not found in database
                    logger.warning(f"User not found in database with ID: {user_id}")
                    result.error_message = f"User not found in database with ID: {user_id}"
                
            except ValueError:
                logger.error(f"Invalid user ID format: {user_id_str}")
                result.error_message = f"Invalid user ID format: {user_id_str}"
            except Exception as e:
                logger.error(f"Error processing user ID {user_id_str}: {str(e)}")
                result.error_message = f"Processing error: {str(e)}"
            
            results.append(result)
        
        # Log summary
        successful_firebase = sum(1 for r in results if r.deleted_from_firebase)
        successful_database = sum(1 for r in results if r.deleted_from_database)
        total_processed = len(results)
        
        logger.info(f"User deletion summary: {total_processed} processed, "
                   f"{successful_firebase} Firebase deletions, {successful_database} database deletions")
        
        return results
        
    except Exception as e:
        logger.error(f"Error in delete_users_by_ids: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )