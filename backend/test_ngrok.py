import os
import time
from pyngrok import ngrok

try:
    print("Attempting to start ngrok...")
    tunnel = ngrok.connect(8000, "http")
    print(f"Success! URL: {tunnel.public_url}")
except Exception as e:
    print(f"Error starting ngrok: {e}")
