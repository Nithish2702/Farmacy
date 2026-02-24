from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
import firebase_admin
from firebase_admin import messaging
from app.database import get_db_session
from app.models.fcm import FCMToken, NotificationTopic
from app.models.user import User
from app.core.config import IST_TIME, settings
from app.core.logger import logger
from firebase_admin._messaging_utils import UnregisteredError

class FCMService:
    @staticmethod
    def get_user_token(db: Session, user_id: int):
        token = db.query(FCMToken).filter(FCMToken.user_id == user_id).first()
        return token.token if token else None
    
    @staticmethod
    def register_token(db: Session, user_id: int, token: str, device_type: str) -> FCMToken:
        """Register a new FCM token for a user."""
        logger.info(f"Registering Token {token}, userid: {user_id}")
        
        try:
            # Check if this exact token already exists for this user
            existing_token = db.query(FCMToken).filter(
                FCMToken.user_id == user_id,
                FCMToken.token == token
            ).first()
            
            if existing_token:
                # Update existing token
                existing_token.device_type = device_type
                existing_token.is_active = True
                existing_token.last_used_at = datetime.now(IST_TIME)
                db.commit()
                logger.info(f"Updated existing FCM token for user {user_id}: {token}")
                return existing_token
            
            # Check if this token is used by another user
            token_used_by_other = db.query(FCMToken).filter(
                FCMToken.token == token,
                FCMToken.user_id != user_id
            ).first()
            
            if token_used_by_other:
                # Remove the token from other user
                logger.info(f"Removing token {token} from user {token_used_by_other.user_id} as it's being used by user {user_id}")
                db.delete(token_used_by_other)
                db.commit()
            
            # Create new token for user
            fcm_token = FCMToken(
                user_id=user_id,
                token=token,
                device_type=device_type,
                is_active=True,
                last_used_at=datetime.now(IST_TIME)
            )
            logger.info(f"Adding new FCM token for user {user_id}: {token}")
            db.add(fcm_token)
            db.commit()
            db.refresh(fcm_token)
            return fcm_token
            
        except Exception as e:
            logger.error(f"Error registering FCM token: {str(e)}")
            db.rollback()
            raise e

    @staticmethod
    def unregister_token(db: Session, token: str, user_id: int) -> bool:
        """Unregister a specific FCM token for a user."""
        try:
            # Find and delete the specific token for this user
            fcm_token = db.query(FCMToken).filter(
                FCMToken.user_id == user_id,
                FCMToken.token == token
            ).first()
            
            if fcm_token:
                logger.info(f"Unregistering specific token {fcm_token.token} for user {user_id}")
                db.delete(fcm_token)
                db.commit()
                logger.info(f"Successfully unregistered token {token} for user {user_id}")
                return True
            else:
                logger.warning(f"Token {token} not found for user {user_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error unregistering FCM token: {str(e)}")
            db.rollback()
            return False

    @staticmethod
    def unregister_all_user_tokens(db: Session, user_id: int) -> bool:
        """Unregister all FCM tokens for a user (useful for logout)."""
        try:
            fcm_tokens = db.query(FCMToken).filter(FCMToken.user_id == user_id).all()
            
            if fcm_tokens:
                for fcm_token in fcm_tokens:
                    logger.info(f"Unregistering token {fcm_token.token} for user {user_id}")
                    db.delete(fcm_token)
                db.commit()
                logger.info(f"Successfully unregistered {len(fcm_tokens)} tokens for user {user_id}")
                return True
            else:
                logger.info(f"No FCM tokens found for user {user_id}")
                return True  # Consider this a success since the goal is achieved
                
        except Exception as e:
            logger.error(f"Error unregistering all FCM tokens for user {user_id}: {str(e)}")
            db.rollback()
            return False

    @staticmethod
    async def create_topic(db: Session, name: str, description: str, type: str) -> NotificationTopic:
        """Create a new notification topic."""
        topic = NotificationTopic(
            name=name,
            description=description,
            type=type
        )
        db.add(topic)
        db.commit()
        db.refresh(topic)
        return topic

    @staticmethod
    async def subscribe_to_topic(db: Session, user_id: int, topic_name: str) -> bool:
        """Subscribe a user to a topic."""
        logger.info(f"Attempting to subscribe user {user_id} to topic {topic_name}")
        
        user = db.query(User).filter(User.id == user_id).first()
        topic = db.query(NotificationTopic).filter(NotificationTopic.name == topic_name).first()
        
        if not user or not topic:
            logger.error(f"User {user_id} or topic {topic_name} not found")
            return False
        
        logger.info(f"Found user and topic, checking existing subscription")

        # Add user to topic subscribers
        if topic not in user.subscribed_topics:
            logger.info(f"Adding user {user_id} to topic {topic_name} subscribers")
            user.subscribed_topics.append(topic)
            db.commit()
        else:
            logger.info(f"User {user_id} already subscribed to topic {topic_name}")
            return True

        # Subscribe all user's active tokens to the FCM topic
        tokens = db.query(FCMToken).filter(
            FCMToken.user_id == user_id,
            FCMToken.is_active == True
        ).all()

        if tokens:
            token_list = [token.token for token in tokens]
            logger.info(f"Found {len(token_list)} active tokens for user {user_id}")
            try:
                logger.info(f"Subscribing tokens to FCM topic {topic_name}")
                response = messaging.subscribe_to_topic(token_list, topic_name)
                logger.info(f"FCM subscription response: {response}")
                return response.success_count > 0
            except Exception as e:
                logger.error(f"Error subscribing to topic: {str(e)}")
                logger.exception("Full traceback:")
                return False
        else:
            logger.warning(f"No active FCM tokens found for user {user_id}")
        return True

    @staticmethod
    async def unsubscribe_from_topic(db: Session, user_id: int, topic_name: str) -> bool:
        """Unsubscribe a user from a topic."""
        user = db.query(User).filter(User.id == user_id).first()
        topic = db.query(NotificationTopic).filter(NotificationTopic.name == topic_name).first()
        
        if not user or not topic:
            return False

        # Remove user from topic subscribers
        if topic in user.subscribed_topics:
            user.subscribed_topics.remove(topic)
            db.commit()

        # Unsubscribe all user's active tokens from the FCM topic
        tokens = db.query(FCMToken).filter(
            FCMToken.user_id == user_id,
            FCMToken.is_active == True
        ).all()

        if tokens:
            token_list = [token.token for token in tokens]
            try:
                response = messaging.unsubscribe_from_topic(token_list, topic_name)
                return response.success_count > 0
            except Exception as e:
                logger.error(f"Error unsubscribing from topic: {str(e)}")
                return False
        return True

    @staticmethod
    async def send_topic_message(
        topic_name: str,
        title: str,
        body: str,
        data: Optional[dict] = None,
        image: Optional[str] = None
    ) -> bool:
        """Send a message to all subscribers of a topic."""
        try:
            logger.info(f"Attempting to send topic message to {topic_name}")
            logger.info(f"Message details - Title: {title}, Body: {body}, Data: {data}")
            
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                    image=image
                ),
                data=data or {},
                topic=topic_name
            )
            
            logger.info("Message constructed, sending to FCM...")
            response = messaging.send(message)
            logger.info(f"FCM Response: {response}")
            return bool(response)
        except Exception as e:
            logger.error(f"Error sending topic message: {str(e)}")
            logger.exception("Full traceback:")
            return False

    @staticmethod
    async def send_multicast_topic_message(
        topic_names: List[str],
        title: str,
        body: str,
        data: Optional[dict] = None,
        image: Optional[str] = None
    ) -> bool:
        """Send a message to subscribers of multiple topics."""
        try:
            condition = " || ".join([f"'%s' in topics" % topic for topic in topic_names])
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                    image=image
                ),
                data=data or {},
                condition=condition
            )
            response = messaging.send(message)
            return bool(response)
        except Exception as e:
            logger.error(f"Error sending multicast topic message: {str(e)}")
            return False

    @staticmethod
    async def send_notification(
        token: str,
        title: str,
        body: str,
        data: Optional[dict] = None,
        image: Optional[str] = None,
        priority: str = "high",
        ttl: Optional[int] = None,
        sound: Optional[str] = None,
        badge: Optional[int] = None,
        click_action: Optional[str] = None
    ) -> bool:
        """
        Send a direct push notification using Firebase Cloud Messaging.
        
        Args:
            token: FCM token
            title: Notification title
            body: Notification body
            data: Additional data to send with the notification (all values must be strings)
            image: URL of the image to display
            priority: Notification priority (high/normal)
            ttl: Time to live in seconds
            sound: Sound to play
            badge: Badge count
            click_action: Action to perform when notification is clicked
            
        Returns:
            bool: True if notification was sent successfully, False otherwise
        """
        try:
            # Convert all data values to strings
            stringified_data = {}
            if data:
                for key, value in data.items():
                    stringified_data[str(key)] = str(value)

            # Log the notification details
            logger.info(f"Preparing notification with details:")
            logger.info(f"Token: {token}")
            logger.info(f"Title: {title}")
            logger.info(f"Body: {body}")
            logger.info(f"Data: {stringified_data}")
            logger.info(f"Priority: {priority}")

            # Prepare the message with both notification and data payload
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                    image=image
                ),
                data=stringified_data,
                token=token,
                # android=messaging.AndroidConfig(
                #     priority=priority,
                #     ttl=ttl,
                    # notification=messaging.AndroidNotification(
                    #     sound=sound or "default",
                    #     click_action=click_action,
                    #     channel_id="default",  # Add default channel ID for Android
                    #     priority="high",
                    #     visibility="public"
                    # )
                # ),
                # apns=messaging.APNSConfig(
                #     payload=messaging.APNSPayload(
                #         aps=messaging.Aps(
                #             sound=sound or "default",
                #             badge=badge,
                #             content_available=True,
                #             mutable_content=True,
                #             alert=messaging.ApsAlert(
                #                 title=title,
                #                 body=body
                #             )
                #         )
                #     ),
                #     headers={
                #         "apns-priority": "10"  # High priority for APNS
                #     }
                # )
            )

            # Send the notification using FCM
            response = messaging.send(message)
            logger.info(f"FCM Response: {response}")
            logger.info(f"Successfully sent notification to token: {token}")
            return bool(response)

        except Exception as e:
            logger.error(f"Error sending notification: {str(e)}")
            logger.exception("Full traceback:")
            return False

    @staticmethod
    def _send_notification_sync(
        user_id: int,
        token: str,
        title: str,
        body: str,
        data: Optional[dict] = None,
        image: Optional[str] = None,
        priority: str = "high",
        ttl: Optional[int] = None,
        sound: Optional[str] = None,
        badge: Optional[int] = None,
        click_action: Optional[str] = None
    ) -> bool:
        """
        Synchronous version of send_notification for background tasks.
        
        Args:
            token: FCM token
            title: Notification title
            body: Notification body
            data: Additional data to send with the notification (all values must be strings)
            image: URL of the image to display
            priority: Notification priority (high/normal)
            ttl: Time to live in seconds
            sound: Sound to play
            badge: Badge count
            click_action: Action to perform when notification is clicked
            
        Returns:
            bool: True if notification was sent successfully, False otherwise
        """
        try:
            # Convert all data values to strings and remove image/sound from data
            stringified_data = {}
            if data:
                for key, value in data.items():
                    if value is not None and key not in ['image_url', 'sound']:
                        stringified_data[str(key)] = str(value)

            logger.info(f"[SYNC] Preparing notification with details:")
            logger.info(f"[SYNC] Token: {token}")
            logger.info(f"[SYNC] Title: {title}")
            logger.info(f"[SYNC] Body: {body}")
            logger.info(f"[SYNC] Data: {stringified_data}")
            logger.info(f"[SYNC] Priority: {priority}")

            # Prepare the message with notification, data, and android config
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                    image=image
                ),
                android=messaging.AndroidConfig(
                    priority=priority,
                    notification=messaging.AndroidNotification(
                        sound=sound or "sound1",  # Default to custom sound instead of "default"
                        image=image,
                        channel_id="default"
                    )
                ),
                data=stringified_data,  # Only routing info, no title/body/image
                token=token,
            )

            response = messaging.send(message)
            logger.info(f"[SYNC] FCM Response: {response}")
            logger.info(f"[SYNC] Successfully sent notification to token: {token}")
            return bool(response)

        except UnregisteredError:
            logger.warning(f"[SYNC] Unregistered FCM token for user {token}, removing token.")
            from app.database import get_db_session
            with get_db_session() as db_session:
                FCMService.remove_user_token(db_session, user_id, token)
            return False

        except Exception as e:
            logger.error(f"[SYNC] Error sending notification: {str(e)}")
            logger.exception("[SYNC] Full traceback:")
            return False

    @staticmethod
    def send_topic_message_sync(
        topic_name: str,
        title: str,
        body: str,
        data: Optional[dict] = None,
        image: Optional[str] = None
    ) -> bool:
        """Synchronous version of send_topic_message for background tasks."""
        try:
            logger.info(f"[SYNC] Attempting to send topic message to {topic_name}")
            logger.info(f"[SYNC] Message details - Title: {title}, Body: {body}, Data: {data}")
            
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                    image=image
                ),
                data=data or {},
                topic=topic_name
            )
            
            logger.info("[SYNC] Message constructed, sending to FCM...")
            response = messaging.send(message)
            logger.info(f"[SYNC] FCM Response: {response}")
            return bool(response)
        except Exception as e:
            logger.error(f"[SYNC] Error sending topic message: {str(e)}")
            logger.exception("[SYNC] Full traceback:")
            return False

    @staticmethod
    def send_multicast_topic_message_sync(
        topic_names: List[str],
        title: str,
        body: str,
        data: Optional[dict] = None,
        image: Optional[str] = None
    ) -> bool:
        """Synchronous version of send_multicast_topic_message for background tasks."""
        try:
            condition = " || ".join([f"'%s' in topics" % topic for topic in topic_names])
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                    image=image
                ),
                data=data or {},
                condition=condition
            )
            response = messaging.send(message)
            return bool(response)
        except Exception as e:
            logger.error(f"[SYNC] Error sending multicast topic message: {str(e)}")
            return False

    @staticmethod
    def remove_user_token(db: Session, user_id: int, token: str):
        db.query(FCMToken).filter(
            FCMToken.user_id == user_id,
            FCMToken.token == token
        ).delete()
        db.commit()
        logger.info(f"Removed FCM token for user {user_id}")