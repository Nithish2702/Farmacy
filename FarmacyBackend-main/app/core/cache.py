from functools import wraps
from typing import Optional, Any, Callable
from app.redis_client import cache_data, get_cached_data, clear_cache
from app.core.logger import logger
from fastapi import HTTPException, Request

def cache_response(ttl: int = 300, key_prefix: str = "user"):
    """
    Decorator to cache API responses in Redis.

    Args:
        ttl: Time to live in seconds (default 5 minutes)
        key_prefix: Prefix for the cache key
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key based on function name and arguments

            # Add query parameters to cache key
            request = kwargs.get("request") or next(
                (arg for arg in args if isinstance(arg, Request)), None)
            
            current_user = kwargs.get("current_user")
            if not current_user:
                raise HTTPException(status_code=401, 
                                    detail="Unauthorized", 
                                    headers={"WWW-Authenticate": "Bearer"})
            user_id = current_user.id
            base_key = f"{key_prefix}:{func.__name__}"

            route_params = {k: v for k, v in kwargs.items() if isinstance(v, (str, int, float))}

            query_params = dict(request.query_params) if request else {}

            key_parts = [base_key]
            if key_prefix not in {"crops", "news"}:
                key_parts.append(f"user={user_id}")

            key_parts += [f"{k}={v}" for k, v in sorted({**route_params, **query_params}.items())]

            cache_key = ":".join(key_parts)
            logger.info(f"Cache Key: {cache_key}")

            # Try to get from cache
            cached_data = get_cached_data(cache_key)
            if cached_data is not None:
                logger.info(f"Fetched from Cache...")
                return cached_data

            # If not in cache, execute function
            result = await func(*args, **kwargs)
            logger.info("Fetched from Route...")
            # Cache the result
            cache_data(cache_key, result, ttl)

            return result
        return wrapper
    return decorator


def clear_related_caches(patterns: list[str]):
    """
    Decorator to clear related caches after an operation.

    Args:
        patterns: List of cache key patterns to clear
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            result = await func(*args, **kwargs)

            # Clear all specified cache patterns
            for pattern in patterns:
                logger.info(f"Cleared Cache.. {pattern}")
                clear_cache(pattern)
            return result
        return wrapper
    return decorator


# Cache key patterns
CROP_CACHE_PATTERNS = {
    "all_crops": "crops:get_all_crops*",
    "crop_details": "crops:get_crop_by_id*",
    "crop_weeks": "crops:get_crop_weeks*",
    "crop_stages": "crops:get_crop_stages*",
    "crop_diseases": "crops:get_diseases*",
    "get_news": "news:get_news*",
    "prediction_history": "user:get_prediction_history*",
    "user_info": "user:get_user_info*"
}
