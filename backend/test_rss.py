import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import asyncio
from collector import fetch_feed_async

async def main():
    sem = asyncio.Semaphore(5)
    source = {"url": "https://news.google.com/rss?hl=fr&gl=FR&ceid=FR:fr", "category": "News"}
    entries = await fetch_feed_async(source, max_per_topic=5, semaphore=sem)
    for e in entries:
        print(e.get("title"), e.get("image_url"))

import feedparser
print(f"Feedparser version: {feedparser.__version__}")
asyncio.run(main())
