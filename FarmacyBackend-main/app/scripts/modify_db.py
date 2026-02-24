import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
from dotenv import load_dotenv
import logging

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_connection_params():
    # Get database connection parameters from environment variables
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise ValueError("DATABASE_URL environment variable not set")
    
    # Parse the connection URL
    # Format: postgresql://user:password@host:port/dbname
    parts = db_url.split('@')
    if len(parts) != 2:
        raise ValueError("Invalid DATABASE_URL format")
    
    credentials = parts[0].split('://')[-1].split(':')
    host_port_db = parts[1].split('/')
    
    return {
        'user': credentials[0],
        'password': credentials[1],
        'host': host_port_db[0].split(':')[0],
        'port': int(host_port_db[0].split(':')[1]) if ':' in host_port_db[0] else 5432,
        'database': host_port_db[1]
    }

def modify_columns():
    try:
        # Get connection parameters
        params = get_connection_params()
        logger.info("Connecting to database...")
        
        # Connect to database
        conn = psycopg2.connect(**params)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        
        # Create cursor
        cur = conn.cursor()
        
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
        for sql in sql_commands:
            logger.info(f"Executing: {sql.strip()}")
            cur.execute(sql)
            logger.info("Command executed successfully")
        
        # Close cursor and connection
        cur.close()
        conn.close()
        
        logger.info("Successfully modified columns")
        
    except Exception as e:
        logger.error(f"Error modifying columns: {str(e)}")
        raise
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    modify_columns() 