from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import List, Optional

class NewsRead(BaseModel):
    id: int
    author: Optional[str]
    title: str
    description: Optional[str]
    url: str
    source: Optional[str]
    image_urls: Optional[List[str]]
    category: Optional[str]
    language: Optional[str]
    country: Optional[str]
    published_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

