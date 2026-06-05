from cache import redis_client

class UserAccountHandler:
    @staticmethod
    def track_query(user_id: str):
        """
        Increments the query count for a specific user in Redis.
        """
        key = f"user_stats:{user_id}:queries"
        redis_client.incr(key)
        # No expiration for stats, they persist unless manually cleared
        return int(redis_client.get(key))

    @staticmethod
    def get_user_stats(user_id: str):
        key = f"user_stats:{user_id}:queries"
        count = redis_client.get(key)
        return {"user_id": user_id, "total_queries": int(count) if count else 0}

user_mgmt = UserAccountHandler()
