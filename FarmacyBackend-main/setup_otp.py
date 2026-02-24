#!/usr/bin/env python3
"""
Setup script for OTP system configuration
"""

import os
import sys
from pathlib import Path

def create_env_template():
    """Create a template .env file with OTP settings"""
    
    env_template = """
# OTP System Configuration
# ========================

# MSG91 SMS Settings (Primary SMS Provider)
# Get these from https://msg91.com/
MSG91_API_KEY=your_msg91_api_key_here
MSG91_SENDER_ID=FARMACY
MSG91_TEMPLATE_ID=your_template_id_here

# Twilio SMS Settings (Fallback SMS Provider)
# Get these from https://www.twilio.com/
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_phone_number_here

# OTP Configuration
OTP_EXPIRY_MINUTES=5
MAX_OTP_PER_DAY=5
MAX_OTP_RESEND_ATTEMPTS=2

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/farmacy_db

# JWT Configuration
JWT_SECRET_KEY=your_jwt_secret_key_here
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=240

# Other required settings...
"""
    
    env_file = Path(".env")
    if env_file.exists():
        print("⚠️ .env file already exists. Backing up to .env.backup")
        env_file.rename(".env.backup")
    
    with open(".env", "w") as f:
        f.write(env_template)
    
    print("✅ Created .env template file")
    print("📝 Please edit .env file with your actual credentials")

def check_dependencies():
    """Check if required dependencies are installed"""
    
    required_packages = [
        "requests",
        "sqlalchemy",
        "pydantic",
        "fastapi",
        "python-jose[cryptography]",
        "passlib[bcrypt]",
        "python-multipart"
    ]
    
    print("🔍 Checking dependencies...")
    
    missing_packages = []
    for package in required_packages:
        try:
            __import__(package.replace("-", "_"))
            print(f"✅ {package}")
        except ImportError:
            print(f"❌ {package} - MISSING")
            missing_packages.append(package)
    
    if missing_packages:
        print(f"\n⚠️ Missing packages: {', '.join(missing_packages)}")
        print("Install them with: pip install " + " ".join(missing_packages))
        return False
    
    print("✅ All dependencies are installed")
    return True

def create_database_tables():
    """Create database tables for OTP system"""
    
    print("🗄️ Creating database tables...")
    
    try:
        # Import and run the table creation script
        from scripts.create_otp_tables import create_otp_tables
        create_otp_tables()
        print("✅ Database tables created successfully")
        return True
    except Exception as e:
        print(f"❌ Failed to create database tables: {e}")
        return False

def main():
    """Main setup function"""
    
    print("🚀 OTP System Setup")
    print("=" * 50)
    
    # Check dependencies
    deps_ok = check_dependencies()
    
    # Create .env template
    create_env_template()
    
    # Create database tables
    tables_ok = create_database_tables()
    
    print("\n" + "=" * 50)
    print("📋 Setup Summary:")
    print(f"Dependencies: {'✅ OK' if deps_ok else '❌ FAILED'}")
    print(f"Database Tables: {'✅ OK' if tables_ok else '❌ FAILED'}")
    print("Environment: ✅ Template created")
    
    print("\n📝 Next Steps:")
    print("1. Edit .env file with your actual credentials")
    print("2. Set up MSG91 account at https://msg91.com/")
    print("3. Get your API key and template ID from MSG91")
    print("4. Update MSG91_API_KEY and MSG91_TEMPLATE_ID in .env")
    print("5. Run the test script: python test_otp_system.py")
    
    if deps_ok and tables_ok:
        print("\n🎉 Setup completed successfully!")
    else:
        print("\n⚠️ Setup completed with some issues. Please check the errors above.")

if __name__ == "__main__":
    main() 