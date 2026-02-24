from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class CropListResponse(BaseModel):
    id: int
    code: str
    name: str
    variety: str
    cultivated_in: Optional[str]
    description: Optional[str]
    cultivation_overview: Optional[str]
    image_urls: Optional[List[str]] = None

class CropResponse(BaseModel):
    id: int
    code: str
    name: str
    cultivated_in: Optional[str]
    variety: str
    description: Optional[str]
    cultivation_overview: Optional[str]
    image_urls: Optional[List[str]]

class WeekResponse(BaseModel):
    week_number: int
    title: str
    day_range: Optional[str]
    days: Dict[str, Any]
    image_urls: Optional[List[str]]
    video_urls: Optional[List[str]]
    stage_id: Optional[int]
    stage: Optional[Dict[str, Any]] = None

class StageWeekResponse(BaseModel):
    week_number: int
    title: str
    day_range: Optional[str]
    days: Dict[str, Any]
    image_urls: Optional[List[str]]
    video_urls: Optional[List[str]]

class StageResponse(BaseModel):
    stage_number: int
    title: str
    description: Dict[str, Any]
    image_urls: Optional[List[str]]
    weeks: Optional[List[StageWeekResponse]] = None 

class DiseaseResponse(BaseModel):
    id: int
    name: str
    type: str
    description: Dict[str, Any]
    image_urls: Optional[List[str]] 

class DiseaseListResponse(BaseModel):
    total: int
    hasMore: bool = False
    diseases: List[DiseaseResponse] = []
    
class DiseasePredictionResponse(BaseModel):
    prediction_id: str
    crop_name: str
    query: str
    predicted_diseases: List[str] = []
    confidence_score: float = 0.0
    recommendations: Dict[str, str] = {}