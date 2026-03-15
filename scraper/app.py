from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import asyncio
import os

# Import original logic (we will copy the file or symlink for the build)
# For this TP, we'll implement a simplified version or assume collector.py is available
from collector import collect_articles

app = FastAPI(title="NewsAI Scraper Service")

class SearchRequest(BaseModel):
    interests: List[dict]
    max_per_topic: int = 5
    quick_mode: bool = False

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/scrape")
async def scrape(req: SearchRequest):
    try:
        articles = await collect_articles(
            max_per_topic=req.max_per_topic,
            quick_mode=req.quick_mode,
            user_interests=req.interests
        )
        # Convert RawArticle objects to dict
        return [a.__dict__ for a in articles]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
