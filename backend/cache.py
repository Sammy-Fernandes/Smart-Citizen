import json
import redis
import os
from fastapi import Request, HTTPException
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import datetime

# Setup Redis Client
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)

redis_client = redis.Redis(
    host=REDIS_HOST, 
    port=REDIS_PORT, 
    password=REDIS_PASSWORD, 
    db=0, 
    decode_responses=True
)

# Rate Limiter setup
limiter = Limiter(key_func=get_remote_address)

class QueryCache:
    @staticmethod
    def get_query_key(query: str):
        return f"query_cache:{query.strip().lower()}"

    @staticmethod
    def get_cached_response(query: str):
        try:
            key = QueryCache.get_query_key(query)
            val = redis_client.get(key)
            if val:
                print(f"📦 Cache hit for: {query}")
                return json.loads(val)
            print(f"📭 Cache miss for: {query}")
            return None
        except Exception as e:
            print(f"⚠️ Redis cache error: {e}")
            return None

    @staticmethod
    def cache_response(query: str, response: str):
        # Calculate time until next midnight for "clear every day" logic
        now = datetime.datetime.now()
        tomorrow = now + datetime.timedelta(days=1)
        midnight = datetime.datetime.combine(tomorrow, datetime.time.min)
        seconds_until_midnight = int((midnight - now).total_seconds())
        
        try:
            redis_client.set(
                QueryCache.get_query_key(query),
                json.dumps({"response": response, "timestamp": now.isoformat()}),
                ex=seconds_until_midnight
            )
        except Exception as e:
            print(f"⚠️ Redis cache set error: {e}")

def setup_rate_limiting(app):
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

async def rate_limit_user(request: Request):
    # This can be used as a dependency if needed, 
    # but slowapi decorators on routes are more common.
    pass
