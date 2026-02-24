import sys
import os
from pathlib import Path

# Add the project root directory to Python path
project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import json
from app.core.logger import logger
import os
from app.sample_translate.translator import translate_text, translate_json_data, init_translate

# init_translate()

# Create Crop Input JSON
def create_crop_input(crop_data):
    if not all(key in crop_data for key in ["crop_name", "crop_variety", "crop_code", "cultivated_in", "cultivation_overview"]):
        raise ValueError("Missing required fields: crop_name, crop_variety, crop_code")
    logger.info("Creating crop input JSON")
    translations = []
    for lang in ["en", "te", "hi"]:
        logger.info(f"Translating crop data to {lang}")
        translation = {
            "language": lang,
            "name": crop_data["crop_name"] if lang == "en" else translate_text(crop_data["crop_name"], lang),
            "variety": crop_data["crop_variety"] if lang == "en" else translate_text(crop_data["crop_variety"], lang),
            "description": crop_data.get("crop_desc") if lang == "en" else translate_text(crop_data.get("crop_desc", ""), lang) if crop_data.get("crop_desc") else None,
            "cultivation_overview": crop_data.get("cultivation_overview") if lang == "en" else translate_text(crop_data.get("cultivation_overview", ""), lang) if crop_data.get("cultivation_overview") else None,
            "cultivated_in": crop_data.get("cultivated_in") if lang == "en" else translate_text(crop_data.get("cultivated_in", ""), lang) if crop_data.get("cultivated_in") else None,
        }
        translations.append(translation)

    input =  {
        "code": crop_data["crop_code"],
        "name": crop_data.get("crop_name"),
        "image_urls": crop_data.get("image_urls", []),
        "translations": translations
    }
    return input

# Create Week Input JSON
def create_week_input(crop_code, stage_number, week_data, week_number):
    if not all(key in week_data for key in ["title", "days"]):
        raise ValueError("Missing required fields: title, days")
    logger.info(f"Creating week input for crop_code: {crop_code}, week_number: {week_number}")
    translations = []
    for lang in ["en", "te", "hi"]:
        translated_days = week_data["days"] if lang == "en" else translate_json_data(week_data["days"], lang)
        logger.info(f"Translating week data to {lang}")
        translation = {
            "language": lang,
            "title": week_data["title"] if lang == "en" else translate_text(week_data["title"], lang),
            "day_range": week_data.get("day_range") if lang == "en" else translate_text(week_data.get("day_range", ""), lang) if week_data.get("day_range") else None,
            "days": translated_days
        }
        translations.append(translation)

    input = {
        "crop_code": crop_code,
        "stage_number": stage_number,
        "week_number": week_number,
        "image_urls": week_data.get("image_urls", []),
        "video_urls": week_data.get("video_urls", []),
        "translations": translations
    }
    return input

# Create CropStage Input JSON
def create_crop_stage_input(crop_code, stage_data):
    if not all(key in stage_data for key in ["title"]):
        raise ValueError("Missing required fields: title")
    logger.info(f"Creating crop stage input for crop_code: {crop_code}, stage_number: {stage_data.get('stage_number')}")

    translations = []
    for lang in ["en", "te", "hi"]:
        translated_description = stage_data["description"] if lang == "en" else translate_json_data(stage_data["description"], lang)
        logger.info(f"Translating stage data to {lang}")
        translation = {
            "language": lang,
            "title": stage_data["title"] if lang == "en" else translate_text(stage_data["title"], lang),
            "description": translated_description
        }
        translations.append(translation)
    input = {
        "crop_code": crop_code,
        "stage_number": stage_data["stage_number"],
        "image_urls": stage_data.get("image_urls", []),
        "translations": translations
    }
    return input

# Create Disease Input JSON
def create_disease_input(disease_data):
    if not "name" in disease_data:
        raise ValueError("Missing required field: name")
    logger.info(f"Creating disease input for name: {disease_data.get('name')}")
    translations = []
    for lang in ["en", "te", "hi"]:
        logger.info(f"Translating disease data to {lang}")
        translated_description = disease_data["description"] if lang == "en" else translate_json_data(disease_data["description"], lang)
        translation = {
            "language": lang,
            "name": disease_data["name"] if lang == "en" else translate_text(disease_data["name"], lang),
            "type": disease_data["type"] if lang == "en" else translate_text(disease_data["type"], lang),
            "description": translated_description
        }
        translations.append(translation)

    input = {
        "name": disease_data["name"],
        "crops": disease_data.get("crops", []),
        "stage_numbers": disease_data.get("stage_numbers", []),
        "image_urls": disease_data.get("image_urls", []),
        "translations": translations
    }
    return input

