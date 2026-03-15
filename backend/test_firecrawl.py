import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import asyncio
from collector import fetch_article_content_async

async def main():
    sem = asyncio.Semaphore(1)
    # Using a known URL
    url = "https://www.lefigaro.fr/international/donald-trump-dans-le-piege-de-la-malediction-iranienne-20250311"
    text, image = await fetch_article_content_async(url, sem)
    print("IMAGE FOUND FROM FIRECRAWL:", image)

asyncio.run(main())
