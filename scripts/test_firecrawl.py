import os
import requests
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(env_path)

api_key = os.getenv("FIRECRAWL_API_KEY")
print(f"Testing API Key: {api_key[:5] if api_key else 'None'}...")

url = "https://api.firecrawl.dev/v1/scrape"
headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
data = {"url": "https://example.com", "formats": ["markdown"]}

try:
    response = requests.post(url, headers=headers, json=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:200]}")
except Exception as e:
    print(f"Error: {e}")
