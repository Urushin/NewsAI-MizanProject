"""
NewsAI — Compact Version
A single-file architecture containing the entire backend logic.
"""
import os
import sys
import re
import json
import time
import asyncio
import hashlib
import pathlib
import random
import difflib
import httpx
import pytz
import jwt
import feedparser
from abc import ABC, abstractmethod
from typing import List, Tuple, Dict, Any, Optional, Union, Annotated, Type, TypeVar, Callable, Set
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse, quote, urljoin
from collections import defaultdict
from contextlib import asynccontextmanager

from loguru import logger
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, ValidationError
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel
from firecrawl import FirecrawlApp

# ── Load env ──
root_dir = pathlib.Path(__file__).parent.parent.resolve()
load_dotenv(str(root_dir / '.env'))

# ══════════════════════════════════════════════════════════════════════════════
# 1. MODELS (Data Structures)
# ══════════════════════════════════════════════════════════════════════════════
StrictStr = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=False)]

class RawArticle(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    title: StrictStr = Field(..., min_length=1, max_length=500)
    link: StrictStr = Field(..., min_length=1, max_length=1500)
    published: StrictStr = Field(default="Date inconnue")
    source_interest: StrictStr = Field(default="")
    content: StrictStr = Field(default="")
    source_name: StrictStr = Field(default="")
    image_url: Optional[str] = Field(default=None)
    tier: int = Field(default=4)

class ArticleVerdict(BaseModel):
    model_config = ConfigDict(extra='ignore', str_strip_whitespace=True)
    localized_title: StrictStr = Field(..., min_length=1, max_length=1000)
    summary: List[StrictStr] = Field(..., min_length=1)
    score: Annotated[int, Field(ge=0, le=100)]
    keep: bool = True
    category: StrictStr = Field(default="Passion", max_length=100)
    sub_category: StrictStr = Field(default="Général", max_length=50)
    reason: StrictStr = Field(default="", max_length=500)
    credibility_score: Annotated[int, Field(ge=0, le=100)] = 50
    link: StrictStr = Field(default="", max_length=1500)
    source_name: StrictStr = Field(default="")
    image_url: Optional[str] = Field(default=None)
    neutrality_score: Annotated[int, Field(ge=0, le=100)] = 100
    detected_biases: List[str] = Field(default_factory=list)
    bias_details: List[Dict[str, str]] = Field(default_factory=list)
    primary_evidence: Optional[str] = Field(default=None)
    source_ownership: Optional[Dict[str, str]] = Field(default=None)
    is_fused: bool = Field(default=False)
    tier: Optional[str] = Field(default=None)
    sources_count: int = Field(default=1, ge=1)
    source_urls: List[str] = Field(default_factory=list)
    source_names: List[str] = Field(default_factory=list)

    @field_validator('summary', mode='before')
    @classmethod
    def clean_summary(cls, v):
        if not v: return ["Résumé en cours de traitement."]
        if isinstance(v, str):
            cleaned = re.sub(r'[*_`]', '', v).strip()
            parts = [p.strip() for p in re.split(r'[\n•]', cleaned) if p.strip()]
            return parts if parts else [cleaned]
        if isinstance(v, list):
            cleaned_list = []
            for item in v:
                if isinstance(item, str):
                    c = re.sub(r'^[-•]\s*', '', item)
                    c = re.sub(r'[*_`]', '', c)
                    if c.strip(): cleaned_list.append(c.strip())
            return cleaned_list if cleaned_list else ["Résumé non disponible"]
        return ["Résumé non disponible"]

    @field_validator('category', mode='before')
    @classmethod
    def normalize_category(cls, v):
        if not isinstance(v, str): return "Passion"
        known = {"impact", "passion", "tech", "politik", "business", "world", "security", "trending"}
        if v.strip().lower() in known: return v.strip().capitalize()
        impact_keywords = {"politique", "économie", "economy", "politics", "sécurité", "crisis", "crise", "war", "guerre", "geopolitics", "géopolitique"}
        if v.strip().lower() in impact_keywords: return "Impact"
        return "Passion"

class YouTubeVideo(BaseModel):
    model_config = ConfigDict(extra='ignore', str_strip_whitespace=True)
    title: StrictStr; link: StrictStr; channel: StrictStr; thumbnail: StrictStr; published: StrictStr

# ══════════════════════════════════════════════════════════════════════════════
# 2. DATABASE (Supabase Interface)
# ══════════════════════════════════════════════════════════════════════════════
from supabase import create_client, Client

_client: Optional[Client] = None
def get_supabase() -> Client:
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL", "https://jekshjfyxvnmbqyuaosu.supabase.co")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impla3NoamZ5eHZubWJxeXVhb3N1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjEzNzgwNiwiZXhwIjoyMDg3NzEzODA2fQ.X8G0oIxITZxh0YLorMAioeyobdGsQAfplTfYEOp0vGU")
        _client = create_client(url, key)
    return _client

# DX Mode Cache
_DX_MOCK_USER_ID = "00000000-0000-0000-0000-000000000000"
def _dx_cache_path(filename: str) -> str:
    path = os.path.join(os.path.dirname(__file__), "cache")
    os.makedirs(path, exist_ok=True)
    return os.path.join(path, filename)

def get_cached_content(url: str) -> Optional[str]:
    try:
        res = get_supabase().table("url_cache").select("content").eq("url", url).execute()
        return res.data[0]["content"] if res.data else None
    except: return None

def cache_content(url: str, content: str):
    try: get_supabase().table("url_cache").upsert({"url": url, "content": content, "fetched_at": datetime.now(timezone.utc).isoformat()}).execute()
    except: pass

def get_user_by_username(username: str) -> Optional[dict]:
    if os.getenv("APP_STAGE") == "development" and username in ("DevUser", "Dev User", ""):
        path = _dx_cache_path(f"profile_{_DX_MOCK_USER_ID}.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f: return json.load(f)
        return {"id": _DX_MOCK_USER_ID, "username": "DevUser", "language": "fr", "score_threshold": 70, "interests": {}}
    try:
        res = get_supabase().table("profiles").select("*").eq("username", username).execute()
        return res.data[0] if res.data else None
    except: return None

def get_user_by_id(user_id: str) -> Optional[dict]:
    if os.getenv("APP_STAGE") == "development" and user_id == _DX_MOCK_USER_ID:
        path = _dx_cache_path(f"profile_{user_id}.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f: return json.load(f)
        return {"id": user_id, "username": "DevUser", "language": "fr", "interests": {}}
    try:
        res = get_supabase().table("profiles").select("*").eq("id", user_id).execute()
        return res.data[0] if res.data else None
    except: return None

def set_generation_status(username: str, status: str, step: str, percent: int):
    try:
        if os.getenv("APP_STAGE") == "development" and username in ("DevUser", ""):
            path = _dx_cache_path(f"status_{username}.json")
            with open(path, "w", encoding="utf-8") as f:
                json.dump({"status": status, "step": step, "percent": percent}, f)
            return
        get_supabase().table("generation_status").upsert({"username": username, "status": status, "step": step, "percent": percent, "updated_at": datetime.now(timezone.utc).isoformat()}).execute()
    except: pass

def store_daily_brief(user_id: str, brief_data: dict):
    date_str = datetime.now().date().isoformat()
    payload = {"user_id": user_id, "global_digest": brief_data.get("global_digest"), "content": brief_data.get("content", []), "date": date_str, "youtube_videos": brief_data.get("youtube_videos", [])}
    try: get_supabase().table("daily_briefs").upsert(payload, on_conflict="user_id,date").execute()
    except:
        if os.getenv("APP_STAGE") == "development":
            with open(_dx_cache_path(f"brief_{user_id}.json"), "w", encoding="utf-8") as f: json.dump(payload, f)

def get_media_metadata(source_name: str) -> Optional[str]:
    if not source_name: return None
    try:
        res = get_supabase().table("media_metadata").select("ownership").ilike("name", f"%{source_name[:15]}%").execute()
        return res.data[0]["ownership"] if res.data else None
    except: return None

# ══════════════════════════════════════════════════════════════════════════════
# 3. AUTH & SECURITY
# ══════════════════════════════════════════════════════════════════════════════
def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    is_dev = os.getenv("APP_STAGE") == "development"
    if is_dev and (not auth or auth == "Bearer dev_token_bypass"):
        return {"user_id": _DX_MOCK_USER_ID, "email": "dev@newsai.local", "username": "DevUser"}
    if not auth.startswith("Bearer "): raise HTTPException(401, "Non authentifié")
    token = auth.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        return {"user_id": payload.get("sub"), "email": payload.get("email"), "username": payload.get("user_metadata", {}).get("username", "User")}
    except: raise HTTPException(401, "Token invalide")

# ══════════════════════════════════════════════════════════════════════════════
# 4. LLM WRAPPER & UTILS
# ══════════════════════════════════════════════════════════════════════════════
T = TypeVar('T', bound=BaseModel)

async def call_llm(prompt: str, system_prompt: str = None) -> str:
    key = os.getenv("MISTRAL_API_KEY")
    if not key: raise RuntimeError("Missing MISTRAL_API_KEY")
    if system_prompt is None: system_prompt = "Output valid JSON."
    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post("https://api.mistral.ai/v1/chat/completions", headers={"Authorization": f"Bearer {key}"}, json={"model": "mistral-small-latest", "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt}], "temperature": 0.1})
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

async def embed_texts(texts: List[str]) -> List[List[float]]:
    key = os.getenv("MISTRAL_API_KEY")
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post("https://api.mistral.ai/v1/embeddings", headers={"Authorization": f"Bearer {key}"}, json={"model": "mistral-embed", "input": texts})
        resp.raise_for_status()
        return [r["embedding"] for r in resp.json()["data"]]

def parse_llm_json(text: str) -> Union[list, dict]:
    cleaned = re.sub(r"^```(?:json)?\s*\n?", "", text, flags=re.MULTILINE).strip().rstrip("`")
    return json.loads(cleaned)

# ══════════════════════════════════════════════════════════════════════════════
# 5. COLLECTOR (RSS & Scraping)
# ══════════════════════════════════════════════════════════════════════════════
async def collect_articles(user_interests: list = None) -> List[RawArticle]:
    logger.info("🔍 Collecting articles...")
    # Minimal logic for compact version: Google News RSS
    base_url = "https://news.google.com/rss/search?q={}&hl=fr&gl=FR&ceid=FR:fr"
    results = []
    topics = [src["query"] for src in (user_interests or []) if "query" in src] or ["actualité"]
    
    async with httpx.AsyncClient() as client:
        for topic in topics[:5]:
            resp = await client.get(base_url.format(quote(topic)))
            feed = feedparser.parse(resp.text)
            for entry in feed.entries[:5]:
                results.append(RawArticle(title=entry.title, link=entry.link, source_interest=topic, content=entry.get("summary", "")))
    return results

# ══════════════════════════════════════════════════════════════════════════════
# 6. COGNITIVE ENGINE (Clustering & Chimera)
# ══════════════════════════════════════════════════════════════════════════════
def _sentence_similarity(a: str, b: str) -> float:
    # Optimized: Jaccard before difflib
    wa, wb = set(a.lower().split()), set(b.lower().split())
    if not wa or not wb: return 0.0
    jaccard = len(wa & wb) / len(wa | wb)
    if jaccard < 0.2: return 0.0
    if jaccard > 0.8: return jaccard
    return difflib.SequenceMatcher(None, a.lower(), b.lower()).ratio()

def cluster_articles(articles: List[RawArticle]) -> List[List[RawArticle]]:
    clusters = []
    for art in articles:
        found = False
        for c in clusters:
            if difflib.SequenceMatcher(None, art.title.lower(), c[0].title.lower()).ratio() > 0.45:
                c.append(art); found = True; break
        if not found: clusters.append([art])
    return clusters

async def synthesize_cluster(cluster: List[RawArticle], profile: dict, lang: str) -> dict:
    # 3-Stage Chimera Logic simplified
    prompt = f"Synthèse de ces {len(cluster)} articles pour un {profile.get('identity', {}).get('role', 'utilisateur')}.\n\n"
    for i, a in enumerate(cluster): prompt += f"{i+1}. {a.title}\n"
    
    level = profile.get("preferences", {}).get("summary_length", 1)
    style = "3 bullet points" if level == 1 else "paragraph"
    
    sys = f"You are a news analyst. Output JSON with fields: localized_title, summary (list of strings, {style}), score (0-100), keep (bool), category, sub_category, reason."
    raw = await call_llm(prompt, sys)
    return parse_llm_json(raw)

# ══════════════════════════════════════════════════════════════════════════════
# 7. PIPELINE (The Orchestrator)
# ══════════════════════════════════════════════════════════════════════════════
async def run_pipeline(username: str):
    set_generation_status(username, "processing", "Début de la collecte...", 5)
    user = get_user_by_username(username)
    profile = {"identity": user.get("identity", {}), "preferences": user.get("preferences", {}), "interests": user.get("interests", {})}
    
    # 1. Collect
    raw = await collect_articles(user_interests=[{"query": k} for k in profile["interests"].keys()])
    
    # 2. Cluster
    clusters = cluster_articles(raw)
    
    # 3. Fusion Chimera in Parallel
    async def _fuse(c):
        try:
            data = await synthesize_cluster(c, profile, "fr")
            if "title" in data and "localized_title" not in data: data["localized_title"] = data.pop("title")
            if not data.get("link"): data["link"] = c[0].link
            v = ArticleVerdict(**data)
            v.source_names = [getattr(a, "source_name", "") or a.link for a in c]
            v.image_url = c[0].image_url
            return v
        except: return None

    set_generation_status(username, "processing", "Analyse IA profonde...", 50)
    tasks = [_fuse(c) for c in clusters[:15]]
    results = await asyncio.gather(*tasks)
    kept = [r for r in results if r and r.keep]

    # 4. Digest
    titles = "\n".join([f"- {v.localized_title}" for v in kept[:10]])
    digest = await call_llm(f"Résume ces actus en 3 phrases: \n{titles}", "Tu es un synthétiseur de news.")

    # 5. Store
    store_daily_brief(user["id"], {"global_digest": digest, "content": [k.model_dump() for k in kept]})
    set_generation_status(username, "done", "Briefing prêt !", 100)

# ══════════════════════════════════════════════════════════════════════════════
# 8. API ENDPOINTS (FastAPI)
# ══════════════════════════════════════════════════════════════════════════════
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 NewsAI Compact Ready.")
    yield

app = FastAPI(title="NewsAI Compact", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/api/brief")
def get_brief(request: Request, date: Optional[str] = None):
    p = get_current_user(request)
    brief = None
    if os.getenv("APP_STAGE") == "development":
        with open(_dx_cache_path(f"brief_{p['user_id']}.json"), "r") as f: brief = json.load(f)
    else:
        res = get_supabase().table("daily_briefs").select("*").eq("user_id", p["user_id"]).eq("date", date or datetime.now().date().isoformat()).execute()
        brief = res.data[0] if res.data else None
    return brief or {"content": []}

@app.get("/api/brief/status")
def get_status(request: Request):
    p = get_current_user(request)
    if os.getenv("APP_STAGE") == "development":
        with open(_dx_cache_path(f"status_{p['username']}.json"), "r") as f: return json.load(f)
    res = get_supabase().table("generation_status").select("*").eq("username", p["username"]).execute()
    return res.data[0] if res.data else {"status": "idle"}

@app.post("/api/brief/generate")
def generate(request: Request, bg: BackgroundTasks):
    p = get_current_user(request)
    bg.add_task(run_pipeline, p["username"])
    return {"status": "processing"}

@app.get("/api/profile")
def get_profile(request: Request):
    p = get_current_user(request)
    return get_user_by_id(p["user_id"])

@app.get("/api/health")
def health(): return {"status": "pulsing", "version": "compact-v1"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
