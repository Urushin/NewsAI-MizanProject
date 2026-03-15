import httpx
import os
from loguru import logger
from models import RawArticle

SCRAPER_SERVICE_URL = os.getenv("SCRAPER_SERVICE_URL", "http://scraper:8001")

async def collect_articles_remote(user_interests: list, max_per_topic: int = 5, quick_mode: bool = False):
    """Calls the remote scraper microservice."""
    logger.info(f"📡 Calling remote scraper at {SCRAPER_SERVICE_URL}")
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(
                f"{SCRAPER_SERVICE_URL}/scrape",
                json={
                    "interests": user_interests,
                    "max_per_topic": max_per_topic,
                    "quick_mode": quick_mode
                }
            )
            resp.raise_for_status()
            data = resp.json()
            # Convert dict back to RawArticle objects
            return [RawArticle(**a) for a in data]
        except Exception as e:
            logger.error(f"❌ Scraper service call failed: {e}")
            # Fallback to local if needed or raise
            raise e
