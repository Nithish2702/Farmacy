import requests
import json
from typing import Optional, Dict, Any
from abc import ABC, abstractmethod

from app.core.config import settings
from app.core.logger import logger

class SMSService(ABC):
    """Abstract base class for SMS services"""
    
    @abstractmethod
    def send_sms(self, phone_number: str, message: str) -> bool:
        """Send SMS to the given phone number"""
        pass
    
    @abstractmethod
    def get_service_name(self) -> str:
        """Get the name of the SMS service"""
        pass

class TwilioSMSService(SMSService):
    """Twilio SMS service implementation"""
    
    def __init__(self):
        self.account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', None)
        self.auth_token = getattr(settings, 'TWILIO_AUTH_TOKEN', None)
        self.from_number = getattr(settings, 'TWILIO_PHONE_NUMBER', None)
        
        if not all([self.account_sid, self.auth_token, self.from_number]):
            logger.warning("Twilio credentials not configured")
    
    def send_sms(self, phone_number: str, message: str) -> bool:
        """Send SMS using Twilio"""
        try:
            if not all([self.account_sid, self.auth_token, self.from_number]):
                logger.error("Twilio credentials not configured")
                return False
            
            url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
            
            payload = {
                'To': phone_number,
                'From': self.from_number,
                'Body': message
            }
            
            response = requests.post(
                url,
                data=payload,
                auth=(self.account_sid, self.auth_token)
            )
            
            if response.status_code == 201:
                logger.info(f"Twilio SMS sent successfully to {phone_number}")
                return True
            else:
                logger.error(f"Twilio SMS failed: {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Twilio SMS error: {str(e)}")
            return False
    
    def get_service_name(self) -> str:
        return "Twilio"

class MSG91Service(SMSService):
    """MSG91 SMS service implementation (Popular in India)"""
    
    def __init__(self):
        self.api_key = getattr(settings, 'MSG91_API_KEY', None)
        self.sender_id = getattr(settings, 'MSG91_SENDER_ID', 'FARMACY')
        self.template_id = getattr(settings, 'MSG91_TEMPLATE_ID', None)
        
        if not self.api_key:
            logger.warning("MSG91 API key not configured")
    
    def send_sms(self, phone_number: str, message: str) -> bool:
        """Send SMS using MSG91"""
        try:
            if not self.api_key:
                logger.error("MSG91 API key not configured")
                return False
            
            # Remove country code for MSG91
            clean_number = phone_number.replace('+91', '')
            
            url = "https://api.msg91.com/api/v5/flow/"
            
            payload = {
                "flow_id": self.template_id,
                "sender": self.sender_id,
                "mobiles": clean_number,
                "VAR1": message  # OTP code
            }
            
            headers = {
                "Content-Type": "application/json",
                "Authkey": self.api_key
            }
            
            response = requests.post(url, json=payload, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('type') == 'success':
                    logger.info(f"MSG91 SMS sent successfully to {phone_number}")
                    return True
                else:
                    logger.error(f"MSG91 SMS failed: {result}")
                    return False
            else:
                logger.error(f"MSG91 SMS failed: {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"MSG91 SMS error: {str(e)}")
            return False
    
    def get_service_name(self) -> str:
        return "MSG91"

class SMSManager:
    """Manager class to handle SMS sending with multiple providers"""
    
    def __init__(self):
        self.services = {}
        self.primary_service = None
        self._initialize_services()
    
    def _initialize_services(self):
        """Initialize available SMS services"""
        
        # Try to initialize MSG91 (Primary)
        try:
            msg91_service = MSG91Service()
            if msg91_service.api_key:
                self.services['msg91'] = msg91_service
                self.primary_service = 'msg91'
                logger.info("MSG91 service initialized as primary")
            else:
                logger.warning("MSG91 API key not configured")
        except Exception as e:
            logger.warning(f"Failed to initialize MSG91: {str(e)}")
        
        # Try to initialize Twilio (Fallback)
        # try:
        #     twilio_service = TwilioSMSService()
        #     if twilio_service.account_sid:
        #         self.services['twilio'] = twilio_service
        #         if not self.primary_service:
        #             self.primary_service = 'twilio'
        #         logger.info("Twilio SMS service initialized as fallback")
        #     else:
        #         logger.warning("Twilio credentials not configured")
        # except Exception as e:
        #     logger.warning(f"Failed to initialize Twilio: {str(e)}")
    
    def send_sms(self, phone_number: str, message: str, service_name: Optional[str] = None) -> bool:
        """Send SMS using the specified service or primary service"""
        
        if service_name and service_name in self.services:
            service = self.services[service_name]
        elif self.primary_service:
            service = self.services[self.primary_service]
        else:
            logger.error("No SMS service available")
            return False
        
        return service.send_sms(phone_number, message)
    
    def send_otp_sms(self, phone_number: str, otp_code: str, service_name: Optional[str] = None) -> bool:
        """Send OTP SMS with formatted message"""
        message = f"Your Farmacy verification code is: {otp_code}. Valid for 5 minutes."
        return self.send_sms(phone_number, message, service_name)
    
    def get_available_services(self) -> Dict[str, str]:
        """Get list of available SMS services"""
        return {name: service.get_service_name() for name, service in self.services.items()}
    
    def get_primary_service(self) -> Optional[str]:
        """Get the name of the primary SMS service"""
        return self.primary_service

# Global SMS manager instance
sms_manager = SMSManager()

def send_sms(phone_number: str, message: str, service_name: Optional[str] = None) -> bool:
    """Global function to send SMS"""
    return sms_manager.send_sms(phone_number, message, service_name)

def send_otp_sms(phone_number: str, otp_code: str, service_name: Optional[str] = None) -> bool:
    """Global function to send OTP SMS"""
    return sms_manager.send_otp_sms(phone_number, otp_code, service_name)
