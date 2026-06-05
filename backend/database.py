import os
from typing import Any, Dict, List, Optional
from redisvl.extensions.llmcache import SemanticCache
from redisvl.utils.vectorize import HFTextVectorizer
from redisvl.index import SearchIndex

# Schema for complaints and broadcasts
SCHEMA = {
    "index": {
        "name": "Smart Citizen_vdb",
        "prefix": "doc",
    },
    "fields": [
        {"name": "content", "type": "text"},
        {"name": "title", "type": "text"},
        {"name": "category", "type": "tag"},
        {"name": "type", "type": "tag"}, # 'complaint' or 'broadcast'
        {"name": "timestamp", "type": "numeric"},
        {"name": "content_vector", "type": "vector", "attrs": {"dims": 384, "algorithm": "flat", "distance_metric": "cosine"}}
    ]
}

class VectorDB:
    def __init__(self, redis_url="redis://localhost:6379"):
        try:
            self.vectorizer = HFTextVectorizer(model="sentence-transformers/all-MiniLM-L6-v2")
            self.index = SearchIndex.from_dict(SCHEMA)
            self.index.connect(redis_url)
            
            # Create index if it doesn't exist
            if not self.index.exists():
                self.index.create(overwrite=True)
            self.enabled = True
        except Exception as e:
            print(f"❌ VectorDB failed to initialize: {e}")
            print("💡 Requirement: Redis with RediSearch module (Redis Stack) is needed for vector search.")
            self.enabled = False

    def add_document(self, doc_id: str, content: str, metadata: Dict[str, Any]):
        if not self.enabled: return
        doc = {
            "id": doc_id,
            "content": content,
            "title": metadata.get("title", ""),
            "category": metadata.get("category", "general"),
            "type": metadata.get("type", "complaint"),
            "timestamp": metadata.get("timestamp", 0),
            "content_vector": self.vectorizer.embed(content)
        }
        self.index.load([doc], id_field="id")

    def semantic_search(self, query: str, n_results: int = 5) -> List[Dict[str, Any]]:
        if not self.enabled:
            return []
        query_vector = self.vectorizer.embed(query)
        # RedisVL search logic
        from redisvl.query import VectorQuery
        
        v_query = VectorQuery(
            vector=query_vector,
            vector_field_name="content_vector",
            return_fields=["content", "title", "category", "type", "id"],
            num_results=n_results
        )
        
        results = self.index.query(v_query)
        return results

    def delete_document(self, doc_id: str):
        # RedisVL delete
        self.index.client.delete(f"doc:{doc_id}")

vdb = VectorDB()