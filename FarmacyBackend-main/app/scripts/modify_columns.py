from sqlalchemy import create_engine, text
from app.core.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def modify_columns():
    try:
        # Create engine
        engine = create_engine(settings.DATABASE_URL)
        
        # SQL commands to modify columns
        sql_commands = [
            """
            ALTER TABLE disease_prediction_history 
            ALTER COLUMN crop_name DROP NOT NULL;
            """,
            """
            ALTER TABLE disease_prediction_history 
            ALTER COLUMN query DROP NOT NULL;
            """
        ]
        
        # Execute each command
        with engine.connect() as connection:
            for sql in sql_commands:
                connection.execute(text(sql))
                connection.commit()
                logger.info(f"Successfully executed: {sql}")
                
        logger.info("Successfully modified columns")
        
    except Exception as e:
        logger.error(f"Error modifying columns: {str(e)}")
        raise

if __name__ == "__main__":
    modify_columns() 