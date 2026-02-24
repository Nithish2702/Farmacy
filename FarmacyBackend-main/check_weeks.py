from app.database import get_db_session, init_db
from app.models.crop import Week, WeekTranslation

def check_weeks():
    try:
        # Initialize the database first
        init_db()
        
        with get_db_session() as db:
            print("Connected to database")
            
            # Get all weeks for crop ID 2
            weeks = db.query(Week).filter(Week.crop_id == 2).all()
            print(f"\nFound {len(weeks)} weeks for crop ID 2:")
            
            for week in weeks:
                print(f"\nWeek {week.week_number}:")
                translations = db.query(WeekTranslation).filter(WeekTranslation.week_id == week.id).all()
                print(f"Stage ID: {week.stage_id}")
                print("Translations:")
                for trans in translations:
                    print(f"  Language: {trans.language}")
                    print(f"  Title: {trans.title}")
                    
    except Exception as e:
        print(f"Error: {str(e)}")
        raise

if __name__ == "__main__":
    check_weeks() 