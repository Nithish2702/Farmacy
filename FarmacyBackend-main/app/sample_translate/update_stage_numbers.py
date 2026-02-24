import json
import os
from pathlib import Path

def load_json_file(file_path):
    """Load JSON data from file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json_file(file_path, data):
    """Save JSON data to file"""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def get_stage_number(title, tasks):
    """
    Determine the stage number based on the week's title and tasks
    Stages from crops.txt:
    1. Land Preparation
    2. Seed Selection and Preparation
    3. Transplanting
    4. Fertilizer and Nutrient Management
    5. Water Management
    6. Weed, Pest, and Disease Management
    7. Harvesting
    8. Post-Harvest Operations
    """
    title = title.lower()
    tasks_text = ' '.join([' '.join(task) for task in tasks]).lower()

    # Stage matching rules
    if any(term in title for term in ['land preparation', 'soil preparation', 'field preparation']):
        return 1
    elif any(term in title for term in ['seed', 'sowing', 'planting']):
        return 2
    elif 'transplanting' in title:
        return 3
    elif any(term in title for term in ['fertilizer', 'nutrient', 'fertilisation']):
        return 4
    elif any(term in title for term in ['irrigation', 'water management']):
        return 5
    elif any(term in title for term in ['weed', 'pest', 'disease']):
        return 6
    elif 'harvest' in title and 'post' not in title:
        return 7
    elif 'post-harvest' in title:
        return 8
    
    # If title doesn't match, check tasks
    if any(term in tasks_text for term in ['plough', 'clear field', 'land preparation']):
        return 1
    elif any(term in tasks_text for term in ['seed', 'sowing', 'planting preparation']):
        return 2
    elif 'transplant' in tasks_text:
        return 3
    elif any(term in tasks_text for term in ['fertilizer', 'nutrient', 'urea', 'dap']):
        return 4
    elif any(term in tasks_text for term in ['irrigation', 'water']):
        return 5
    elif any(term in tasks_text for term in ['weed', 'pest', 'disease', 'spray']):
        return 6
    elif 'harvest' in tasks_text and 'post' not in tasks_text:
        return 7
    elif 'post-harvest' in tasks_text:
        return 8
    
    return None

def update_stage_numbers(weeks_data):
    """Update stage numbers for all weeks based on their content"""
    for week in weeks_data:
        # Get English translation
        en_translation = next(
            (t for t in week['translations'] if t['language'] == 'en'),
            None
        )
        
        if en_translation:
            # Get tasks from all days
            all_tasks = []
            for day_data in en_translation['days'].values():
                if 'tasks' in day_data:
                    all_tasks.append(day_data['tasks'])
            
            # Determine stage number
            stage_num = get_stage_number(en_translation['title'], all_tasks)
            week['stage_number'] = stage_num

    return weeks_data

def main():
    # Get the current script's directory
    current_dir = Path(__file__).parent
    input_file = current_dir / "db_cotton__inputs_final" / "week_inputs.json"
    output_file = current_dir / "db_cotton__inputs_final" / "week_inputs_updated.json"

    # Load the JSON data
    print(f"Loading data from {input_file}")
    weeks_data = load_json_file(input_file)

    # Update stage numbers
    print("Updating stage numbers...")
    updated_data = update_stage_numbers(weeks_data)

    # Save the updated data
    print(f"Saving updated data to {output_file}")
    save_json_file(output_file, updated_data)

    # Print summary
    stage_counts = {}
    for week in updated_data:
        stage_num = week['stage_number']
        stage_counts[stage_num] = stage_counts.get(stage_num, 0) + 1
    
    print("\nStage number distribution:")
    for stage_num in sorted(stage_counts.keys()):
        print(f"Stage {stage_num}: {stage_counts[stage_num]} weeks")

if __name__ == "__main__":
    main() 