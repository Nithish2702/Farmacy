#!/usr/bin/env python3
"""
Script to create OTP tables in the database
"""

import sys
import os
from pathlib import Path

# Add the app directory to the Python path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from app.core.config import settings
from app.models.otp import Base as OTPBase
from app.database import engine

def create_otp_tables():
    """Create OTP tables in the database"""
    try:
        print("Creating OTP tables...")
        
        # Create OTP tables
        OTPBase.metadata.create_all(bind=engine)
        
        print("✅ OTP tables created successfully!")
        
        # Verify tables were created
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('otp_records', 'daily_otp_limits')
                ORDER BY table_name;
            """))
            
            tables = [row[0] for row in result]
            print(f"📋 Created tables: {', '.join(tables)}")
            
    except Exception as e:
        print(f"❌ Error creating OTP tables: {e}")
        sys.exit(1)

if __name__ == "__main__":
    create_otp_tables() 