from sqlalchemy.orm import Session
from app.database import SessionLocal, init_db, safe_session
from app.services.storage import storage_service
from app.models.user_personalization import DiseasePredictionHistory
from app.core.logger import logger

async def save_prediction_to_db(user_id, image, image_bytes, crop_name: str, prediction_result):
    try:
        db: Session = safe_session()
        # Upload image to storage (await the coroutine)
        image_url = await storage_service.upload_image(user_id, image, image_bytes)

        # Save prediction history
        history = DiseasePredictionHistory(
            user_id=user_id,
            prediction_id=prediction_result["prediction_id"],
            crop_name=crop_name,
            query=prediction_result["query"],
            image_url=image_url,
            prediction_result=prediction_result
        )
        db.add(history)
        db.commit()
        logger.info(
            f"Disease prediction completed: {prediction_result['prediction_id']} - {prediction_result['status']}")

    except Exception as storage_error:
        logger.error(f"Storage error: {str(storage_error)}")
        # Save prediction without image URL
        history = DiseasePredictionHistory(
            user_id=user_id,
            prediction_id=prediction_result["prediction_id"],
            crop_name=crop_name,
            query=prediction_result["query"],
            image_url=None,
            prediction_result=prediction_result
        )
        db.add(history)
        db.commit()