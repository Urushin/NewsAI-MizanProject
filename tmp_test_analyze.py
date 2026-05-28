import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from fastapi.testclient import TestClient
from backend.app import app

client = TestClient(app)

# Bypass auth mockup - not needed if we call TestClient but endpoint was modified
# Wait, let's just make the POST request directly to the client

payload = {
    "link": "https://www.lemonde.fr/politique/article/2026/03/16/test_123.html",
    "title": "Test Article",
    "summary": ["Point A"],
    "language": "fr"
}

print("🚀 Triggering client.post('/api/brief/analyze')...")
try:
    response = client.post("/api/brief/analyze", json=payload)
    print(f"Status: {response.status_code}")
    print(response.text)
except Exception as e:
    print(f"❌ TestClient Crashed: {e}")
