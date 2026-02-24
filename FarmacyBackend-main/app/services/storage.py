from app.core.logger import logger
from supabase import create_client, Client
from fastapi import UploadFile
import os,io
import calendar
import time
from app.core.config import settings
from typing import Tuple, Optional
from app.core.logger import logger



supabase = None

def init_supabase():
    global supabase
    try:
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            raise ValueError("Supabase URL and key must be configured")
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        # Test the connection by trying to access the storage
        supabase.storage.list_buckets()
        logger.info("Supabase client initialized successfully")
    except Exception as e:
        logger.error(f"Supabase initialization error: {str(e)}")
        raise

class StorageService:
    @staticmethod
    async def upload_image(user_id: int, image, image_bytes, folder: str = "predictions") -> str:
        """Upload image to Supabase storage under user's folder."""
        try:
            if not supabase:
                raise ValueError("Supabase client not initialized. Call init_supabase() first.")

            # Read image bytes
            if not image_bytes:
                raise ValueError("Uploaded image is empty.")
            logger.debug(f"Uploading file of size: {len(image_bytes)} bytes")

            # Generate unique filename
            timestamp = calendar.timegm(time.gmtime())
            file_ext = image.filename.split('.')[-1]
            file_path = f"{folder}/{user_id}/{timestamp}.{file_ext}"

            # Upload to Supabase
            response = supabase.storage.from_(settings.SUPABASE_BUCKET).upload(
                file_path, image_bytes, {"content-type": image.content_type}
            )

            if getattr(response, 'error', None):  # Safely check for error
                error_msg = f"Upload error: {getattr(response.error, 'message', 'Unknown error')}"
                logger.error(error_msg)
                return error_msg

            # Generate public URL
            image_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/{settings.SUPABASE_BUCKET}/{file_path}"
            logger.info(f"Image uploaded successfully: {image_url}")
            return image_url

        except Exception as e:
            error_msg = f"Failed to upload image: {str(e)}"
            logger.error(error_msg)
            return error_msg

    @staticmethod
    async def delete_image(file_path: str) -> bool:
        """Delete image from Supabase storage."""
        try:
            if not supabase:
                raise ValueError("Supabase client not initialized. Call init_supabase() first.")

            response = supabase.storage.from_(settings.SUPABASE_BUCKET).remove([file_path])
            if getattr(response, 'error', None):
                raise Exception(f"Delete error: {getattr(response.error, 'message', 'Unknown error')}")
            return True
        except Exception as e:
            error_msg = f"Failed to delete image: {str(e)}"
            logger.error(error_msg)
            raise Exception(error_msg)

    @staticmethod
    async def get_image_url(file_path: str) -> str:
        """Get public URL for an image."""
        if not supabase:
            raise ValueError("Supabase client not initialized. Call init_supabase() first.")
        return f"{settings.SUPABASE_URL}/storage/v1/object/public/{settings.SUPABASE_BUCKET}/{file_path}"


storage_service = StorageService()