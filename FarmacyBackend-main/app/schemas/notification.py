import re
from pydantic import BaseModel, Field, ValidationInfo, field_validator
from typing import Optional, Dict, Any, List
from datetime import datetime, time
from enum import Enum
from app.core.config import IST_TIME
from app.models.notification import NotificationType, NotificationPriority


class NotificationBase(BaseModel):
    type: NotificationType
    title: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1, max_length=1000)
    priority: NotificationPriority = NotificationPriority.MEDIUM
    data: Optional[Dict[str, Any]] = None
    language: Optional[str] = Field(None, pattern=r'^[a-z]{2}(-[A-Z]{2})?$')  # ISO language codes
    expires_at: Optional[datetime] = None
    scheduled_at: Optional[datetime] = None


class NotificationCreate(NotificationBase):
    user_ids: Optional[List[int]] = None  # For bulk notifications
    topic_ids: Optional[List[int]] = None  # For topic-based notifications
    scheduled_at: Optional[datetime] = None
    
    @field_validator('scheduled_at')
    def validate_scheduled_at(cls, v):
        if v and v <= datetime.now(IST_TIME):
            raise ValueError('scheduled_at must be in the future')
        return v


class NotificationUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    message: Optional[str] = Field(None, min_length=1, max_length=1000)
    priority: Optional[NotificationPriority] = None
    data: Optional[Dict[str, Any]] = None
    expires_at: Optional[datetime] = None
    scheduled_at: Optional[datetime] = None


class NotificationResponse(NotificationBase):
    id: int
    user_id: int
    is_read: bool = False
    read_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    delivery_status: Optional[str] = "pending"  # pending, sent, delivered, failed
    retry_count: int = 0
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class NotificationMarkRead(BaseModel):
    notification_ids: List[int] = Field(..., min_items=1)


class NotificationBulkAction(BaseModel):
    notification_ids: List[int] = Field(..., min_items=1)
    action: str = Field(..., pattern=r'^(mark_read|mark_unread|delete)$')


FCM_TOPIC_REGEX = re.compile(r'^[a-zA-Z0-9\-_.~%]+$')
class TopicBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1, max_length=500)
    type: str = Field(..., min_length=1, max_length=50)
    is_active: bool = True

    @field_validator("name")
    def validate_topic_name(cls, value):
        if not FCM_TOPIC_REGEX.fullmatch(value):
            raise ValueError(
                "Topic name can only contain letters, numbers, hyphens (-), underscores (_), dots (.), tildes (~), and percent signs (%)"
            )
        return value


class TopicCreate(TopicBase):
    pass

class SubscribeTopicInput(BaseModel):
    name: str = Field(...,max_length=100, pattern=r'^[a-zA-Z0-9-_.~%]+$')
    @field_validator("name")
    def validate_topic_name(cls, value):
        if not FCM_TOPIC_REGEX.fullmatch(value):
            raise ValueError(
                "Topic name can only contain letters, numbers, hyphens (-), underscores (_), dots (.), tildes (~), and percent signs (%)"
            )
        return value


class TopicUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, min_length=1, max_length=500)
    type: Optional[str] = Field(None, min_length=1, max_length=50)
    is_active: Optional[bool] = None
    @field_validator("name")
    def validate_topic_name(cls, value):
        if not FCM_TOPIC_REGEX.fullmatch(value):
            raise ValueError(
                "Topic name can only contain letters, numbers, hyphens (-), underscores (_), dots (.), tildes (~), and percent signs (%)"
            )
        return value

class TopicResponse(TopicBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    subscriber_count: int = 0

    class Config:
        from_attributes = True


class NotificationFrequency(str, Enum):
    INSTANT = "instant"
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    NEVER = "never"


class NotificationSettingsBase(BaseModel):
    email_notifications: bool = True
    sms_notifications: bool = False
    push_notifications: bool = True
    notification_types: Dict[str, bool] = Field(default_factory=dict)
    notification_frequency: NotificationFrequency = NotificationFrequency.INSTANT
    quiet_hours_start: Optional[time] = None
    quiet_hours_end: Optional[time] = None
    timezone: Optional[str] = Field(None, pattern=r'^[A-Za-z_]+/[A-Za-z_]+$')  # e.g., "America/New_York"
    
    @field_validator('quiet_hours_end')
    def validate_quiet_hours(cls, v, info: ValidationInfo):
        quiet_hours_start = info.data.get('quiet_hours_start')
        if v and quiet_hours_start:
            # Allow overnight quiet hours (e.g., 22:00 to 06:00)
            return v
        else:
            raise ValueError('quiet_hours_start must be set if quiet_hours_end is provided')


class NotificationSettingsUpdate(NotificationSettingsBase):
    email_notifications: Optional[bool] = None
    sms_notifications: Optional[bool] = None
    push_notifications: Optional[bool] = None
    notification_types: Optional[Dict[str, bool]] = None
    notification_frequency: Optional[NotificationFrequency] = None


class NotificationSettingsResponse(NotificationSettingsBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserTopicSubscription(BaseModel):
    user_id: int
    topic_id: int
    subscribed_at: datetime
    is_active: bool = True

    class Config:
        from_attributes = True


class TopicSubscriptionRequest(BaseModel):
    topic_ids: List[int] = Field(..., min_items=1)


class NotificationStats(BaseModel):
    total_notifications: int = 0
    unread_count: int = 0
    read_count: int = 0
    notifications_by_type: Dict[str, int] = Field(default_factory=dict)
    notifications_by_priority: Dict[str, int] = Field(default_factory=dict)


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    total_count: int
    unread_count: int
    page: int = 1
    page_size: int = 20
    has_next: bool = False
    has_previous: bool = False

class TopicBroadCastMessage(BaseModel):
    topic_name: str = Field(..., max_length=100)
    title: str = Field(..., max_length=100)
    message: str = Field(..., max_length=500)
    data: Optional[Dict[str, Any]]

    @field_validator("topic_name")
    def validate_topic_name(cls, value):
        if not FCM_TOPIC_REGEX.fullmatch(value):
            raise ValueError(
                "Topic name can only contain letters, numbers, hyphens (-), underscores (_), dots (.), tildes (~), and percent signs (%)"
            )
        return value