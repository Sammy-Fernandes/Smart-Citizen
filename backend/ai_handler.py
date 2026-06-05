from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
import torch

class AIHandler:
    def __init__(self, model_name="google/flan-t5-small"):
        self.model_name = model_name
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tokenizer = None
        self.model = None
        self.loaded = False
        self.loading_error = None

    def _load_model(self):
        if self.loaded:
            return True
        try:
            print(f"🔄 Loading AI model {self.model_name} on {self.device}...")
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self.model = AutoModelForSeq2SeqLM.from_pretrained(self.model_name).to(self.device)
            self.loaded = True
            print("✅ AI Model loaded successfully.")
            return True
        except Exception as e:
            self.loading_error = str(e)
            print(f"❌ Error loading AI model: {e}")
            return False

    def frame_response(self, query: str, context_docs: list):
        """
        Frames a response based on semantic search results.
        """
        # Try to load model if not loaded
        if not self.loaded:
            success = self._load_model()
            if not success:
                # Return a helpful fallback if model fails
                return self._get_fallback_response(query, context_docs)

        if not context_docs:
            return "I'm sorry, I couldn't find any specific records for that. However, I am here to help with city complaints and updates. Try asking about recent potholes or garbage reports!"

        # Prepare context from search results
        context_str = "\n".join([
            f"- {doc['title']} ({doc['type']}): {doc['content']}" 
            for doc in context_docs
        ])

        prompt = (
            "You are Smart Citizen AI, a helpful assistant for city residents. "
            f"Context from recent civic reports and broadcasts:\n{context_str}\n\n"
            f"Question: {query}\n\n"
            "If the answer is in the context, be concise. "
            "If the question is about your name, say you are Smart Citizen AI. "
            "If the answer is NOT in the context, say you don't know."
        )

        try:
            inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512).to(self.device)
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs, 
                    max_length=150, 
                    min_length=10, 
                    do_sample=False
                )
            return self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        except Exception as e:
            print(f"⚠️ Error during response generation: {e}")
            return self._get_fallback_response(query, context_docs)

    def _get_fallback_response(self, query: str, context_docs: list):
        """
        Provides a simple rule-based response if the AI model is unavailable.
        """
        if not context_docs:
            return "I'm having trouble using my neural brain right now, but I've checked our records and found no matching reports. Please double check the query or try again later."
        
        # Simple extraction for fallback
        res = "I found some relevant information in our records:\n"
        for doc in context_docs[:2]:
            res += f"- {doc['title']}: {doc['content'][:100]}...\n"
        res += "\n(Note: This is an automated summary as the full language model is currently offline.)"
        return res

ai_handler = AIHandler()