# Create CropDisease Input JSON
def create_crop_disease_input(disease_data):
    if not all(key in disease_data for key in ["name", "stage_numbers", "crops"]):
        raise ValueError("Missing required fields: stage_number, title")
    logger.info(f"Creating crop disease input for: {disease_data.get('name')}")
    junction_entries = []
    
    # Extract data
    disease_name = disease_data["name"]
    stage_numbers = disease_data["stage_numbers"]
    crops = disease_data["crops"]
    
    # Generate all combinations of crops and stage numbers
    for crop_name in crops:
        for stage_number in stage_numbers:
            junction_entries.append({
                "crop_name": crop_name,
                "name": disease_name,
                "stage_number": stage_number
            })
    
    return junction_entries

def main():
    # Get the current script's directory
    current_dir = Path(__file__).parent
    
    file_paths = [
        current_dir / "red_val" / "red.json",
        current_dir / "red_val" / "red_weeks.json",
        current_dir / "red_val" / "red_stages.json",
        # current_dir / "validated" / "cotton_diseases.json"
    ]
    output_dir = current_dir / "db_red_inputs_final"
    os.makedirs(output_dir, exist_ok=True)

    logger.info("Processing cotton.json")
    with open(file_paths[0], 'r', encoding='utf-8') as f:
        crops_data = json.load(f)
    
    crop_inputs = []
    for _,crop in crops_data.items():
        crop_input = create_crop_input(crop)
        crop_inputs.append(crop_input)

    # Save crop inputs
    with open(output_dir / "crop_inputs.json", 'w', encoding='utf-8') as f:
        json.dump(crop_inputs, f, indent=2, ensure_ascii=False)
    logger.info(f"Saved {len(crop_inputs)} crop inputs to {output_dir}/crop_inputs.json")

    logger.info("Processing cotton_weeks.json")
    with open(file_paths[1], 'r', encoding='utf-8') as f:
            weeks_data = json.load(f)
        
    week_inputs = []
    for week in weeks_data:
        crop_code = week.get("crop_code")
        tips = week.get("cultivation_steps")
        for week_num, week_entry in tips.items():
            stage_number = week_entry.get("stage_number")
            week_number = week_num.split('_')[-1]
            week_data = week_entry
        
            week_input = create_week_input(crop_code, stage_number, week_data, week_number)
            week_inputs.append(week_input)
    
    # Save week inputs
    with open(output_dir / "week_inputs.json", 'w', encoding='utf-8') as f:
        json.dump(week_inputs, f, indent=2, ensure_ascii=False)
    logger.info(f"Saved {len(week_inputs)} week inputs to {output_dir}/week_inputs.json")

    logger.info("Processing cotton_stages.json")
    with open(file_paths[2], 'r', encoding='utf-8') as f:
        stages_data = json.load(f)
    
    stage_inputs = []
    for stage in stages_data:
        crop_code = stage.get("crop_code")
        stages = stage.get("cultivation_stages")
        for stage_data in stages:
            stage_input = create_crop_stage_input(crop_code, stage_data)
            stage_inputs.append(stage_input)
    
    # Save stage inputs
    with open(output_dir / "stage_inputs.json", 'w', encoding='utf-8') as f:
        json.dump(stage_inputs, f, indent=2, ensure_ascii=False)
    logger.info(f"Saved {len(stage_inputs)} stage inputs to {output_dir}/stage_inputs.json")

    logger.info("Processing cotton_diseases.json")
    with open(file_paths[3], 'r', encoding='utf-8') as f:
        diseases_data = json.load(f)

    disease_inputs = []
    for disease in diseases_data:
        # Create disease input
        disease_input = create_disease_input(disease)
        disease_inputs.append(disease_input)
    
    # Save disease inputs
    with open(output_dir / "disease_inputs.json", 'w', encoding='utf-8') as f:
        json.dump(disease_inputs, f, indent=2, ensure_ascii=False)
    logger.info(f"Saved {len(disease_inputs)} disease inputs to {output_dir}/disease_inputs.json")

    logger.info("Processing cotton_diseases.json for Junction Table")
    with open(file_paths[3], 'r', encoding='utf-8') as f:
        diseases_data = json.load(f)

    crop_disease_inputs = []
    for disease in diseases_data:
        # Create crop disease input
        crop_disease_input = create_crop_disease_input(disease)
        crop_disease_inputs.extend(crop_disease_input)

    with open(output_dir / "crop_disease_inputs.json", 'w', encoding='utf-8') as f:
        json.dump(crop_disease_inputs, f, indent=2, ensure_ascii=False)
    logger.info(f"Saved {len(crop_disease_inputs)} crop disease inputs to {output_dir}/crop_disease_inputs.json")

if __name__ == "__main__":
    # main()
    print("translating...")
    init_translate()
    print(translate_text("Hello", "te"))