#!/usr/bin/env python3
"""
Test script to verify the OTP system with MSG91
"""

import sys
import os
from pathlib import Path

# Add the app directory to the Python path
sys.path.append(str(Path(__file__).parent))

from app.services.otp_service import OTPService
from app.services.sms_service import sms_manager, send_otp_sms
from app.core.config import settings
import asyncio

def test_sms_manager():
    """Test SMS manager configuration"""
    print("🔧 Testing SMS Manager Configuration...")
    
    # Check available services
    services = sms_manager.get_available_services()
    print(f"📱 Available SMS services: {services}")
    
    # Check primary service
    primary = sms_manager.get_primary_service()
    print(f"⭐ Primary SMS service: {primary}")
    
    # Check MSG91 configuration
    if 'msg91' in services:
        print("✅ MSG91 service is available")
        
        # Check MSG91 settings
        msg91_api_key = getattr(settings, 'MSG91_API_KEY', None)
        msg91_sender_id = getattr(settings, 'MSG91_SENDER_ID', None)
        msg91_template_id = getattr(settings, 'MSG91_TEMPLATE_ID', None)
        
        print(f"🔑 MSG91 API Key: {'✅ Set' if msg91_api_key else '❌ Not set'}")
        print(f"📧 MSG91 Sender ID: {msg91_sender_id}")
        print(f"📝 MSG91 Template ID: {msg91_template_id}")
    else:
        print("❌ MSG91 service is not available")
    
    return 'msg91' in services

def test_otp_service():
    """Test OTP service functionality"""
    print("\n🔐 Testing OTP Service...")
    
    try:
        otp_service = OTPService()
        print("✅ OTP service initialized successfully")
        return otp_service
    except Exception as e:
        print(f"❌ Failed to initialize OTP service: {e}")
        return None

def test_sms_sending():
    """Test SMS sending functionality"""
    print("\n📤 Testing SMS Sending...")
    
    test_phone = "+919876543210"  # Test phone number
    test_message = "Test OTP: 123456"
    
    try:
        # Test using SMS manager
        result = send_otp_sms(test_phone, "123456")
        print(f"📱 SMS sending result: {'✅ Success' if result else '❌ Failed'}")
        return result
    except Exception as e:
        print(f"❌ SMS sending error: {e}")
        return False

def test_otp_flow():
    """Test complete OTP flow"""
    print("\n🔄 Testing Complete OTP Flow...")
    
    test_phone = "+919876543210"
    
    try:
        otp_service = OTPService()
        
        # Test OTP generation
        print("1️⃣ Testing OTP generation...")
        otp_record = otp_service.generate_otp(test_phone)
        print(f"✅ OTP generated: {otp_record.otp_code}")
        print(f"⏰ Expires at: {otp_record.expires_at}")
        
        # Test OTP verification
        print("2️⃣ Testing OTP verification...")
        is_valid = otp_service.verify_otp(test_phone, otp_record.otp_code)
        print(f"✅ OTP verification: {'✅ Valid' if is_valid else '❌ Invalid'}")
        
        # Test invalid OTP
        print("3️⃣ Testing invalid OTP...")
        is_invalid = otp_service.verify_otp(test_phone, "000000")
        print(f"✅ Invalid OTP test: {'✅ Correctly rejected' if not is_invalid else '❌ Should have been rejected'}")
        
        return True
        
    except Exception as e:
        print(f"❌ OTP flow error: {e}")
        return False

def main():
    """Main test function"""
    print("🧪 OTP System Verification Test")
    print("=" * 50)
    
    # Test SMS manager
    sms_ok = test_sms_manager()
    
    # Test OTP service
    otp_service = test_otp_service()
    
    # Test SMS sending
    sms_sending_ok = test_sms_sending()
    
    # Test OTP flow
    otp_flow_ok = test_otp_flow()
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Summary:")
    print(f"SMS Manager: {'✅ OK' if sms_ok else '❌ FAILED'}")
    print(f"OTP Service: {'✅ OK' if otp_service else '❌ FAILED'}")
    print(f"SMS Sending: {'✅ OK' if sms_sending_ok else '❌ FAILED'}")
    print(f"OTP Flow: {'✅ OK' if otp_flow_ok else '❌ FAILED'}")
    
    if all([sms_ok, otp_service, sms_sending_ok, otp_flow_ok]):
        print("\n🎉 All tests passed! OTP system is working correctly.")
    else:
        print("\n⚠️ Some tests failed. Please check the configuration.")

if __name__ == "__main__":
    main() 