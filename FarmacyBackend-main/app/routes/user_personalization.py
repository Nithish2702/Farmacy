from app.queries.save_prediction_to_db import save_prediction_to_db
from app.core.config import settings
import base64
import groq
from app.services.storage import storage_service
from app.core.logger import logger
import json
import os
import io
from PIL import Image
import google.generativeai as genai
from app.core.cache import cache_response, clear_related_caches, CROP_CACHE_PATTERNS
from app.models.user import User
from app.dependencies.auth import get_current_user
import requests
import httpx
from app.schemas.user_personalization import (
    DiseasePredictionResponse,
    DiseasePredictionHistoryResponse,
    LocationDetails,
    UserCropTrackingCreate,
    UserCropTrackingResponse,
    DailyCropUpdate,
    HourlyForecast,
    DailyForecast,
    WeatherForecast
)
import uuid
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, File, UploadFile, Form, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime, timedelta
from app.database import get_db
from app.models.user_personalization import DiseasePredictionHistory, UserCropTracking
from app.models.crop import Crop, Week, WeekTranslation
import asyncio

FORECAST_INTERVAL_HOURS = 3


def is_valid_image(image_file):
    try:
        # Check if file is an image
        image = Image.open(image_file)
        image.verify()
        return True
    except:
        return False


def encode_image_to_base64(image_file):
    # Read the image file
    image = Image.open(image_file)
    # Convert to bytes
    buffered = io.BytesIO()
    image.save(buffered, format="JPEG")
    # Encode to base64
    return base64.b64encode(buffered.getvalue()).decode()


# Configure Gemini API
genai.configure(api_key=settings.GEMINI_API_KEY)

router = APIRouter(prefix="/user", tags=["user_personalization"])


