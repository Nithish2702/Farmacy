from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Annotated

from app.database import get_db
from app.schemas.otp import (
    MSG91AccessTokenRequest,
    MSG91AccessTokenResponse,
    CreateUserRequest
)
from app.services.msg91_service import MSG91Service
from app.core.logger import logger

router = APIRouter(prefix="/otp", tags=["otp"])

# Initialize MSG91 service
msg91_service = MSG91Service()


@router.post("/verify-access-token", response_model=MSG91AccessTokenResponse)
async def verify_access_token(
    request: MSG91AccessTokenRequest,
    db: Annotated[Session, Depends(get_db)]
):
    """Verify MSG91 access token and return user status"""
    try:
        result = msg91_service.verify_access_token(db, request)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error verifying access token: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify access token"
        )


@router.post("/create-user", response_model=MSG91AccessTokenResponse)
async def create_user(
    request: CreateUserRequest,
    db: Annotated[Session, Depends(get_db)]
):
    """Create a new user after MSG91 verification"""
    try:
        result = msg91_service.create_user(db, request)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )