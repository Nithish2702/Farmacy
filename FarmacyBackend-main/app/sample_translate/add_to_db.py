import sys
import os
from pathlib import Path

# Add the project root directory to Python path
project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import json
import urllib.parse
from app.core.logger import logger
from app.core.config import settings
from datetime import datetime, timezone
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError
from sqlalchemy import create_engine, NullPool
from typing import List, Dict, Any, Optional

# Import your models (adjust the import path as needed)
from app.models.crop import Crop, CropTranslation, CropStage, CropStageTranslation, Week, WeekTranslation
from app.models.disease import Disease, DiseaseTranslation, CropDisease

def create_db_session():
    """Create a new database session"""
    try:
        password = urllib.parse.quote_plus(settings.SUPABASE_PASSWORD)
        url = f"postgresql://postgres.nacafqowabfdrldyvjic:{password}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
        engine = create_engine(
            url,
            pool_pre_ping=True,
            poolclass=NullPool
        )
        logger.info("Creating database connection...")
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        return SessionLocal()
    except Exception as e:
        logger.error(f"Failed to create database session: {str(e)}")
        raise

class DatabaseManager:
    def __init__(self, session):
        self.session = session

    def add_or_update_crop(self, crop_data: Dict[str, Any]) -> Optional[int]:
        """Add or update crop and its translations"""
        try:
            # Check if crop exists
            existing_crop = self.session.query(Crop).filter(Crop.code == crop_data["code"]).first()
            
            if existing_crop:
                logger.info(f"Updating existing crop: {crop_data['code']}")
                # Update crop fields
                existing_crop.name = crop_data.get("name", existing_crop.name)
                existing_crop.image_urls = crop_data.get("image_urls", existing_crop.image_urls)
                existing_crop.updated_at = datetime.now(timezone.utc)
                crop = existing_crop
            else:
                logger.info(f"Creating new crop: {crop_data['code']}")
                crop = Crop(
                    code=crop_data["code"],
                    name=crop_data["name"],
                    image_urls=crop_data.get("image_urls", [])
                )
                self.session.add(crop)
                self.session.flush()  # Get the ID

            # Handle translations
            for translation_data in crop_data.get("translations", []):
                existing_translation = self.session.query(CropTranslation).filter(
                    CropTranslation.crop_id == crop.id,
                    CropTranslation.language == translation_data["language"]
                ).first()

                if existing_translation:
                    # Update existing translation
                    existing_translation.name = translation_data.get("name", existing_translation.name)
                    existing_translation.variety = translation_data.get("variety", existing_translation.variety)
                    existing_translation.description = translation_data.get("description", existing_translation.description)
                    existing_translation.cultivation_overview = translation_data.get("cultivation_overview", existing_translation.cultivation_overview)
                    existing_translation.cultivated_in = translation_data.get("cultivated_in", existing_translation.cultivated_in)
                    existing_translation.updated_at = datetime.now(timezone.utc)
                else:
                    # Create new translation
                    translation = CropTranslation(
                        crop_id=crop.id,
                        language=translation_data["language"],
                        name=translation_data.get("name"),
                        variety=translation_data.get("variety"),
                        description=translation_data.get("description"),
                        cultivation_overview=translation_data.get("cultivation_overview"),
                        cultivated_in=translation_data.get("cultivated_in")
                    )
                    self.session.add(translation)

            self.session.commit()
            logger.info(f"Successfully processed crop: {crop_data['code']}")
            return crop.id

        except Exception as e:
            self.session.rollback()
            logger.error(f"Error processing crop {crop_data.get('code', 'unknown')}: {str(e)}")
            return None

    def add_or_update_crop_stage(self, stage_data: Dict[str, Any]) -> Optional[int]:
        """Add or update crop stage and its translations"""
        try:
            # Get crop by code
            crop = self.session.query(Crop).filter(Crop.code == stage_data["crop_code"]).first()
            if not crop:
                logger.error(f"Crop not found for code: {stage_data['crop_code']}")
                return None

            # Check if stage exists
            existing_stage = self.session.query(CropStage).filter(
                CropStage.crop_id == crop.id,
                CropStage.stage_number == stage_data["stage_number"]
            ).first()

            if existing_stage:
                logger.info(f"Updating existing stage: {stage_data['crop_code']} - Stage {stage_data['stage_number']}")
                existing_stage.image_urls = stage_data.get("image_urls", existing_stage.image_urls)
                existing_stage.updated_at = datetime.now(timezone.utc)
                stage = existing_stage
            else:
                logger.info(f"Creating new stage: {stage_data['crop_code']} - Stage {stage_data['stage_number']}")
                stage = CropStage(
                    crop_id=crop.id,
                    stage_number=stage_data["stage_number"],
                    image_urls=stage_data.get("image_urls", [])
                )
                self.session.add(stage)
                self.session.flush()

            # Handle translations
            for translation_data in stage_data.get("translations", []):
                existing_translation = self.session.query(CropStageTranslation).filter(
                    CropStageTranslation.stage_id == stage.id,
                    CropStageTranslation.language == translation_data["language"]
                ).first()

                if existing_translation:
                    existing_translation.title = translation_data.get("title", existing_translation.title)
                    existing_translation.description = translation_data.get("description", existing_translation.description)
                    existing_translation.updated_at = datetime.now(timezone.utc)
                else:
                    translation = CropStageTranslation(
                        stage_id=stage.id,
                        language=translation_data["language"],
                        title=translation_data.get("title"),
                        description=translation_data.get("description")
                    )
                    self.session.add(translation)

            self.session.commit()
            logger.info(f"Successfully processed stage: {stage_data['crop_code']} - Stage {stage_data['stage_number']}")
            return stage.id

        except Exception as e:
            self.session.rollback()
            logger.error(f"Error processing stage {stage_data.get('crop_code', 'unknown')} - {stage_data.get('stage_number', 'unknown')}: {str(e)}")
            return None

    def add_or_update_crop_week(self, week_data: Dict[str, Any]) -> Optional[int]:
        """Add or update crop week and its translations"""
        try:
            # Get crop by code
            crop = self.session.query(Crop).filter(Crop.code == week_data["crop_code"]).first()
            if not crop:
                logger.error(f"Crop not found for code: {week_data['crop_code']}")
                return None

            # Get stage
            stage = self.session.query(CropStage).filter(
                CropStage.crop_id == crop.id,
                CropStage.stage_number == week_data["stage_number"]
            ).first()
            if not stage:
                logger.error(f"Stage not found for crop {week_data['crop_code']} - stage {week_data['stage_number']}")
                return None

            # Check if week exists
            existing_week = self.session.query(Week).filter(
                Week.crop_id == crop.id,
                Week.stage_id == stage.id,
                Week.week_number == int(week_data["week_number"])
            ).first()

            if existing_week:
                logger.info(f"Updating existing week: {week_data['crop_code']} - Week {week_data['week_number']}")
                existing_week.image_urls = week_data.get("image_urls", existing_week.image_urls)
                existing_week.video_urls = week_data.get("video_urls", existing_week.video_urls)
                existing_week.updated_at = datetime.now(timezone.utc)
                week = existing_week
            else:
                logger.info(f"Creating new week: {week_data['crop_code']} - Week {week_data['week_number']}")
                week = Week(
                    crop_id=crop.id,
                    stage_id=stage.id,
                    week_number=int(week_data["week_number"]),
                    image_urls=week_data.get("image_urls", []),
                    video_urls=week_data.get("video_urls", [])
                )
                self.session.add(week)
                self.session.flush()

            # Handle translations
            for translation_data in week_data.get("translations", []):
                existing_translation = self.session.query(WeekTranslation).filter(
                    WeekTranslation.week_id == week.id,
                    WeekTranslation.language == translation_data["language"]
                ).first()

                if existing_translation:
                    existing_translation.title = translation_data.get("title", existing_translation.title)
                    existing_translation.day_range = translation_data.get("day_range", existing_translation.day_range)
                    existing_translation.days = translation_data.get("days", existing_translation.days)
                    existing_translation.updated_at = datetime.now(timezone.utc)
                else:
                    translation = WeekTranslation(
                        week_id=week.id,
                        language=translation_data["language"],
                        title=translation_data.get("title"),
                        day_range=translation_data.get("day_range"),
                        days=translation_data.get("days")
                    )
                    self.session.add(translation)

            self.session.commit()
            logger.info(f"Successfully processed week: {week_data['crop_code']} - Week {week_data['week_number']}")
            return week.id

        except Exception as e:
            self.session.rollback()
            logger.error(f"Error processing week {week_data.get('crop_code', 'unknown')} - {week_data.get('week_number', 'unknown')}: {str(e)}")
            return None

    def add_or_update_disease(self, disease_data: Dict[str, Any]) -> Optional[int]:
        """Add or update disease and its translations"""
        try:
            # Check if disease exists
            existing_disease = self.session.query(Disease).filter(Disease.name == disease_data["name"]).first()

            if existing_disease:
                logger.info(f"Updating existing disease: {disease_data['name']}")
                existing_disease.image_urls = disease_data.get("image_urls", existing_disease.image_urls)
                existing_disease.updated_at = datetime.now(timezone.utc)
                disease = existing_disease
            else:
                logger.info(f"Creating new disease: {disease_data['name']}")
                disease = Disease(
                    name=disease_data["name"],
                    image_urls=disease_data.get("image_urls", [])
                )
                self.session.add(disease)
                self.session.flush()

            # Handle translations
            for translation_data in disease_data.get("translations", []):
                existing_translation = self.session.query(DiseaseTranslation).filter(
                    DiseaseTranslation.disease_id == disease.id,
                    DiseaseTranslation.language == translation_data["language"]
                ).first()

                if existing_translation:
                    existing_translation.name = translation_data.get("name", existing_translation.name)
                    existing_translation.type = translation_data.get("type", existing_translation.type)
                    existing_translation.description = translation_data.get("description", existing_translation.description)
                    existing_translation.updated_at = datetime.now(timezone.utc)
                else:
                    translation = DiseaseTranslation(
                        disease_id=disease.id,
                        language=translation_data["language"],
                        name=translation_data.get("name"),
                        type=translation_data.get("type"),
                        description=translation_data.get("description")
                    )
                    self.session.add(translation)

            self.session.commit()
            logger.info(f"Successfully processed disease: {disease_data['name']}")
            return disease.id

        except Exception as e:
            self.session.rollback()
            logger.error(f"Error processing disease {disease_data.get('name', 'unknown')}: {str(e)}")
            return None

    def add_or_update_crop_disease(self, crop_disease_entries: List[Dict[str, Any]]) -> bool:
        """Add or update crop-disease relationships based on crop name and store crop_code"""
        try:
            for entry in crop_disease_entries:
                crop_name = entry["crop_name"]

                # Get all crops with this name (could be multiple varieties)
                matching_crops = self.session.query(Crop).filter(Crop.name == crop_name).all()
                # print("Matching Crops: ",matching_crops)
                if not matching_crops:
                    logger.error(f"No crops found with name: {crop_name}")
                    continue

                # Get disease
                disease = self.session.query(Disease).filter(Disease.name == entry["name"]).first()
                if not disease:
                    logger.error(f"Disease not found: {entry['name']}")
                    continue

                # Loop through each crop (same name, different codes/varieties)
                for crop in matching_crops:
                    crop_code = crop.code

                    # Get stage (if provided)
                    stage = None
                    if entry.get("stage_number"):
                        stage = self.session.query(CropStage).filter(
                            CropStage.crop_id == crop.id,
                            CropStage.stage_number == entry["stage_number"]
                        ).first()

                    # Check if relationship exists already
                    existing_relation = self.session.query(CropDisease).filter(
                        CropDisease.crop_code == crop_code,  # Actually storing code, not name
                        CropDisease.disease_id == disease.id,
                        CropDisease.stage_id == (stage.id if stage else None)
                    ).first()

                    if not existing_relation:
                        logger.info(f"Creating crop-disease relationship: {crop_code} - {disease.name}")
                        crop_disease = CropDisease(
                            crop_code=crop_code,
                            disease_id=disease.id,
                            stage_id=stage.id if stage else None
                        )
                        self.session.add(crop_disease)
                    else:
                        logger.info(f"Crop-disease relationship already exists: {crop_code} - {disease.name}")
                        existing_relation.updated_at = datetime.now(timezone.utc)

            self.session.commit()
            logger.info("Successfully processed crop-disease relationships")
            return True

        except Exception as e:
            self.session.rollback()
            logger.error(f"Error processing crop-disease relationships: {str(e)}")
            return False

    def delete_orphaned_records(self):
        """Delete records that are no longer needed"""
        try:
            # Delete orphaned translations (where parent record doesn't exist)
            orphaned_crop_translations = self.session.query(CropTranslation).filter(
                ~CropTranslation.crop_id.in_(self.session.query(Crop.id))
            ).delete(synchronize_session=False)

            orphaned_stage_translations = self.session.query(CropStageTranslation).filter(
                ~CropStageTranslation.stage_id.in_(self.session.query(CropStage.id))
            ).delete(synchronize_session=False)

            orphaned_week_translations = self.session.query(WeekTranslation).filter(
                ~WeekTranslation.week_id.in_(self.session.query(Week.id))
            ).delete(synchronize_session=False)

            orphaned_disease_translations = self.session.query(DiseaseTranslation).filter(
                ~DiseaseTranslation.disease_id.in_(self.session.query(Disease.id))
            ).delete(synchronize_session=False)

            # Delete orphaned crop diseases
            orphaned_crop_diseases = self.session.query(CropDisease).filter(
                ~CropDisease.disease_id.in_(self.session.query(Disease.id))
            ).delete(synchronize_session=False)

            self.session.commit()
            
            logger.info(f"Deleted orphaned records:")
            logger.info(f"  - Crop translations: {orphaned_crop_translations}")
            logger.info(f"  - Stage translations: {orphaned_stage_translations}")
            logger.info(f"  - Week translations: {orphaned_week_translations}")
            logger.info(f"  - Disease translations: {orphaned_disease_translations}")
            logger.info(f"  - Crop diseases: {orphaned_crop_diseases}")

        except Exception as e:
            self.session.rollback()
            logger.error(f"Error deleting orphaned records: {str(e)}")

