-- Make crop_name and query nullable
ALTER TABLE disease_prediction_history 
ALTER COLUMN crop_name DROP NOT NULL;

ALTER TABLE disease_prediction_history 
ALTER COLUMN query DROP NOT NULL; 