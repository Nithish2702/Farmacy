from typing import Annotated
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone, timedelta
import user_agents

from app.queries.logout_cleanup import run_logout_cleanup
from app.core.cache import cache_response, clear_related_caches
from app.models.notification import NotificationPriority, NotificationType
from app.services.notification import NotificationService
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    verify_token
)
from app.database import get_db
from app.dependencies.auth import get_current_active_user, get_current_user
from app.models.user import User, UserLoginHistory
from app.schemas.user import UserCreate, UserRead, UserLogin, Token
from app.services.fcm import FCMService
from app.core.logger import logger

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
async def signup(user_data: UserCreate, db: Session = Depends(get_db)):
    """Create a new user."""
    # Check if user with same email exists
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Check if username is taken
    # if db.query(User).filter(User.username == user_data.username).first():
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST,
    #         detail="Username already taken"
    #     )

    try:
        # Create new user
        hashed_password = get_password_hash(user_data.password)
        db_user = User(
            username=user_data.username,
            email=user_data.email,
            phone_number=user_data.phone_number,
            farm_type=user_data.farm_type,
            hashed_password=hashed_password
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)

        # Generate tokens
        access_token = create_access_token(str(db_user.id))
        refresh_token = create_refresh_token(str(db_user.id))

        # Store refresh token in user record
        db_user.refresh_token = refresh_token
        db_user.refresh_token_expires_at = datetime.now(timezone.utc) + timedelta(days=60)
        db.commit()

        return Token(
            access_token=access_token,
            refresh_token=refresh_token
        )
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error creating user"
        )


@router.post("/login", response_model=Token)
@clear_related_caches(patterns=["user_info*"])
async def login(
    user_data: UserLogin, 
    request: Request,
    db: Session = Depends(get_db)
):
    """Login user and return access and refresh tokens."""
    # Find user by email
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user:
        # Record failed login attempt
        login_record = UserLoginHistory(
            user_id=None,
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent"),
            device_type=get_device_type(request.headers.get("user-agent")),
            login_status=False
        )
        db.add(login_record)
        db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Verify password
    if not verify_password(user_data.password, user.hashed_password):
        # Record failed login attempt
        login_record = UserLoginHistory(
            user_id=user.id,
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent"),
            device_type=get_device_type(request.headers.get("user-agent")),
            login_status=False
        )
        db.add(login_record)
        db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    # Set user as active
    user.is_active = True

    # Generate tokens
    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))

    # Store refresh token in user record
    user.refresh_token = refresh_token
    user.refresh_token_expires_at = datetime.now(timezone.utc) + timedelta(days=60)

    # Record successful login
    login_record = UserLoginHistory(
        user_id=user.id,
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent"),
        device_type=get_device_type(request.headers.get("user-agent")),
        login_status=True
    )
    db.add(login_record)
    db.commit()

    return Token(
        access_token=access_token,
        refresh_token=refresh_token
    )

@router.post("/refresh", response_model=Token)
async def refresh_token(
    request: Request,
    refresh_token: str,
    db: Session = Depends(get_db)
):
    """Get new access token using refresh token."""
    # Check if refresh token exists and is valid
    user = db.query(User).filter(
        User.refresh_token == refresh_token,
        User.refresh_token_expires_at > datetime.now(timezone.utc)
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    logger.info("Refresh Token Valid, generating New.... ")

    # Verify the token payload
    user_id = verify_token(refresh_token, "refresh")
    if not user_id or str(user.id) != user_id:
        # Clear invalid refresh token
        user.refresh_token = None
        user.refresh_token_expires_at = None
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    # Generate new tokens
    new_access_token = create_access_token(str(user.id))
    new_refresh_token = create_refresh_token(str(user.id))

    # Update refresh token
    user.refresh_token = new_refresh_token
    user.refresh_token_expires_at = datetime.now(
        timezone.utc) + timedelta(days=7)
    db.commit()

    return Token(
        access_token=new_access_token,
        refresh_token=new_refresh_token
    )


@router.post("/logout")
@clear_related_caches(patterns=["user_info*"])
async def logout(
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_active_user)], 
    db: Session = Depends(get_db)
):
    """Logout user and clear refresh token."""
    try:
        # Set user as inactive and clear token
        current_user.is_active = False
        current_user.refresh_token = None
        current_user.refresh_token_expires_at = None
        db.commit()

        # Run unregistration and history update in background
        background_tasks.add_task(run_logout_cleanup, current_user.id)

        logger.info(f"User {current_user.id} logged out immediately")
        return {"message": "Successfully logged out"}
    
    except Exception as e:
        logger.error(f"Error during logout for user {current_user.id}: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Logout failed")

@router.put("/update-username")
@clear_related_caches(patterns=["user_info*"])
async def update_username(
    username: str,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: Session = Depends(get_db)
):
    """Update user's username."""
    try:
        # Validate username
        if not username or len(username.strip()) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username must be at least 3 characters long"
            )
        
        if len(username.strip()) > 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username must be less than 50 characters"
            )
        
        username = username.strip()
        
        # Check if username is already taken by another user
        # existing_user = db.query(User).filter(
        #     User.username == username,
        #     User.id != current_user.id
        # ).first()
        
        # # if existing_user:
        #     raise HTTPException(
        #         status_code=status.HTTP_400_BAD_REQUEST,
        #         detail="Username already taken"
        #     )
        
        # Update username
        current_user.username = username
        current_user.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(current_user)
        
        logger.info(f"Username updated for user {current_user.id} to: {username}")
        
        return {
            "message": "Username updated successfully",
            "user": UserRead.model_validate(current_user)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating username for user {current_user.id}: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update username")

def get_device_type(user_agent_string: str) -> str:
    """Determine device type from user agent string."""
    if not user_agent_string:
        return "unknown"
    
    user_agent = user_agents.parse(user_agent_string)
    if user_agent.is_mobile:
        return "mobile"
    elif user_agent.is_tablet:
        return "tablet"
    elif user_agent.is_pc:
        return "desktop"
    return "unknown"

@router.get("/me", response_model=UserRead)
@cache_response(ttl=21600, key_prefix="user_info")  # Cache for 6 hour
async def get_user_info(
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """Get current user information."""
    return UserRead.model_validate(current_user)