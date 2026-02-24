import sys
import os
from pathlib import Path

# Add the project root directory to Python path
project_root = str(Path(__file__).parent.parent.parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import json
from app.core.logger import logger
from google.cloud import translate_v2 as translate
from app.core.config import settings

translate_client = None

def init_translate():
    """Initialize the Google Cloud Translation client."""
    global translate_client
    
    # Get the current script's directory
    current_dir = Path(__file__).parent
    credentials_path = current_dir.parent.parent / "farmacy_service_acc_googele_api.json"
    
    if not credentials_path.exists():
        raise FileNotFoundError(f"Google Cloud credentials file not found at: {credentials_path}")
    
    try:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(credentials_path)
        translate_client = translate.Client()
        logger.info("Google Translate client initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Google Translate initialization error: {str(e)}")
        return False


def translate_text(text, target_language):
    """Translate text to target language using Google Cloud Translate API."""
    global translate_client
    
    if not text or not isinstance(text, str):
        return text
    
    if translate_client is None:
        if not init_translate():
            logger.error("Failed to initialize translation client")
            return text
    
    try:
        result = translate_client.translate(text, target_language=target_language)
        return result['translatedText']
    except Exception as e:
        logger.error(f"Error translating text: {e}")
        return text

def translate_json_data(data, target_language):
    """Recursively translate all string values in a JSON object."""
    if isinstance(data, dict):
        return {k: translate_json_data(v, target_language) for k, v in data.items()}
    elif isinstance(data, list):
        return [translate_json_data(item, target_language) for item in data]
    elif isinstance(data, str):
        return translate_text(data, target_language)
    else:
        return data

def main():
    # Get the current script's directory
    current_dir = Path(__file__).parent
    
    # Create output directories if they don't exist
    output_dir = current_dir / "translated"
    output_dir.mkdir(exist_ok=True)
    
    # Initialize the translation client
    if not init_translate():
        logger.error("Failed to initialize Google Cloud Translation client. Please check your credentials.")
        return
    
    # Read the input JSON file
    input_file = current_dir / "cotton.json"
    if not input_file.exists():
        logger.error(f"Input file not found: {input_file}")
        return
        
    try:
        with open(input_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # First, save the original English content
        output_file = output_dir / "en.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info("Original English content saved to en.json")
    except Exception as e:
        logger.error(f"Error reading input file: {e}")
        return
    
    # Define target languages
    languages = {
        "te": "Telugu",
        "hi": "Hindi",
    }
    
    # Translate for each language
    for lang_code, lang_name in languages.items():
        logger.info(f"Translating to {lang_name}...")
        
        try:
            # Translate the data
            translated_data = translate_json_data(data, lang_code)
            
            # Save the translated data
            output_file = output_dir / f"{lang_code}.json"
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(translated_data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"Translation to {lang_name} completed. Saved to {output_file}")
        except Exception as e:
            logger.error(f"Error processing {lang_name} translation: {e}")

if __name__ == "__main__":
    main()

# TO set api key in terminal
# set GOOGLE_APPLICATION_CREDENTIALS=path/to/your/farmacy_service_acc_googele_api.json