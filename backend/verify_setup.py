import sys
import os

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_redis():
    print("Testing Redis connection...")
    try:
        from cache import redis_client
        redis_client.ping()
        print("✅ Redis connection successful.")
    except Exception as e:
        print(f"❌ Redis connection failed: {e}")

def test_vector_db():
    print("Testing VectorDB initialization...")
    try:
        from database import vdb
        print("✅ VectorDB initialized.")
    except Exception as e:
        print(f"❌ VectorDB initialization failed: {e}")

def test_ai_handler():
    print("Testing AIHandler initialization...")
    try:
        from ai_handler import ai_handler
        print("✅ AIHandler initialized.")
        response = ai_handler.frame_response("test query", [{"title": "Test doc", "type": "complaint", "content": "This is a test document."}])
        print(f"✅ AI Response: {response}")
    except Exception as e:
        print(f"❌ AIHandler test failed: {e}")

if __name__ == "__main__":
    test_redis()
    test_vector_db()
    test_ai_handler()
