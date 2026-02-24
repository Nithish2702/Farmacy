from app.database import get_db_session, init_db
from app.models.user_personalization import UserCropTracking
from app.models.crop import Week, WeekTranslation
from datetime import date

def check_tracking():
    try:
        # Initialize the database first
        init_db()
        
        with get_db_session() as db:
            print("Connected to database")
            
            # Check if tracking exists
            tracking = db.query(UserCropTracking).filter(UserCropTracking.id == 8).first()
            if not tracking:
                print("Tracking ID 8 not found")
                return
            
            print(f"Found tracking: {tracking.__dict__}")
            
            # Calculate current day and week
            days_since_start = (date.today() - tracking.start_date).days
            current_week = (days_since_start // 7) + 1
            current_day = (days_since_start % 7) + 1 + current_week * 7
            
            print(f"Current week: {current_week}, Current day: {current_day}")
            
            # Check if week data exists
            week = db.query(Week).filter(
                Week.crop_id == tracking.crop_id,
                Week.week_number == current_week
            ).first()
            
            if not week:
                print(f"Week {current_week} not found for crop {tracking.crop_id}")
                # List available weeks for this crop
                weeks = db.query(Week).filter(Week.crop_id == tracking.crop_id).all()
                print(f"\nAvailable weeks for crop {tracking.crop_id}:")
                for w in weeks:
                    print(f"Week {w.week_number}")
                return
                
            print(f"Found week: {week.__dict__}")
            
            # Check translations
            translations = db.query(WeekTranslation).filter(WeekTranslation.week_id == week.id).all()
            print("\nAvailable translations:")
            for trans in translations:
                print(f"Language: {trans.language}")
                print(f"Title: {trans.title}")
                print(f"Days: {trans.days}")
                print("---")
    except Exception as e:
        print(f"Error: {str(e)}")
        raise

if __name__ == "__main__":
    check_tracking()