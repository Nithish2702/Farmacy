import os
import json
from pathlib import Path

# Define required keys for each type
REQUIRED_CROP_KEYS = {
    "crop_name", "crop_variety", "crop_code", "cultivated_in", "crop_desc", "cultivation_overview"
}

REQUIRED_WEEK_KEYS = {"title", "day_range", "days", "stage_number"}
REQUIRED_DAY_KEYS = {"tasks", "notes"}

REQUIRED_STAGE_TITLES = {
    "Land Preparation",
    "Seed Selection and Preparation",
    "Transplanting",
    "Fertilizer and Nutrient Management",
    "Water Management",
    "Weed, Pest, and Disease Management",
    "Harvesting",
    "Post-Harvest Operations"
}

REQUIRED_DISEASE_KEYS = {
    "name", "type", "pathogen", "description", "stage_numbers", "crops"
}

REQUIRED_DISEASE_DESC_KEYS = {
    "overview", "pathogen", "disease_type", "symptoms",
    "causes", "prevention", "treatment", "impact", "prevalence_telangana"
}

validated_dir = Path("red_val")
validated_dir.mkdir(exist_ok=True)


def normalize_stage_title(title):
    return title.strip().lower()


def validate_and_fix_crops(data, filename):
    errors = []
    for variety, crop in data.items():
        crop_keys = set(crop.keys())
        missing = REQUIRED_CROP_KEYS - crop_keys
        extra = crop_keys - REQUIRED_CROP_KEYS

        if missing:
            errors.append(f"[CROP: {variety}] Missing: {missing}")
            for k in missing:
                crop[k] = None
        if extra:
            errors.append(f"[CROP: {variety}] Extra: {extra}")

    save_validated_json(data, filename)
    return errors


def validate_and_fix_weeks(data, filename):
    errors = []
    for info in data:
        crop_code = info.get("crop_code")
        steps = info.get("cultivation_steps", {})
        for week_num, week in steps.items():
            missing_week = REQUIRED_WEEK_KEYS - week.keys()
            extra_week = set(week.keys()) - REQUIRED_WEEK_KEYS

            if missing_week:
                errors.append(f"[WEEK: {crop_code} - {week_num}] Missing week keys: {missing_week}")
                for k in missing_week:
                    week[k] = None
                    errors.append(f"[WEEK: {crop_code} - {week_num}] Added missing {k}")

            if extra_week:
                errors.append(f"[WEEK: {crop_code} - {week_num}] Extra week keys: {extra_week}")

            days = week.get("days", {})
            for day, content in days.items():
                missing_day = REQUIRED_DAY_KEYS - content.keys()
                extra_day = set(content.keys()) - REQUIRED_DAY_KEYS

                if missing_day:
                    errors.append(f"[WEEK-DAY: {crop_code} - {week_num} - {day}] Missing: {missing_day}")
                    for k in missing_day:
                        content[k] = None
                if extra_day:
                    errors.append(f"[WEEK-DAY: {crop_code} - {week_num} - {day}] Extra: {extra_day}")

    save_validated_json(data, filename)
    return errors


def validate_and_fix_stages(data, filename):
    errors = []
    for info in data:
        variety = info.get("crop_code")
        stages = info.get("cultivation_stages", [])
        found = set()
        for stage in stages:
            title = stage.get("title", "").strip()
            if not title:
                errors.append(f"[STAGE: {variety}] Missing stage title")
                continue

            norm_title = normalize_stage_title(title)
            found.add(norm_title)

            if "stage_number" not in stage:
                stage["stage_number"] = None
                errors.append(f"[STAGE: {variety} - {title}] Added missing 'stage_number'")

            desc = stage.get("description", {})
            if "overview" not in desc:
                desc["overview"] = None
                errors.append(f"[STAGE: {variety} - {title}] Added missing 'overview'")
            if "sub_steps" not in desc:
                desc["sub_steps"] = {}
                errors.append(f"[STAGE: {variety} - {title}] Added missing 'sub_steps'")

            stage["description"] = desc

        required_titles = {normalize_stage_title(t) for t in REQUIRED_STAGE_TITLES}
        missing_titles = required_titles - found
        if missing_titles:
            errors.append(f"[STAGE: {variety}] Missing required stages: {missing_titles}")

    save_validated_json(data, filename)
    return errors


def validate_and_fix_diseases(data, filename):
    errors = []
    
    for disease in data:
        keys = set(disease.keys())
        missing = REQUIRED_DISEASE_KEYS - keys
        extra = keys - REQUIRED_DISEASE_KEYS

        if missing:
            errors.append(f"[DISEASE: {disease.get('name')}] Missing top-level keys: {missing}")
            for k in missing:
                disease[k] = None

        if extra:
            errors.append(f"[DISEASE: {disease.get('name')}] Extra top-level keys: {extra}")

        desc = disease.get("description", {})
        if not isinstance(desc, dict):
            disease["description"] = {k: None for k in REQUIRED_DISEASE_DESC_KEYS}
            continue

        desc_keys = set(desc.keys())
        missing_desc = REQUIRED_DISEASE_DESC_KEYS - desc_keys
        extra_desc = desc_keys - REQUIRED_DISEASE_DESC_KEYS

        if missing_desc:
            errors.append(f"[DISEASE: {disease.get('name')}] Missing description keys: {missing_desc}")
            for k in missing_desc:
                if k == "stage_numbers" or k== "crops":
                    desc[k] = []
                else:
                    desc[k] = None
                errors.append(f"[WEEK: {disease.get('name')}] Added missing {k}")


        if extra_desc:
            errors.append(f"[DISEASE: {disease.get('name')}] Extra description keys: {extra_desc}")

        disease["description"] = desc

    save_validated_json(data, filename)
    return errors


def save_validated_json(data, original_filename):
    out_path = validated_dir / Path(original_filename).name
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def validator():
    # Run the validation
    file_paths = {
        "red.json": validate_and_fix_crops,
        "red_weeks.json": validate_and_fix_weeks,
        "red_stages.json": validate_and_fix_stages,
        # "cotton_diseases.json": validate_and_fix_diseases,
    }

    all_errors = []
    for file, validator in file_paths.items():
        if os.path.exists(file):
            with open(file, "r", encoding="utf-8") as f:
                data = json.load(f)
            errors = validator(data, file)
            all_errors.extend(errors)
        else:
            all_errors.append(f"File not found: {file}")

    # Print errors
    if all_errors:
        print("\n❌ Issues Found:")
        for err in all_errors:
            print("-", err)
    else:
        print("\n✅ All files validated and cleaned. Saved in 'validated/' folder.")

if __name__ == "__main__":
    validator()