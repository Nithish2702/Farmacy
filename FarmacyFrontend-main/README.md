# Plant Disease Diagnosis Feature

This feature allows users to diagnose plant diseases using their device's camera or by selecting images from their gallery.

## Features

- Camera capture for plant photos
- Gallery image selection
- Real-time disease prediction using AI
- Detailed results display with confidence scores
- Recommendations for treatment
- Share and save functionality

## File Structure

- `capture.tsx`: Camera and gallery image capture screen
- `results.tsx`: Results display screen
- `_layout.tsx`: Navigation layout configuration

## API Integration

The feature integrates with the backend API endpoint `/predict-disease` to get disease predictions. The API expects:

- Image file (JPEG/PNG)
- Returns prediction results including:
  - Disease name
  - Confidence scores
  - Treatment recommendations

## Usage

1. Navigate to the diagnosis feature from the dashboard
2. Take a photo or select from gallery
3. Wait for analysis
4. View results and recommendations
5. Share or save results as needed

## Dependencies

- expo-camera
- expo-image-picker
- expo-file-system
- react-native-vector-icons
- axios

## Translations

The feature supports multiple languages through the i18n system. Translation keys are available in the locales folder. 