def load_json_file(file_path: str) -> List[Dict]:
    """Load JSON data from file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error(f"File not found: {file_path}")
        return []
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing JSON file {file_path}: {str(e)}")
        return []

def main():
    """Main function to process all data files"""
    
    # Get the current script's directory
    current_dir = Path(__file__).parent
    input_dir = current_dir / "db_cotton__inputs_final"
    
    if not input_dir.exists():
        logger.error(f"Input directory not found: {input_dir}")
        return

    try:
        # Create a new database session
        session = create_db_session()
        db_manager = DatabaseManager(session)
        
        # Process crops (needed for weeks)
        logger.info("Processing crops...")
        crops_data = load_json_file(str(input_dir / "crop_inputs.json"))
        for crop_data in crops_data:
            db_manager.add_or_update_crop(crop_data)

        # Process stages (needed for weeks)
        logger.info("Processing crop stages...")
        stages_data = load_json_file(str(input_dir / "stage_inputs.json"))
        for stage_data in stages_data:
            db_manager.add_or_update_crop_stage(stage_data)

        # Process weeks
        logger.info("Processing crop weeks...")
        weeks_data = load_json_file(str(input_dir / "week_inputs.json"))
        for week_data in weeks_data:
            db_manager.add_or_update_crop_week(week_data)

        # # Process diseases
        # logger.info("Processing diseases...")
        # diseases_data = load_json_file(str(input_dir / "disease_inputs.json"))
        # for disease_data in diseases_data:
        #     db_manager.add_or_update_disease(disease_data)

        # # Process crop-disease relationships
        # logger.info("Processing crop-disease relationships...")
        # crop_diseases_data = load_json_file(str(input_dir / "crop_disease_inputs.json"))
        
        # # Process each entry
        # for entry_list in crop_diseases_data:
        #     print(entry_list)
        #     db_manager.add_or_update_crop_disease(entry_list)
        
        # Clean up orphaned records
        logger.info("Cleaning up orphaned records...")
        db_manager.delete_orphaned_records()

        logger.info("Database operations completed successfully!")

    except Exception as e:
        logger.error(f"Error in main process: {str(e)}")
        raise
    finally:
        if 'session' in locals():
            session.close()

if __name__ == "__main__":
    main()