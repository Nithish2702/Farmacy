# Run cmd: python -m app.main
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
import firebase_admin
from firebase_admin import messaging, credentials
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from datetime import datetime

from app.redis_client import clear_all_cache, init_redis
from app.core.config import settings
from app.database import init_db, engine, Base
from app.routes import auth_router, news_route, crop_routes, user_personalization, notification, firebase_auth_router, otp_router
from app.services.scheduler import notification_scheduler
from app.services.storage import init_supabase
from app.core.logger import logger

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize services
    try:
        cred_path = Path(settings.FIREBASE_CREDENTIALS_PATH)
        if not cred_path.exists():
            raise FileNotFoundError(
                f"Firebase credentials file not found at {cred_path}")
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        try:
            # Try to get the Firebase app to verify initialization
            app_instance = firebase_admin.get_app()
            logger.info(f"Firebase app instance created: {app_instance.name}")
        except Exception as test_error:
            logger.error(f"Firebase initialization test failed: {str(test_error)}")
            raise
        logger.info("Firebase Admin SDK initialized successfully")
    except (ValueError, FileNotFoundError) as e:
        logger.error(f"Firebase initialization error: {str(e)}")
        raise
    
    try:
        # Initialize database
        init_db()
        from app.database import engine, Base
        if engine is None:
            raise RuntimeError("Database engine not initialized")
        Base.metadata.create_all(bind=engine)  # Create database tables
        
        # Initialize other services
        init_redis()
        clear_all_cache()
        logger.info("Cleared Entire redis Cache...")
        init_supabase()
        # init_translate()
        
        # Initialize and start scheduler
        await notification_scheduler.start()
        logger.info("Notification scheduler initialized and started")
    except Exception as e:
        logger.error(f"Service initialization error: {str(e)}")
        raise

    yield

    # Shutdown logic
    try:
        # Shutdown scheduler first
        await notification_scheduler.stop()
        logger.info("Notification scheduler shut down")

        # Shutdown other services
        if firebase_admin._apps:
            firebase_admin.delete_app(firebase_admin.get_app())
            logger.info("Firebase Admin SDK shut down")
        
        if engine:
            engine.dispose()
            logger.info("Database engine disposed")
        
        from app.redis_client import redis_client
        if redis_client:
            redis_client.close()
            logger.info("Redis client closed")
        
        logger.info("Application shutdown complete")
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")
        raise

app = FastAPI(
    title="Farmacy",
    # version=settings.VERSION,
    # description=settings.DESCRIPTION,
    lifespan=lifespan
)

# Configure CORS with more permissive settings for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
    expose_headers=["*"],  # Expose all headers
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Include routers
app.include_router(auth_router.router)
app.include_router(firebase_auth_router.router)
app.include_router(otp_router.router)
app.include_router(news_route.router)
app.include_router(crop_routes.router)
app.include_router(user_personalization.router)
app.include_router(notification.router)

@app.get("/")
def home():
    return {"message": "Welcome to Farmacy API"}

@app.get("/health")
def health_check():
    """Health check endpoint for testing connectivity"""
    return {
        "status": "healthy",
        "message": "Farmacy API is running",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

# Run the application
async def root():
    """Root endpoint that returns API information"""
    return {
        "message": "Welcome to Farmacy API",
        "version": "1.0.0",
        "available_routes": {
            "auth": "/auth",
            "news": "/news",
            "crops": "/crops",
            "user": "/user"
        }
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=settings.PORT)
