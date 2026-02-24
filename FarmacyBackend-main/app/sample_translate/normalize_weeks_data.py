import json
import re
from typing import Dict, Any

def extract_number(s: str) -> int:
    match = re.search(r"\d+", s)
    return int(match.group()) if match else 0

def normalize_week_key(week_key: str) -> list:
    parts = week_key.split("_")
    if len(parts) == 4 and parts[1].isdigit() and parts[3].isdigit():
        start_week = int(parts[1])
        end_week = int(parts[3])
        return [f"week_{week}" for week in range(start_week, end_week + 1)]
    return [week_key]

def normalize_day_label(day_label: str, week_number: int, original_start_day: int, original_end_day: int) -> list:
    parts = day_label.split("_")
    if len(parts) == 4 and parts[1].isdigit() and parts[3].isdigit():
        start_day = int(parts[1])
        end_day = int(parts[3])
        # Calculate the offset within the week range
        week_start_day = (week_number - 1) * 7 + 1
        days = []
        for day in range(start_day, end_day + 1):
            # Map the day to the global timeline
            relative_day = day - original_start_day
            new_day = week_start_day + relative_day % 7
            days.append(f"day_{new_day}")
        return days
    else:
        # For single days, adjust to the week's timeline
        day_num = extract_number(day_label)
        week_start_day = (week_number - 1) * 7 + 1
        new_day = week_start_day + (day_num - 1) % 7
        return [f"day_{new_day}"]

def normalize_day_range(week_key: str, day_range: str) -> str:
    week_number = extract_number(week_key)
    week_day_start = (week_number - 1) * 7 + 1
    week_day_end = week_number * 7
    return f"Days {week_day_start}–{week_day_end}"

def normalize_cultivation_steps(cultivation_steps: Dict) -> Dict:
    normalized_steps = {}
    for week_key, week_data in cultivation_steps.items():
        week_keys = normalize_week_key(week_key)
        # Extract original day range for context
        try:
            original_start_day, original_end_day = map(int, re.findall(r"\d+", week_data["day_range"]))
        except:
            original_start_day, original_end_day = 1, 7  # Fallback
        for new_week_key in week_keys:
            week_number = extract_number(new_week_key)
            normalized_days = {}
            for day_label, day_data in week_data["days"].items():
                day_labels = normalize_day_label(day_label, week_number, original_start_day, original_end_day)
                for new_day_label in day_labels:
                    normalized_days[new_day_label] = {
                        "tasks": day_data["tasks"],
                        "notes": day_data.get("notes")
                    }
            normalized_steps[new_week_key] = {
                "title": week_data["title"],
                "day_range": normalize_day_range(new_week_key, week_data["day_range"]),
                "days": normalized_days
            }
    return normalized_steps

def normalize_json(input_file: str, output_file: str):
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        normalized_data = {}
        for crop_key, crop_data in data.items():
            normalized_data[crop_key] = {
                **{k: v for k, v in crop_data.items() if k != "cultivation_steps"},
                "cultivation_steps": normalize_cultivation_steps(crop_data["cultivation_steps"])
            }

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(normalized_data, f, indent=2, ensure_ascii=False)
        print(f"Normalized JSON saved to {output_file}")

    except FileNotFoundError:
        print(f"Error: {input_file} not found")
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON format in {input_file}")
    except UnicodeDecodeError as e:
        print(f"Error: Unable to decode {input_file}. Try checking file encoding: {str(e)}")
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    normalize_json("translated/en.json", "en_normalized.json")
    normalize_json("translated/te.json", "te_normalized.json")
    normalize_json("translated/hi.json", "hi_normalized.json")