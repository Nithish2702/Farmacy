from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional
import http.client
import urllib.parse
import json
from datetime import datetime, timezone

from app.core.cache import CROP_CACHE_PATTERNS, cache_response, clear_related_caches
from app.database import get_db
from datetime import datetime
import json
import urllib
from app.models.news import NewsArticle
from fastapi import APIRouter, Depends, HTTPException, status, Request , Query
from app.schemas.news_schema import NewsRead
from app.core.config import IST_TIME, settings
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/news", tags=["news"])

@router.post("/sync", status_code=status.HTTP_201_CREATED)
@clear_related_caches(
    CROP_CACHE_PATTERNS["get_news"]
)
async def sync_news_from_api(
    language: str,
    country: Optional[str] = Query(None, description="Country code (e.g., us, in)"),
    max_articles: Optional[int] = Query(10, description="Number of articles to fetch (1-100)"),
    db: Session = Depends(get_db)
):
    """Fetch latest news from Mediastack API and store them in the database."""

    try:
        # Construct the API URL with parameters
        base_url = "https://gnews.io/api/v4/search"
        params = {
            'q': 'agriculture OR farming OR crops',  # Default search query for farming-related news
            'lang': language,
            'max': max_articles,
            'apikey': settings.NEWS_API_KEY
        }
        
        if country:
            params['country'] = country
            
        # Convert params to URL query string
        query_string = '&'.join([f"{k}={v}" for k, v in params.items()])
        url = f"{base_url}?{query_string}"

        # Fetch data from API
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode("utf-8"))
            
            if "articles" not in data:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to fetch news from external API"
                )

            added_count = 0
            for article in data["articles"]:
                if db.query(NewsArticle).filter_by(url=article.get("url")).first():
                    continue  # Skip duplicates

                news_item = NewsArticle(
                    author=article.get('source', {}).get('name'),
                    title=article.get('title'),
                    description=article.get('description'),
                    url=article.get('url'),
                    source=article.get('source', {}).get('name'),
                    image_urls=[article['image']] if article.get('image') else None,
                    category=article.get('category', 'general'),
                    language=language,
                    country=country or article.get('source', {}).get('country'),
                    published_at=datetime.strptime(article.get('publishedAt'), "%Y-%m-%dT%H:%M:%SZ") if article.get('publishedAt') else datetime.now(IST_TIME)
                )
                db.add(news_item)
                added_count += 1

            db.commit()
            return {"message": f"{added_count} new articles stored."}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error syncing news: {str(e)}"
        )
    
@router.get("/get_news", response_model=List[NewsRead])
@cache_response(ttl=3600, key_prefix="news")  # Cache for 1 hour
async def get_news(
    request: Request,
    news_type: Optional[str] = Query(None, description="Filter by news category/type"),
    language: str = Query(default=None, description="Language code to filter news (optional)"),
    region: Optional[str] = Query(None, description="Filter by country/region"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(10, ge=1, le=100, description="Number of records to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve news articles with pagination.
    If language is specified, filter by language. Otherwise, return all.
    """
    query = db.query(NewsArticle)
    if language:
        query = query.filter(NewsArticle.language == language)
    if news_type:
        query = query.filter(NewsArticle.category == news_type)
    if region:
        query = query.filter(NewsArticle.country == region)
    total_count = query.count()

    if skip >= total_count:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No more news articles available"
        )

    news = query.order_by(NewsArticle.published_at.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()

    if not news:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No news found"
        )
    return [NewsRead.model_validate(n) for n in news]

@router.get("/get_news/{news_id}", response_model=NewsRead)
@cache_response(ttl=3600, key_prefix="news_by_id")  # Cache for 1 hour
async def get_news_by_id(
    news_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve a specific news article by its ID.
    """
    news = db.query(NewsArticle).filter(NewsArticle.id == news_id).first()
    if not news:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="News article not found"
        )
    return NewsRead.model_validate(news)