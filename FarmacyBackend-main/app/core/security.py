from datetime import datetime, timedelta, timezone
from typing import Optional
from passlib.context import CryptContext
import jwt

from app.core.config import settings

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return pwd_context.hash(password)

def create_token(subject: str, token_type: str, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)

    to_encode = {"exp": expire, "sub": subject, "type": token_type}
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def create_access_token(subject: str) -> str:
    """Create access token."""
    return create_token(
        subject,
        "access",
        timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    )

def create_refresh_token(subject: str) -> str:
    """Create refresh token."""
    return create_token(subject, "refresh", timedelta(days=60))

def verify_token(token: str, token_type: str) -> Optional[str]:
    """Verify JWT token."""
    try:
        if token.startswith("Bearer "):
            token = token[len("Bearer "):]
            
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        if payload.get("type") != token_type:
            return None
        return payload.get("sub")
    except jwt.PyJWTError:
        return None 