from typing import Optional, Dict, Any, List
import firebase_admin
from firebase_admin import messaging, credentials
from app.models.fcm import FCMToken
from app.core.config import settings
from app.services.fcm import FCMService
from sqlalchemy.orm import Session
# from rq import Queue, Worker, Connection
# from redis import Redis

# Create queues
# notification_queue = Queue('notifications', connection=Redis())
# high_priority_queue = Queue('high_priority', connection=Redis())

async def send_push_notification(
    db: Session,
    user_id: int,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    image: Optional[str] = None
) -> bool:
    """
    Send a push notification using Firebase Cloud Messaging (FCM).
    
    Args:
        db: Database session
        user_id: User ID to send notification to
        title: Notification title
        body: Notification body
        data: Optional additional data to send
        image: Optional image URL to display
    
    Returns:
        bool: True if notification was sent successfully, False otherwise
    """
    try:
        # Get user's active FCM tokens
        tokens = db.query(FCMToken).filter(
            FCMToken.user_id == user_id,
            FCMToken.is_active == True
        ).all()

        if not tokens:
            return False

        # Send to all user's devices
        for token in tokens:
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                    image=image
                ),
                data=data or {},
                token=token.token
            )
            messaging.send(message)
        
        return True
    except Exception as e:
        print(f"Error sending push notification: {str(e)}")
        return False

async def send_multicast_push_notification(
    db: Session,
    user_ids: List[int],
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    image: Optional[str] = None
) -> bool:
    """
    Send push notifications to multiple users.
    
    Args:
        db: Database session
        user_ids: List of user IDs to send notifications to
        title: Notification title
        body: Notification body
        data: Optional additional data to send
        image: Optional image URL to display
    
    Returns:
        bool: True if notifications were sent successfully, False otherwise
    """
    try:
        # Get all active FCM tokens for the users
        tokens = db.query(FCMToken).filter(
            FCMToken.user_id.in_(user_ids),
            FCMToken.is_active == True
        ).all()

        if not tokens:
            return False

        # Split tokens into batches of 500 (FCM limit)
        token_batches = [tokens[i:i + 500] for i in range(0, len(tokens), 500)]
        success_count = 0

        for batch in token_batches:
            # Create multicast message for this batch
            message = messaging.MulticastMessage(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                    image=image
                ),
                data=data or {},
                tokens=[token.token for token in batch]
            )

            # Send message
            response = messaging.send_multicast(message)
            success_count += response.success_count

        return bool(success_count > 0)
    except Exception as e:
        print(f"Error sending multicast push notification: {str(e)}")
        return False

async def send_topic_notification(
    db: Session,
    topic_name: str,
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    image: Optional[str] = None
) -> bool:
    """
    Send a notification to all subscribers of a topic.
    
    Args:
        db: Database session
        topic_name: Name of the topic to send to
        title: Notification title
        body: Notification body
        data: Optional additional data to send
        image: Optional image URL to display
    
    Returns:
        bool: True if notification was sent successfully, False otherwise
    """
    return await FCMService.send_topic_message(topic_name, title, body, data, image)

async def send_multicast_topic_notification(
    db: Session,
    topic_names: List[str],
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None,
    image: Optional[str] = None
) -> bool:
    """
    Send a notification to subscribers of multiple topics.
    
    Args:
        db: Database session
        topic_names: List of topic names to send to
        title: Notification title
        body: Notification body
        data: Optional additional data to send
        image: Optional image URL to display
    
    Returns:
        bool: True if notification was sent successfully, False otherwise
    """
    return await FCMService.send_multicast_topic_message(topic_names, title, body, data, image)

def process_notification(notification_data):
    # Process notification
    pass

async def send_notification(notification_data):
    # Add to appropriate queue
    if notification_data['priority'] == 'high':
        high_priority_queue.enqueue(process_notification, notification_data)
    else:
        notification_queue.enqueue(process_notification, notification_data)

# if __name__ == '__main__':
#     with Connection(Redis()):
#         worker = Worker([Queue('notifications')])
#         worker.work() 