@router.post("/predict-disease", response_model=DiseasePredictionResponse)
@clear_related_caches(patterns=[
    CROP_CACHE_PATTERNS["prediction_history"],
])
async def predict_crop_disease(
    background_tasks: BackgroundTasks,
    crop_name: Optional[str] = Form(None),
    image: UploadFile = File(...),
    lang: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Predict crop disease based on image using Gemini AI.
    """
    try:
        # Read and process the image
        contents = await image.read()
        pil_image = Image.open(io.BytesIO(contents))

        # Initialize Gemini model
        model = genai.GenerativeModel(settings.GEMINI_MODEL)

        # Modify prompt based on whether crop_name is provided
        crop_context = f"this {crop_name}" if crop_name else "this plant"
        prompt = f"""You are an expert agricultural advisor helping farmers identify plant diseases. Analyze {crop_context} image carefully.

        First, identify the crop type from the image if not specified. Then analyze for diseases.

        Respond in {lang} language using simple, farmer-friendly terms.

        Keep responses concise but informative. Limit arrays to maximum 2-4 items each.

        Required JSON format (respond with ONLY the raw JSON, no markdown formatting):
        {{
            "status": "HEALTHY" or "DISEASED" or "UNKNOWN",
            "crop_name": "identified crop name from image",
            "primary_disease": {{
                "name": "main disease name",
                "confidence": 0.0 to 1.0,
                "symptoms": ["symptom1", "symptom2", "symptom3"],
                "causes": ["cause1", "cause2"],
                "treatment": ["treatment1", "treatment2", "treatment3"],
                "fertilizer_recommendations": ["fertilizer1", "fertilizer2"],
                "prevention_tips": ["prevention1", "prevention2"]
            }},
            "other_possible_diseases": [
                {{
                    "name": "possible disease name",
                    "confidence": 0.0 to 1.0,
                    "symptoms": ["symptom1", "symptom2"],
                    "causes": ["cause1"],
                    "treatment": ["treatment1", "treatment2"],
                    "fertilizer_recommendations": ["fertilizer1"],
                    "prevention_tips": ["prevention1"]
                }}
            ],
            "overall_confidence_score": 0.0 to 1.0,
            "general_recommendations": [
                "general farming tip1",
                "general farming tip2",
                "general farming tip3"
            ],
            "analysis": "Overall analysis in simple {lang} language for farmers"
        }}

        Guidelines:
        1. Always identify the crop type from the image
        2. Keep each array to maximum 2-4 items for concise responses
        3. If DISEASED: Provide detailed information about the main disease
        4. If HEALTHY: Set status to HEALTHY, primary_disease to null, overall_confidence_score to 0.9+
        5. If image is unclear or not a plant: Set status to UNKNOWN  
        6. Use simple language that farmers can understand
        7. Provide practical, actionable advice
        8. Include specific fertilizer names and application methods
        9. Focus on cost-effective treatments available in India
        10. Include organic and chemical treatment options
        11. Respond ONLY with raw JSON, no markdown formatting"""

        # Generate response
        response = model.generate_content([prompt, pil_image])
        analysis_text = response.text

        try:
            # Clean the response text to remove any markdown formatting
            cleaned_text = analysis_text.replace(
                '```json', '').replace('```', '').strip()

            # Parse the JSON response
            prediction_result = json.loads(cleaned_text)

            # Add prediction ID and ensure crop_name is set
            prediction_result["prediction_id"] = f"pred_{uuid.uuid4().hex}"

            # Use crop_name from AI response if available, otherwise use provided crop_name
            if not prediction_result.get("crop_name") and crop_name:
                prediction_result["crop_name"] = crop_name

            # Set query based on crop identification
            identified_crop = prediction_result.get("crop_name", "plant")
            prediction_result["query"] = f"Analyze {identified_crop} health"

            # Validate and ensure proper structure
            if prediction_result.get("status") == "HEALTHY":
                prediction_result["primary_disease"] = None
                prediction_result["other_possible_diseases"] = []
            elif prediction_result.get("status") == "DISEASED":
                # Ensure primary_disease exists
                if not prediction_result.get("primary_disease"):
                    prediction_result["primary_disease"] = {
                        "name": "Unknown Disease",
                        "confidence": 0.5,
                        "symptoms": [],
                        "causes": [],
                        "treatment": [],
                        "fertilizer_recommendations": [],
                        "prevention_tips": []
                    }

                # Ensure other_possible_diseases is a list
                if not isinstance(prediction_result.get("other_possible_diseases"), list):
                    prediction_result["other_possible_diseases"] = []

            # Ensure required fields exist
            if not prediction_result.get("general_recommendations"):
                prediction_result["general_recommendations"] = []
            if not prediction_result.get("overall_confidence_score"):
                prediction_result["overall_confidence_score"] = 0.5

            logger.info(f"Prediction result: {prediction_result}")

            # save_prediction_to_db is now async; FastAPI will handle async background tasks
            background_tasks.add_task(
                save_prediction_to_db,
                user_id=current_user.id,
                image=image,
                image_bytes=contents,
                crop_name=crop_name,
                prediction_result=prediction_result
            )
            return prediction_result

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response: {str(e)}")
            logger.error(f"Raw response: {analysis_text}")
            raise HTTPException(
                status_code=500,
                detail="Failed to parse AI response. Please try again."
            )

    except Exception as e:
        logger.error(f"Error in predict_disease: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/prediction-history", response_model=List[DiseasePredictionHistoryResponse])
@cache_response(ttl=3600, key_prefix="user")  # Cache for 1 hour
async def get_prediction_history(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's disease prediction history"""
    predictions = db.query(DiseasePredictionHistory)\
        .filter(DiseasePredictionHistory.user_id == current_user.id)\
        .order_by(DiseasePredictionHistory.created_at.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()

    return [DiseasePredictionHistoryResponse.model_validate(prediction) for prediction in predictions]

@router.get("/prediction-history/{prediction_id}", response_model=DiseasePredictionHistoryResponse)
@cache_response(ttl=3600, key_prefix="user")  # Cache for 1 hour
async def get_prediction_history_by_id(
    request: Request,
    prediction_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's disease prediction history by ID"""
    prediction = db.query(DiseasePredictionHistory)\
        .filter(DiseasePredictionHistory.id == prediction_id, DiseasePredictionHistory.user_id == current_user.id)\
        .first()

    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")

    return DiseasePredictionHistoryResponse.model_validate(prediction)


@router.post("/chatbot")
async def chatbot(
    message: str = Form(...),
    language: str = Form(...)
):
    try:
        # Validate language parameter
        valid_languages = ['en', 'hi', 'te']
        if language not in valid_languages:
            logger.warning(f"Invalid language code received: {language}. Defaulting to 'en'")
            language = 'en'
        
        # Log the language parameter
        logger.info(f"Chatbot API called with language: {language}")
        
        # System prompt template with language specification
        system_prompt = f"""You are a specialized agricultural chatbot designed ONLY to assist farmers in the Telangana region of India with agriculture-related questions. You support the following crops: paddy (rice), cotton, chilli, corn, jowar, tomato, red gram, green gram, black gram, sugarcane, bhendi (okra), and mango.

IMPORTANT DOMAIN RESTRICTION:
You MUST ONLY answer questions related to agriculture, farming, crops, soil, fertilizers, pesticides, farming equipment, weather impacts on farming, and agricultural practices. 
For ANY question outside agriculture and farming, politely decline to answer and suggest asking an agriculture-related question instead.

IMPORTANT LANGUAGE INSTRUCTION: 
- If language code is 'hi': Respond ONLY in Hindi language (हिंदी में)
- If language code is 'te': Respond ONLY in Telugu language (తెలుగులో)
- If language code is 'en': Respond ONLY in English language

Current language code is: '{language}'
YOU MUST RESPOND IN {language.upper()} LANGUAGE ONLY. 
DO NOT respond in any other language than {language.upper()}.

Your main tasks are:

Crop Handholding : Provide a detailed day-by-day crop schedule from sowing to harvesting, based on the user's selected start date.

Plant Disease Detection : Help users identify crop diseases through uploaded images.

Fertilizer Estimation : Offer custom fertilizer recommendations based on the selected crop and field conditions.

If a user asks how to grow a crop or wants complete crop guidance, suggest the Crop Handholding feature.

If a user asks about fertilizer quantity, type, or timing, guide them to the Fertilizer Estimation tool.

If a user reports crop problems or disease symptoms, ask them to upload a photo and use the Plant Disease Detection feature.

Provide information on the supported crops: paddy (rice), cotton, chilli, corn, jowar, tomato, red gram, green gram, black gram, sugarcane, bhendi (okra), and mango. Always keep your responses focused on Telangana-specific conditions.

Use simple, friendly, and conversational language that is easy for local farmers to understand. Avoid technical jargon unless necessary, and keep your answers short, clear, and directly helpful.

STRICT CONTENT POLICY:
1. If asked about non-agricultural topics like politics, entertainment, sports, technology unrelated to farming, or any other non-farming topic, respond with: "I'm your farming assistant and can only answer questions related to agriculture and farming. Please ask me about crops, farming practices, or agricultural concerns."
2. If asked to generate content, stories, poems, or any creative writing unrelated to agriculture, politely decline.
3. If asked personal questions, questions about your creation, or philosophical questions, redirect to agriculture topics.
4. ONLY provide information that is directly relevant to agriculture and farming."""

        client = groq.Groq(api_key=settings.GROQ_API_KEY)
        
        # Log language for debugging
        logger.info(f"Preparing chatbot request with language: {language}")
        
        # Call Groq API with enhanced language instructions
        completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": f"""User Query: {message}

CRITICAL INSTRUCTIONS:
1. DOMAIN RESTRICTION: ONLY answer questions related to agriculture and farming. For any other topic, politely decline and redirect to farming topics.

2. LANGUAGE REQUIREMENT:
Your response MUST be EXCLUSIVELY in {language.upper()} language.
Current language code is '{language}':
- If '{language}' is 'hi': You MUST respond in Hindi language ONLY. हिंदी में जवाब दें।
- If '{language}' is 'te': You MUST respond in Telugu language ONLY. తెలుగులో సమాధానం ఇవ్వండి.
- If '{language}' is 'en': You MUST respond in English language ONLY."""
                }
            ],
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            temperature=1,
            max_tokens=500,
            top_p=1,
            stream=False
        )

        response = completion.choices[0].message.content
        
        # Log the response language
        logger.info(f"Chatbot responding with language: {language}")
        
        # Log language detection for debugging
        if language == 'hi' and any(word in response.lower() for word in ['తెలుగు', 'telugu']):
            logger.warning("Detected possible Telugu in Hindi response")

        return JSONResponse(content={
            "status": "success",
            "response": response,
            "language": language
        })

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )


@router.post("/get-fertilizer-recommendations")
async def get_fertilizer_recommendations(
    image: UploadFile = File(...),
    language: str = Form("en")
):
    try:
        # Reset file pointer to start
        await image.seek(0)

        # Validate if the uploaded file is an image
        if not is_valid_image(image.file):
            raise HTTPException(
                status_code=400,
                detail="Invalid image file. Please upload a valid image file."
            )

        # Reset file pointer after validation
        await image.seek(0)

        # Encode image to base64
        image_base64 = encode_image_to_base64(image.file)

        # Prepare the prompt for Groq
        prompt = f"""You are an expert in plant and crop analysis. Analyze this image carefully.
        First, determine if this is a plant or crop image. Look for:
        - Leaves, stems, or plant structures
        - Any signs of plant disease or health issues
        - Plant parts like flowers, fruits, or vegetables
        
        If you cannot identify any plant elements, respond with 'NOT_A_PLANT_IMAGE'.
        If the plant appears healthy with no signs of disease, respond with 'HEALTHY_PLANT'.
        
        For diseased plants, provide the following information in {language}:
        1. Plant/Crop identification
        2. Disease identification
        3. Recommended fertilizers
        4. Application rates
        5. Application timing
        6. Precautions
        7. Expected results
        
        Image: {image_base64}"""

        client = groq.Groq(api_key=settings.GROQ_API_KEY)

        completion = client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            temperature=0.7,
            max_tokens=1000
        )

        response = completion.choices[0].message.content

        # Check if the response indicates it's not a plant image
        if "NOT_A_PLANT_IMAGE" in response:
            raise HTTPException(
                status_code=400,
                detail="The uploaded image does not appear to be a plant/crop image. Please upload a valid plant/crop image."
            )

        # Check if the plant is healthy
        if "HEALTHY_PLANT" in response:
            raise HTTPException(
                status_code=400,
                detail="The plant appears to be healthy and does not require fertilizer treatment."
            )

        return JSONResponse(content={
            "status": "success",
            "response": response
        })

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error in get_fertilizer_recommendations: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )


@router.post("/crop-tracking", response_model=UserCropTrackingResponse)
@clear_related_caches(patterns=[
    "user:get_crop_tracking*",
    "user:get_daily_update*",
    "user:get_current_crop_tracking*"
])
async def start_crop_tracking(
    tracking: UserCropTrackingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Start tracking a new crop for the user"""
    # logger.log("Input: %s",tracking)
    # Verify crop exists
    crop = db.query(Crop).filter(Crop.id == tracking.crop_id).first()
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")

    # Check if user already has a tracking for this crop
    existing_tracker = db.query(UserCropTracking).filter(
        UserCropTracking.user_id == current_user.id,
        UserCropTracking.crop_id == tracking.crop_id
    ).first()

    if existing_tracker:
        existing_tracker.start_date = tracking.start_date
        new_tracking = existing_tracker
        # For existing tracking, we need to commit the changes first
        db.commit()
        db.refresh(new_tracking)
    else:
        # Create tracking entry
        new_tracking = UserCropTracking(
            user_id=current_user.id,
            crop_id=tracking.crop_id,
            start_date=tracking.start_date,
            notification_preferences=tracking.notification_preferences.model_dump(
            ) if tracking.notification_preferences else None
        )

    # Calculate current week
    days_since_start = (date.today() - tracking.start_date).days
    current_week = (days_since_start // 7) + 1

    # Find the last available week for this crop
    last_week_obj = db.query(Week)\
        .filter(Week.crop_id == tracking.crop_id)\
        .order_by(Week.week_number.desc())\
        .first()
    last_week_number = last_week_obj.week_number if last_week_obj else 1

    # If current_week exceeds last_week_number, set to last_week_number
    if current_week > last_week_number:
        current_week = last_week_number
        print("Exceeded Weeks: Setting End", last_week_number)

    new_tracking.current_week = current_week

    # First add and commit the tracking to get the ID
    db.add(new_tracking)
    db.commit()
    db.refresh(new_tracking)

    # Now set as current crop tracking after we have the ID
    current_user.current_crop_tracking_id = new_tracking.id
    db.commit()
    
    print(f"DEBUG: Set current_crop_tracking_id to {new_tracking.id} for user {current_user.id}")
    print(f"DEBUG: New tracking created with ID: {new_tracking.id}, crop_id: {new_tracking.crop_id}")
    
    # Verify the current tracking was set correctly
    db.refresh(current_user)
    print(f"DEBUG: Verified current_user.current_crop_tracking_id: {current_user.current_crop_tracking_id}")

    return new_tracking


@router.get("/crop-tracking", response_model=List[UserCropTrackingResponse])
@cache_response(ttl=3600, key_prefix="user")  # Cache for 1 hour
async def get_crop_tracking(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all crops being tracked by the user"""
    tracking = db.query(UserCropTracking)\
        .filter(UserCropTracking.user_id == current_user.id)\
        .all()

    return [UserCropTrackingResponse.model_validate(n) for n in tracking]


@router.get("/current-crop-tracking", response_model=Optional[UserCropTrackingResponse])
@cache_response(ttl=3600, key_prefix="user")  # Cache for 1 hour
async def get_current_crop_tracking(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the user's current crop tracking"""
    print(f"DEBUG: get_current_crop_tracking called for user {current_user.id}")
    print(f"DEBUG: current_user.current_crop_tracking_id: {current_user.current_crop_tracking_id}")
    
    if not current_user.current_crop_tracking_id:
        print(f"DEBUG: No current_crop_tracking_id set for user {current_user.id}")
        return None

    tracking = db.query(UserCropTracking)\
        .filter(UserCropTracking.id == current_user.current_crop_tracking_id)\
        .first()

    if not tracking:
        print(f"DEBUG: Tracking with ID {current_user.current_crop_tracking_id} not found for user {current_user.id}")
        return None

    print(f"DEBUG: Found current tracking: {tracking.id}, crop_id: {tracking.crop_id}")
    return UserCropTrackingResponse.model_validate(tracking)


@router.put("/current-crop-tracking", response_model=UserCropTrackingResponse)
@clear_related_caches(patterns=[
    "user:get_crop_tracking*",
    "user:get_daily_update*",
    "user:get_current_crop_tracking*"
])
async def set_current_crop_tracking(
    crop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Set the user's current crop tracking"""
    print(f"DEBUG: set_current_crop_tracking called for user {current_user.id}, crop_id: {crop_id}")
    
    tracking = db.query(UserCropTracking)\
        .filter(
            UserCropTracking.crop_id == crop_id,
            UserCropTracking.user_id == current_user.id
    )\
        .first()

    if not tracking:
        print(f"DEBUG: No tracking found for crop_id: {crop_id}, user_id: {current_user.id}")
        raise HTTPException(status_code=404, detail="Crop tracking not found")

    print(f"DEBUG: Found tracking: {tracking.id}, setting as current for user {current_user.id}")
    current_user.current_crop_tracking_id = tracking.id
    db.commit()
    db.refresh(tracking)
    
    print(f"DEBUG: Successfully set current_crop_tracking_id to {tracking.id} for user {current_user.id}")

    return UserCropTrackingResponse.model_validate(tracking)


@router.get("/daily-update", response_model=DailyCropUpdate)
@cache_response(ttl=3600, key_prefix="user")  # Cache for 1 hour
async def get_daily_update(
    request: Request,
    tracking_id: int = Query(...,
                             description="ID of the crop tracking to get daily update for"),
    lang: str = Query(
        "en", description="Language code (e.g., 'en', 'hi', 'te')"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get daily update for a tracked crop"""
    print(f"DEBUG: Daily update requested for tracking_id: {tracking_id}, user_id: {current_user.id}")
    
    tracking = db.query(UserCropTracking)\
        .filter(
            UserCropTracking.id == tracking_id,
            UserCropTracking.user_id == current_user.id
    ).first()

    if not tracking:
        print(f"DEBUG: Tracking not found for tracking_id: {tracking_id}")
        raise HTTPException(status_code=404, detail="Crop tracking not found")
    
    print(f"DEBUG: Found tracking: {tracking.id}, crop_id: {tracking.crop_id}, current_week: {tracking.current_week}")

    # Calculate current day and week
    days_since_start = (date.today() - tracking.start_date).days
    current_week = (days_since_start // 7) + 1
    print(f"DEBUG: Days since start: {days_since_start}, calculated current_week: {current_week}")

    # Find the last available week for this crop
    last_week_obj = db.query(Week)\
        .filter(Week.crop_id == tracking.crop_id)\
        .order_by(Week.week_number.desc())\
        .first()
    last_week_number = last_week_obj.week_number if last_week_obj else 1
    print(f"DEBUG: Last available week for crop {tracking.crop_id}: {last_week_number}")

    # If current_week exceeds last_week_number, set to last_week_number
    if current_week > last_week_number:
        current_week = last_week_number
        print(f"DEBUG: Exceeded Weeks: Setting End {last_week_number}")

    print(f"DEBUG: Final current_week: {current_week}")

    # Get week data
    week = db.query(Week)\
        .filter(
            Week.crop_id == tracking.crop_id,
            Week.week_number == current_week
    ).first()

    if not week:
        print(f"DEBUG: Week data not found for crop_id: {tracking.crop_id}, week_number: {current_week}")
        # List available weeks for this crop
        available_weeks = db.query(Week)\
            .filter(Week.crop_id == tracking.crop_id)\
            .order_by(Week.week_number)\
            .all()
        print(f"DEBUG: Available weeks for crop {tracking.crop_id}: {[w.week_number for w in available_weeks]}")
        logger.error("Error: Week Data not found")
        raise HTTPException(status_code=404, detail="Week data not found")
    
    print(f"DEBUG: Found week data: {week.id}, week_number: {week.week_number}")

    # Use provided language
    logger.info(f"Using language: {lang} for daily update")
    print(f"DEBUG: Looking for week translation for week_id: {week.id}, language: {lang}")

    week_translation = db.query(WeekTranslation)\
        .filter(
            WeekTranslation.week_id == week.id,
            WeekTranslation.language == lang
    ).first()

    if not week_translation:
        print(f"DEBUG: Week translation not found for week_id: {week.id}, language: {lang}")
        logger.error(f"Error: Week translation not found for language {lang}")
        # Try to fall back to English if translation is not available
        if lang != "en":
            logger.info("Trying to fall back to English translation")
            week_translation = db.query(WeekTranslation)\
                .filter(
                    WeekTranslation.week_id == week.id,
                    WeekTranslation.language == "en"
            ).first()

        if not week_translation:
            print(f"DEBUG: English translation also not found for week_id: {week.id}")
            # List available translations for this week
            available_translations = db.query(WeekTranslation)\
                .filter(WeekTranslation.week_id == week.id)\
                .all()
            print(f"DEBUG: Available translations for week {week.id}: {[t.language for t in available_translations]}")
            raise HTTPException(
                status_code=404, detail=f"Week translation not found for language {lang}")
    
    print(f"DEBUG: Found week translation: {week_translation.id}, language: {week_translation.language}")

    # Update tracking if week has changed
    if tracking.current_week != current_week:
        tracking.current_week = current_week
        tracking.last_notification_date = date.today()
        db.commit()

    # Calculate the day range for this week
    start_day = (current_week - 1) * 7 + 1
    end_day = start_day + 6

    # Get all days data for the week
    days_data = {}
    for day_num in range(start_day, end_day + 1):
        day_key = f"day_{day_num}"
        daily_data = week_translation.days.get(day_key, {})
        days_data[str(day_num)] = {
            "tasks": daily_data.get("tasks", []) or [],
            "notes": daily_data.get("notes", []) or [],
            "recommendations": daily_data.get("recommendations", []) or []
        }

    # logger.info(f"Week data: {days_data}")  # Add logging

    return {
        "tracking_id": tracking_id,
        "lang": lang,
        "week_number": current_week,
        "days": days_data,
        "title": week_translation.title,
        "alerts": [],  # TODO: Implement alerts
        "weather_info": {}  # TODO: Implement weather info
    }

@router.get("/forecast/coordinates", response_model=WeatherForecast)
@cache_response(ttl=1800, key_prefix="weather")  # Cache for 30 minutes
async def get_weather_forecast_by_coordinates(
    request: Request,
    lat: float = Query(...,
                       description="Latitude of the location", ge=-90, le=90),
    lon: float = Query(..., description="Longitude of the location",
                       ge=-180, le=180),
    current_user: User = Depends(get_current_user)
):
    """
    Get weather forecast and location details for specific coordinates (latitude and longitude)
    """
    try:
        API_KEY = settings.WEATHER_API_KEY
    except AttributeError:
        API_KEY = os.getenv("OPENWEATHER_API_KEY")

    if not API_KEY:
        logger.error("OpenWeather API key not configured")
        raise HTTPException(
            status_code=500,
            detail="Weather service configuration error. Please contact support."
        )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            forecast_url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={API_KEY}&units=metric"
            geo_url = f"http://api.openweathermap.org/geo/1.0/reverse?lat={lat}&lon={lon}&limit=1&appid={API_KEY}&lang={current_user.preferred_language}"

            forecast_response, geo_response = await asyncio.gather(
                client.get(forecast_url),
                client.get(geo_url)
            )

            forecast_response.raise_for_status()
            geo_response.raise_for_status()

            forecast_data = forecast_response.json()
            geo_data = geo_response.json()

            # logger.info("Forecast data: %s", forecast_data)
            # logger.info("Geo data: %s", geo_data)

            if not geo_data:
                location = LocationDetails(
                    name="Unknown",
                    country="Unknown",
                    state=None,
                    lat=lat,
                    lon=lon
                )
            else:
                location_data = geo_data[0]
                location = LocationDetails(
                    name=location_data.get("name", "Unknown"),
                    country=location_data.get("country", "Unknown"),
                    state=location_data.get("state"),
                    lat=lat,
                    lon=lon
                )

            daily_forecasts = {}

            for item in forecast_data["list"]:
                timestamp = datetime.fromtimestamp(item["dt"])
                date = timestamp.strftime("%Y-%m-%d")
                time = timestamp.strftime("%H:%M")
                hour = timestamp.hour
                temp = item["main"]["temp"]
                icon_id = item["weather"][0]["icon"]
                icon_url = f"https://openweathermap.org/img/wn/{icon_id}@2x.png"

                if date not in daily_forecasts:
                    daily_forecasts[date] = {
                        "temp_day": [],
                        "temp_night": [],
                        "humidity": [],
                        "wind_speed": [],
                        "pressure": [],  # Added pressure collection
                        "description": set(),
                        "hourly_data": [],
                        "icons": []  # Store icons for daily summary
                    }

                hourly_data = HourlyForecast(
                    time=time,
                    temperature=round(temp, 2),
                    humidity=item["main"]["humidity"],
                    wind_speed=round(item["wind"]["speed"], 2),
                    description=item["weather"][0]["description"],
                    feels_like=round(item["main"]["feels_like"], 2),
                    pressure=item["main"]["pressure"],  # Added pressure
                    icon_url=icon_url  # Added icon_url
                )
                daily_forecasts[date]["hourly_data"].append(hourly_data)
                daily_forecasts[date]["icons"].append(icon_id)

                if 6 <= hour < 18:
                    daily_forecasts[date]["temp_day"].append(temp)
                else:
                    daily_forecasts[date]["temp_night"].append(temp)

                daily_forecasts[date]["humidity"].append(
                    item["main"]["humidity"])
                daily_forecasts[date]["wind_speed"].append(
                    item["wind"]["speed"])
                daily_forecasts[date]["pressure"].append(
                    item["main"]["pressure"])  # Added pressure
                daily_forecasts[date]["description"].add(
                    item["weather"][0]["description"])

            formatted_forecasts = []
            for date, data in daily_forecasts.items():
                temp_day = data["temp_day"]
                temp_night = data["temp_night"]

                # Determine representative icon for the day (most frequent)
                most_common_icon = max(
                    set(data["icons"]), key=data["icons"].count) if data["icons"] else None
                daily_icon_url = f"https://openweathermap.org/img/wn/{most_common_icon}@2x.png" if most_common_icon else None

                formatted_forecasts.append(
                    DailyForecast(
                        date=date,
                        temperature={
                            "day": round(sum(temp_day) / len(temp_day), 2) if temp_day else None,
                            "night": round(sum(temp_night) / len(temp_night), 2) if temp_night else None,
                            "min": round(min(temp_day + temp_night), 2) if (temp_day + temp_night) else None,
                            "max": round(max(temp_day + temp_night), 2) if (temp_day + temp_night) else None
                        },
                        humidity=round(
                            sum(data["humidity"]) / len(data["humidity"]), 2),
                        wind_speed=round(
                            sum(data["wind_speed"]) / len(data["wind_speed"]), 2),
                        # Added pressure
                        pressure=round(
                            sum(data["pressure"]) / len(data["pressure"]), 2),
                        description=", ".join(data["description"]),
                        hourly_forecast=sorted(
                            data["hourly_data"], key=lambda x: x.time),
                        forecast_interval=f"{FORECAST_INTERVAL_HOURS}-hour intervals",
                        icon_url=daily_icon_url
                    )
                )

            formatted_forecasts.sort(key=lambda x: x.date)

            return WeatherForecast(
                coordinates={"lat": lat, "lon": lon},
                location=location,
                forecast_interval_hours=FORECAST_INTERVAL_HOURS,
                forecast=formatted_forecasts
            )

    except httpx.TimeoutException:
        logger.error(
            f"Timeout while fetching weather data for coordinates: lat={lat}, lon={lon}")
        raise HTTPException(
            status_code=504,
            detail="Weather service timeout. Please try again later."
        )
    except httpx.RequestError as e:
        logger.error(
            f"Error fetching weather data for coordinates lat={lat}, lon={lon}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Unable to fetch weather data. Please try again later."
        )
