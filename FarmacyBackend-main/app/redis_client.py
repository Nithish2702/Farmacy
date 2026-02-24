from app.core.logger import logger
import redis
import json
from typing import Any, Optional

from app.core.config import settings

redis_client = None


def init_redis():
    global redis_client
    try:
        redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            decode_responses=True,
            username="default",
            password=settings.REDIS_PASSWORD,
            connection_pool=redis.ConnectionPool(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                username="default",
                password=settings.REDIS_PASSWORD
            )
        )
        redis_client.ping()
        logger.info("Redis client initialized successfully")
    except redis.RedisError as e:
        logger.error(f"Redis connection error: {str(e)}")
        raise


def cache_data(key: str, value: Any, ttl: int = 300):
    """
    Cache data in Redis with a specified TTL (default 5 minutes).

    Args:
        key: Redis key to store data under
        value: Data to cache (will be JSON serialized)
        ttl: Time-to-live in seconds (default 300s = 5 minutes)
    """
    try:

        # Check if it's a list of Pydantic models
        if isinstance(value, list) and all(hasattr(item, "model_dump") for item in value):
            json_data = json.dumps([item.model_dump(mode="json") for item in value])
        elif hasattr(value, "model_dump"):
            json_data = json.dumps(value.model_dump(mode="json"))
        else:
            json_data = json.dumps(value)

        redis_client.setex(key, ttl, json_data)
    except Exception as e:
        logger.error(f"Redis caching error: {e}")

def get_cached_data(key: str) -> Optional[Any]:
    """
    Retrieve cached data from Redis.

    Args:
        key: Redis key to retrieve

    Returns:
        Deserialized data if found, None otherwise
    """
    try:
        data = redis_client.get(key)
        if data:
            return json.loads(data)
        return None
    except Exception as e:
        print(f"Redis retrieval error: {str(e)}")
        return None


def clear_cache(key_pattern: str):
    """
    Clear cache entries matching the given pattern.

    Args:
        key_pattern: Pattern to match keys (e.g., "user:")
    """
    try:
        cursor = '0'
        while cursor != 0:
            cursor, keys = redis_client.scan(cursor=cursor, match=key_pattern, count=1000)
            if keys:
                redis_client.delete(*keys)
        return True
    except Exception as e:
        print(f"Redis clear cache error: {str(e)}")
        return False
    
def clear_all_cache():
    """
    Clear all keys from the current Redis database.
    """
    try:
        redis_client.flushdb()  # Clears current DB only
        return True
    except Exception as e:
        print(f"Redis flush error: {str(e)}")
        return False

def increment_counter(key: str, ttl: int = 86400) -> int:
    """
    Increment a counter in Redis and set expiry if not exists.

    Args:
        key: Redis key for the counter
        ttl: Time-to-live in seconds (default 24 hours)

    Returns:
        Current counter value
    """
    try:
        current = redis_client.incr(key)
        if current == 1:  # First increment, set expiry
            redis_client.expire(key, ttl)
        return current
    except Exception as e:
        print(f"Redis counter error: {str(e)}")
        return 0