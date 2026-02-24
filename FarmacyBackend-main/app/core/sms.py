from typing import Optional
import requests
from app.core.config import settings

async def send_sms(
    phone_number: str,
    message: str,
    priority: Optional[str] = "normal"
) -> bool:
    """
    Send an SMS using a third-party SMS service.
    
    Args:
        phone_number: Recipient phone number
        message: SMS message content
        priority: Message priority (normal/high)
    
    Returns:
        bool: True if SMS was sent successfully, False otherwise
    """
    try:
        # TODO: Replace with your preferred SMS service provider
        # This is a placeholder using a generic SMS API
        response = requests.post(
            settings.SMS_API_URL,
            json={
                "to": phone_number,
                "message": message,
                "priority": priority
            },
            headers={
                "Authorization": f"Bearer {settings.SMS_API_KEY}",
                "Content-Type": "application/json"
            }
        )
        
        return response.status_code == 200
    except Exception as e:
        print(f"Error sending SMS: {str(e)}")
        return False 