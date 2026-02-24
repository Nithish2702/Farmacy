from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile, Form, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from app.dependencies.auth import get_current_user
from app.database import get_db
from app.models.crop import Crop, CropTranslation, Week, WeekTranslation, CropStage, CropStageTranslation
from app.models.disease import Disease, DiseaseTranslation, CropDisease
from app.schemas.crop import (
    CropResponse,
    DiseaseListResponse,
    WeekResponse,
    StageResponse,
    DiseaseResponse,
    CropListResponse,
)
from app.core.cache import cache_response, clear_related_caches, CROP_CACHE_PATTERNS
from datetime import datetime

router = APIRouter(prefix="/crops", tags=["crops"])

@router.get("/", response_model=List[CropListResponse])
@cache_response(ttl=3600, key_prefix="crops")  # Cache for 1 hour
async def get_all_crops(
    request: Request,
    lang: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get list of all crops with pagination"""
    if lang is None:
        lang = current_user.preferred_language
        
    crops = db.query(Crop).offset(skip).limit(limit).all()
    if not crops:
        raise HTTPException(status_code=404, detail="No crops found")

    result = []
    for crop in crops:
        translation = db.query(CropTranslation).filter(
            CropTranslation.crop_id == crop.id,
            CropTranslation.language == lang
        ).first()

        if translation:
            result.append({
                "id": crop.id,
                "code": crop.code,
                "name": translation.name,
                "image_urls": crop.image_urls,
                "cultivated_in": translation.cultivated_in,
                "variety": translation.variety,
                "description": translation.description,
                "cultivation_overview": translation.cultivation_overview
            })

    return result


@router.get("/id/{crop_id}", response_model=CropResponse)
@cache_response(ttl=3600, key_prefix="crops")  # Cache for 1 hour
async def get_crop_by_id(
    request: Request,
    crop_id: int,
    lang: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get crop details by ID with specified language"""
    if lang is None:
        lang = current_user.preferred_language
        
    crop = db.query(Crop).filter(Crop.id == crop_id).first()
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")

    translation = db.query(CropTranslation).filter(
        CropTranslation.crop_id == crop_id,
        CropTranslation.language == lang
    ).first()

    if not translation:
        raise HTTPException(
            status_code=404, detail=f"Translation not found for language: {lang}")

    return {
        "id": crop.id,
        "code": crop.code,
        "name": translation.name,
        "cultivated_in": translation.cultivated_in,
        "variety": translation.variety,
        "description": translation.description,
        "cultivation_overview": translation.cultivation_overview,
        "image_urls": crop.image_urls
    }


@router.get("/{crop_id}/weeks", response_model=List[WeekResponse])
@cache_response(ttl=3600, key_prefix="crops")  # Cache for 1 hour
async def get_crop_weeks(
    request: Request,
    crop_id: int,
    lang: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all weeks data for a crop with specified language"""
    # Language is now mandatory for this endpoint
        
    weeks = db.query(Week).filter(
        Week.crop_id == crop_id).order_by(Week.week_number).all()
    if not weeks:
        raise HTTPException(
            status_code=404, detail="No weeks found for this crop")

    result = []
    for week in weeks:
        translation = db.query(WeekTranslation).filter(
            WeekTranslation.week_id == week.id,
            WeekTranslation.language == lang
        ).first()

        if not translation:
            raise HTTPException(
                status_code=404, detail=f"Translation not found for language: {lang} in week {week.week_number}")

        result.append({
            "week_number": week.week_number,
            "title": translation.title,
            "day_range": translation.day_range,
            "days": translation.days,
            "image_urls": week.image_urls,
            "video_urls": week.video_urls,
            "stage_id": week.stage_id
        })

    return result

@router.get("/{crop_id}/weeks/{week_number}", response_model=WeekResponse)
@cache_response(ttl=3600, key_prefix="crops")  # Cache for 1 hour
async def get_crop_week(
    request: Request,
    crop_id: int,
    week_number: int,
    lang: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get specific week data for a crop with specified language"""
    # Language is now mandatory for this endpoint
        
    week = db.query(Week).filter(
        Week.crop_id == crop_id,
        Week.week_number == week_number
    ).first()

    if not week:
        raise HTTPException(status_code=404, detail="Week not found")

    translation = db.query(WeekTranslation).filter(
        WeekTranslation.week_id == week.id,
        WeekTranslation.language == lang
    ).first()

    if not translation:
        raise HTTPException(
            status_code=404, detail=f"Translation not found for language: {lang}")

    return {
        "week_number": week.week_number,
        "title": translation.title,
        "day_range": translation.day_range,
        "days": translation.days,
        "image_urls": week.image_urls,
        "video_urls": week.video_urls,
        "stage_id": week.stage_id
    }


@router.get("/{crop_id}/stages", response_model=List[StageResponse])
@cache_response(ttl=3600, key_prefix="crops")  # Cache for 1 hour
async def get_crop_stages(
    request: Request,
    crop_id: int,
    lang: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all stages with their associated weeks for a crop with specified language"""
    # Language is now mandatory for this endpoint
        
    stages = db.query(CropStage).filter(CropStage.crop_id == crop_id).order_by(CropStage.stage_number).all()
    if not stages:
        raise HTTPException(
            status_code=404, detail="No stages found for this crop")

    result = []
    for stage in stages:
        translation = db.query(CropStageTranslation).filter(
            CropStageTranslation.stage_id == stage.id,
            CropStageTranslation.language == lang
        ).first()

        if not translation:
            raise HTTPException(
                status_code=404, detail=f"Translation not found for language: {lang} in stage {stage.stage_number}")

        result.append({
            "stage_number": stage.stage_number,
            "title": translation.title,
            "description": translation.description,
            "image_urls": stage.image_urls,
            "weeks": None
        })

    return result


@router.get("/{crop_id}/stages/{stage_number}", response_model=StageResponse)
@cache_response(ttl=3600, key_prefix="crops")  # Cache for 1 hour
async def get_crop_stage(
    request: Request,
    crop_id: int,
    stage_number: int,
    lang: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get specific stage data for a crop with specified language"""
    # Language is now mandatory for this endpoint
        
    stage = db.query(CropStage).filter(
        CropStage.crop_id == crop_id,
        CropStage.stage_number == stage_number
    ).first()

    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")

    translation = db.query(CropStageTranslation).filter(
        CropStageTranslation.stage_id == stage.id,
        CropStageTranslation.language == lang
    ).first()

    if not translation:
        raise HTTPException(
            status_code=404, detail=f"Translation not found for language: {lang}")

    return {
        "stage_number": stage.stage_number,
        "title": translation.title,
        "description": translation.description,
        "image_urls": stage.image_urls
    }


@router.get("/{crop_id}/stages-with-weeks", response_model=List[StageResponse])
@cache_response(ttl=3600, key_prefix="crops")  # Cache for 1 hour
async def get_stages_with_weeks(
    request: Request,
    crop_id: int,
    lang: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all stages with their associated weeks for a crop with specified language"""
    if lang is None:
        lang = current_user.preferred_language
        
    stages = db.query(CropStage).filter(CropStage.crop_id == crop_id).order_by(CropStage.stage_number).all()
    if not stages:
        raise HTTPException(
            status_code=404, detail="No stages found for this crop")

    result = []
    for stage in stages:
        translation = db.query(CropStageTranslation).filter(
            CropStageTranslation.stage_id == stage.id,
            CropStageTranslation.language == lang
        ).first()

        if not translation:
            raise HTTPException(
                status_code=404, detail=f"Translation not found for language: {lang} in stage {stage.stage_number}")

        # Get weeks for this stage
        weeks = db.query(Week).filter(
            Week.stage_id == stage.id).order_by(Week.week_number).all()
        weeks_data = []

        for week in weeks:
            week_translation = db.query(WeekTranslation).filter(
                WeekTranslation.week_id == week.id,
                WeekTranslation.language == lang
            ).first()

            if not week_translation:
                raise HTTPException(
                    status_code=404, detail=f"Translation not found for language: {lang} in week {week.week_number}")

            weeks_data.append({
                "week_number": week.week_number,
                "title": week_translation.title,
                "day_range": week_translation.day_range,
                "days": week_translation.days,
                "image_urls": week.image_urls,
                "video_urls": week.video_urls
            })

        result.append({
            "stage_number": stage.stage_number,
            "title": translation.title,
            "description": translation.description,
            "image_urls": stage.image_urls,
            "weeks": weeks_data
        })

    return result


@router.get("/{crop_id}/weeks-with-stages", response_model=List[WeekResponse])
@cache_response(ttl=3600, key_prefix="crops")  # Cache for 1 hour
async def get_weeks_with_stages(
    request: Request,
    crop_id: int,
    lang: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all weeks with their associated stage data for a crop"""
    if lang is None:
        lang = current_user.preferred_language
        
    weeks = db.query(Week).filter(
        Week.crop_id == crop_id).order_by(Week.week_number).all()
    if not weeks:
        raise HTTPException(
            status_code=404, detail="No weeks found for this crop")

    result = []
    for week in weeks:
        week_translation = db.query(WeekTranslation).filter(
            WeekTranslation.week_id == week.id,
            WeekTranslation.language == lang
        ).first()

        if not week_translation:
            raise HTTPException(
                status_code=404, detail=f"Translation not found for language: {lang} in week {week.week_number}")

        if week.stage_id:
            stage = db.query(CropStage).filter(
                CropStage.id == week.stage_id).first()
            stage_translation = db.query(CropStageTranslation).filter(
                CropStageTranslation.stage_id == stage.id,
                CropStageTranslation.language == lang
            ).first() if stage else None

            if not stage_translation:
                raise HTTPException(
                    status_code=404, detail=f"Translation not found for language: {lang} in stage {stage.stage_number}")

            result.append({
                "week_number": week.week_number,
                "title": week_translation.title,
                "day_range": week_translation.day_range,
                "days": week_translation.days,
                "image_urls": week.image_urls,
                "video_urls": week.video_urls,
                "stage_id": week.stage_id,
                "stage": {
                    "stage_number": stage.stage_number,
                    "title": stage_translation.title,
                    "description": stage_translation.description,
                    "image_urls": stage.image_urls
                }
            })

    return result


@router.get("/{crop_id}/stages/{stage_number}/diseases", response_model=List[DiseaseResponse])
@cache_response(ttl=3600, key_prefix="crops")  # Cache for 1 hour
async def get_stage_diseases(
    request: Request,
    crop_id: int,
    stage_number: int,
    lang: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all diseases for a specific stage of a crop"""
    if lang is None:
        lang = current_user.preferred_language
        
    stage = db.query(CropStage).filter(
        CropStage.crop_id == crop_id,
        CropStage.stage_number == stage_number
    ).first()

    crop = db.query(Crop).filter(Crop.id == crop_id).first()

    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")

    crop_diseases = db.query(CropDisease).filter(
        CropDisease.stage_id == stage.id,
        CropDisease.crop_code == crop.code
    ).all()

    result = []
    for cd in crop_diseases:
        disease = db.query(Disease).filter(Disease.id == cd.disease_id).first()
        translation = db.query(DiseaseTranslation).filter(
            DiseaseTranslation.disease_id == disease.id,
            DiseaseTranslation.language == lang
        ).first()

        if disease and translation:
            result.append({
                "id": disease.id,
                "name": translation.name,
                "type": translation.type,
                "description": translation.description,
                "image_urls": disease.image_urls
            })

    return result
 

@router.get("/{crop_id}/weeks/{week_number}/diseases", response_model=List[DiseaseResponse])
@cache_response(ttl=3600, key_prefix="crops")  # Cache for 1 hour
async def get_week_diseases(
    request: Request,
    crop_id: int,
    week_number: int,
    lang: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all diseases for a specific week of a crop using stage mapping"""
    if lang is None:
        lang = current_user.preferred_language
        
    week = db.query(Week).filter(
        Week.crop_id == crop_id,
        Week.week_number == week_number
    ).first()

    if not week:
        raise HTTPException(status_code=404, detail="Week not found")

    if not week.stage_id:
        raise HTTPException(
            status_code=404, detail="Week is not associated with any stage")

    crop_diseases = db.query(CropDisease).filter(
        CropDisease.stage_id == week.stage_id
    ).all()

    result = []
    for cd in crop_diseases:
        disease = db.query(Disease).filter(Disease.id == cd.disease_id).first()
        translation = db.query(DiseaseTranslation).filter(
            DiseaseTranslation.disease_id == disease.id,
            DiseaseTranslation.language == lang
        ).first()

        if disease and translation:
            result.append({
                "id": disease.id,
                "name": translation.name,
                "type": translation.type,
                "description": translation.description,
                "image_urls": disease.image_urls
            })

    return result

@router.get("/{crop_id}/diseases-by-stage")
@cache_response(ttl=3600, key_prefix="crops")  # Cache for 1 hour
async def get_crop_diseases_by_stage(
    request: Request,
    crop_id: int,
    lang: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all diseases for all stages of a crop in a single API call"""
    if lang is None:
        lang = current_user.preferred_language
        
    # Get crop details
    crop = db.query(Crop).filter(Crop.id == crop_id).first()
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")

    # Get all stages for this crop
    stages = db.query(CropStage).filter(
        CropStage.crop_id == crop_id
    ).order_by(CropStage.stage_number).all()

    if not stages:
        raise HTTPException(status_code=404, detail="No stages found for this crop")

    result = {
        "crop_id": crop_id,
        "crop_name": crop.name,
        "stages": []
    }

    for stage in stages:
        # Get stage translation
        stage_translation = db.query(CropStageTranslation).filter(
            CropStageTranslation.stage_id == stage.id,
            CropStageTranslation.language == lang
        ).first()

        if not stage_translation:
            continue

        # Get diseases for this stage
        crop_diseases = db.query(CropDisease).filter(
            CropDisease.stage_id == stage.id,
            CropDisease.crop_code == crop.code
        ).all()

        stage_diseases = []
        for cd in crop_diseases:
            disease = db.query(Disease).filter(Disease.id == cd.disease_id).first()
            disease_translation = db.query(DiseaseTranslation).filter(
                DiseaseTranslation.disease_id == disease.id,
                DiseaseTranslation.language == lang
            ).first()

            if disease and disease_translation:
                stage_diseases.append({
                    "id": disease.id,
                    "name": disease_translation.name,
                    "type": disease_translation.type,
                    "description": disease_translation.description,
                    "image_urls": disease.image_urls
                })

        result["stages"].append({
            "stage_number": stage.stage_number,
            "stage_title": stage_translation.title,
            "diseases": stage_diseases
        })

    return result

@router.get("/diseases/{disease_id}", response_model=DiseaseResponse)
@cache_response(ttl=3600, key_prefix="crops")  # Cache for 1 hour
async def get_disease_by_Id(
    request: Request,
    disease_id: int,
    lang: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get disease details by ID with specified language"""
    if lang is None:
        lang = current_user.preferred_language
        
    disease = db.query(Disease).filter(Disease.id == disease_id).first()
    if not disease:
        raise HTTPException(status_code=404, detail="Disease not found")

    translation = db.query(DiseaseTranslation).filter(
        DiseaseTranslation.disease_id == disease.id,
        DiseaseTranslation.language == lang
    ).first()

    if not translation:
        raise HTTPException(
            status_code=404, detail=f"Translation not found for language: {lang}")

    return DiseaseResponse(
        id=disease.id,
        name=translation.name,
        type=translation.type,
        description=translation.description,
        image_urls=disease.image_urls
    )
@router.get("/diseases", response_model=DiseaseListResponse)
@cache_response(ttl=3600, key_prefix="crops")  # Cache for 1 hour
async def get_diseases(
    request: Request,
    lang: Optional[str] = None,
    crop_id: Optional[int] = None,
    stage_number: Optional[int] = None,
    disease_type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get diseases with filtering and pagination"""
    if lang is None:
        lang = current_user.preferred_language
        
    query = db.query(Disease)

    if crop_id is not None and not isinstance(crop_id, int):
        raise HTTPException(
            status_code=400, detail="crop_id must be an integer")

    if crop_id:
        crop = db.query(Crop).filter(Crop.id == crop_id).first()
        if not crop:
            raise HTTPException(status_code=404, detail="Crop not found")

        query = query.join(CropDisease).filter(
            CropDisease.crop_code == crop.code)

        if stage_number:
            stage = db.query(CropStage).filter(
                CropStage.crop_id == crop_id,
                CropStage.stage_number == stage_number
            ).first()
            if not stage:
                raise HTTPException(status_code=404, detail="Stage not found")
            query = query.filter(CropDisease.stage_id == stage.id)

    if disease_type:
        query = query.join(DiseaseTranslation).filter(
            DiseaseTranslation.language == lang,
            DiseaseTranslation.type == disease_type
        )

    total = query.count()
    diseases = query.order_by(Disease.id).offset(skip).limit(limit).all()
    if not diseases:
        raise HTTPException(status_code=404, detail="No diseases found")

    result = []
    for disease in diseases:
        translation = db.query(DiseaseTranslation).filter(
            DiseaseTranslation.disease_id == disease.id,
            DiseaseTranslation.language == lang
        ).first()

        if translation:
            result.append({
                "id": disease.id,
                "name": translation.name,
                "type": translation.type,
                "description": translation.description,
                "image_urls": disease.image_urls
            })

    hasMore = skip + limit < total

    return DiseaseListResponse(
        total=total,
        hasMore=hasMore,
        diseases=result
    )

@router.get("/{crop_code}/week-translations", response_model=List[WeekResponse])
def get_week_translations(
    crop_code: str,
    lang: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get all week translations for a specific crop"""
    if lang is None:
        lang = current_user.preferred_language
        
    # First get the crop
    crop = db.query(Crop).filter(Crop.code == crop_code).first()
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")

    # Get all weeks for this crop with their translations
    weeks = db.query(Week).filter(Week.crop_id == crop.id).order_by(Week.week_number).all()
    
    if not weeks:
        raise HTTPException(status_code=404, detail="No weeks found for this crop")

    result = []
    for week in weeks:
        # Get translation for the specified language
        translation = db.query(WeekTranslation).filter(
            WeekTranslation.week_id == week.id,
            WeekTranslation.language == lang
        ).first()

        if translation:
            result.append({
                "week_number": week.week_number,
                "title": translation.title,
                "day_range": translation.day_range,
                "days": translation.days,
                "image_urls": week.image_urls,
                "video_urls": week.video_urls,
                "stage_id": week.stage_id
            })

    return result