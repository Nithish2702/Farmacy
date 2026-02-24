from app.database import get_db_session, init_db
from app.models.user_personalization import UserCropTracking
from app.models.crop import Week, WeekTranslation
from datetime import date

def check_translations():
    try:
        # Initialize the database first
        init_db()
        
        with get_db_session() as db:
            print("Connected to database")
            
            # Get the tracking
            tracking = db.query(UserCropTracking)\
                .filter(UserCropTracking.id == 3)\
                .first()
            
            if not tracking:
                print("Tracking ID 3 not found")
                return
            
            print(f"Found tracking: {tracking.__dict__}")
            
            # Calculate current day and week
            days_since_start = (date.today() - tracking.start_date).days
            current_week = (days_since_start // 7) + 1
            current_day = (days_since_start % 7) + 1 + current_week * 7
            
            print(f"Current week: {current_week}, Current day: {current_day}")
            
            # Get week data
            week = db.query(Week)\
                .filter(
                    Week.crop_id == tracking.crop_id,
                    Week.week_number == current_week
                ).first()
            
            if not week:
                print(f"Week {current_week} not found for crop {tracking.crop_id}")
                return
            
            print(f"Found week: {week.__dict__}")
            
            # Get all translations for this week
            translations = db.query(WeekTranslation)\
                .filter(WeekTranslation.week_id == week.id)\
                .all()
            
            print("\nAvailable translations:")
            for trans in translations:
                print(f"\nLanguage: {trans.language}")
                print(f"Title: {trans.title}")
                day_key = f"day_{current_day}"
                daily_data = trans.days.get(day_key, {})
                print(f"Tasks for day {current_day}:")
                for task in daily_data.get("tasks", []):
                    print(f"  - {task}")
                print("Notes:")
                for note in daily_data.get("notes", []):
                    print(f"  - {note}")
                print("---")
            
    except Exception as e:
        print(f"Error: {str(e)}")
        raise

if __name__ == "__main__":
    check_translations() 