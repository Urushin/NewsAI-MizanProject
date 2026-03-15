"""
NewsAI — Database (Supabase / Postgres)
"""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from loguru import logger
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

_client: Optional[Client] = None

def get_supabase() -> Client:
    global _client
    if _client is None:
        supabase_url = os.getenv("SUPABASE_URL", "https://jekshjfyxvnmbqyuaosu.supabase.co")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impla3NoamZ5eHZubWJxeXVhb3N1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjEzNzgwNiwiZXhwIjoyMDg3NzEzODA2fQ.X8G0oIxITZxh0YLorMAioeyobdGsQAfplTfYEOp0vGU"
        if not supabase_url or not supabase_key:
            logger.error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/ANON_KEY missing in .env")
            raise ValueError("Supabase credentials missing")
        _client = create_client(supabase_url, supabase_key)
    return _client

def init_db():
    """Supabase tables should be initialized via the SQL Editor."""
    logger.info("📡 Connecté à Supabase.")

# --- Content Cache (Firecrawl) ---

def get_cached_content(url: str) -> Optional[str]:
    """Returns cached content from Supabase url_cache table."""
    try:
        sb = get_supabase()
        res = sb.table("url_cache").select("content").eq("url", url).execute()
        return res.data[0]["content"] if res.data else None
    except Exception as e:
        logger.error(f"Supabase cache error: {e}")
        return None

def cache_content(url: str, content: str):
    """Saves extracted content to Supabase cache."""
    try:
        sb = get_supabase()
        sb.table("url_cache").upsert({"url": url, "content": content, "fetched_at": datetime.now(timezone.utc).isoformat()}).execute()
    except Exception as e:
        logger.error(f"Supabase cache insert error: {e}")

# --- User & Profile Management ---

def get_user_by_username(username: str) -> Optional[dict]:
    """Fetch user profile by username."""
    try:
        sb = get_supabase()
        res = sb.table("profiles").select("*").eq("username", username).execute()
        if res.data:
            return res.data[0]
        return None
    except Exception as e:
        logger.error(f"Supabase user error by username: {e}")
        return None

def get_user_by_id(user_id: str) -> Optional[dict]:
    """Fetch user profile by UUID."""
    try:
        sb = get_supabase()
        res = sb.table("profiles").select("*").eq("id", user_id).execute()
        if res.data:
            return res.data[0]
        return None
    except Exception as e:
        logger.error(f"Supabase user error by id: {e}")
        return None

def update_user_profile(user_id: str, updates: Dict[str, Any]):
    """Update user profile fields (JSONB). Uses upsert to ensure the record exists."""
    try:
        sb = get_supabase()
        sb.table("profiles").update(updates).eq("id", user_id).execute()
        logger.info(f"✅ Profil mis à jour pour {user_id}")
    except Exception as e:
        logger.error(f"Supabase profile update error: {e}")
        raise e

# --- Embedding Vectors (pgvector) ---

def store_manifesto_embedding(user_id: str, embedding: List[float]):
    """Save the user's manifesto embedding vector."""
    try:
        sb = get_supabase()
        sb.table("manifesto_embeddings").upsert({
            "user_id": user_id, 
            "embedding": embedding
        }).execute()
        logger.info(f"✅ Manifesto vector saved for {user_id}")
    except Exception as e:
        logger.error(f"Supabase manifesto vector update error: {e}")

def store_article_embeddings(article_data: List[dict]):
    """Save batch of scraped articles and their vectors."""
    if not article_data: return
    try:
        sb = get_supabase()
        # article_data should contain: url, title, content, source_interest, embedding
        sb.table("article_embeddings").upsert(article_data, on_conflict="url").execute()
    except Exception as e:
        logger.error(f"Supabase article vector insert error: {e}")

def match_articles(query_embedding: List[float], match_count: int = 5) -> List[dict]:
    """Perform Cosine Similarity match against pgvector in Postgres via RPC."""
    try:
        sb = get_supabase()
        res = sb.rpc("match_articles", {"query_embedding": query_embedding, "match_count": match_count}).execute()
        return res.data or []
    except Exception as e:
        logger.error(f"Supabase RPC match_articles error: {e}")
        return []

def get_manifesto_embedding(user_id: str) -> Optional[List[float]]:
    try:
        sb = get_supabase()
        res = sb.table("manifesto_embeddings").select("embedding").eq("user_id", user_id).execute()
        return res.data[0]["embedding"] if res.data else None
    except Exception:
        return None

# --- Processed Articles (Anti-Doublon) ---

def record_processed_urls(user_id: str, urls: List[str]):
    """Record a batch of article URLs as processed in Supabase."""
    if not urls: return
    try:
        sb = get_supabase()
        data = [{"user_id": user_id, "url": url} for url in urls]
        sb.table("processed_articles").insert(data).execute()
    except Exception as e:
        logger.error(f"Supabase record error: {e}")

def get_recent_processed_urls(user_id: str, days: int = 7) -> set:
    """Return the set of article URLs processed recently from Supabase."""
    try:
        sb = get_supabase()
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        res = sb.table("processed_articles").select("url").eq("user_id", user_id).gte("processed_at", cutoff).execute()
        return {r["url"] for r in res.data}
    except Exception as e:
        logger.error(f"Supabase processed fetch error: {e}")
        return set()

# --- Daily Brief Persistence ---

def store_daily_brief(user_id: str, brief_data: dict, date_str: Optional[str] = None):
    """Store generated brief in Supabase."""
    date_str = date_str or brief_data.get("date")
    data_for_supabase = {
        "user_id": user_id,
        "global_digest": brief_data.get("global_digest"),
        "content": brief_data.get("content", []),
        "date": date_str
    }
    try:
        sb = get_supabase()
        sb.table("daily_briefs").upsert(data_for_supabase, on_conflict="user_id,date").execute()
        logger.info(f"✅ Brief enregistré dans Supabase pour {user_id}.")
    except Exception as e:
        logger.error(f"Supabase brief store error: {e}")

def get_daily_sources(user_id: str) -> dict:
    """Fetch the scanned sources. (Fallback to empty as file caching is removed)."""
    return {"sources_scanned": [], "raw_articles": [], "used_articles": []}


def get_daily_brief(user_id: str, date: Optional[str] = None) -> Optional[dict]:
    """Fetch daily brief from Supabase."""
    try:
        sb = get_supabase()
        query = sb.table("daily_briefs").select("*").eq("user_id", user_id)
        if date:
            query = query.eq("date", date)
        else:
            query = query.order("date", desc=True).limit(1)
        res = query.execute()
        if res.data:
            return res.data[0]
    except Exception as e:
        logger.error(f"Supabase brief fetch error: {e}")
    return None


# --- Status / Realtime ---

def store_feedback(user_id: str, article_title: str, action: str, summary: str = ""):
    """Save user interaction feedback to Supabase."""
    try:
        sb = get_supabase()
        sb.table("feedbacks").insert({
            "user_id": user_id,
            "article_title": article_title,
            "article_summary": summary,
            "action": action,
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()
    except Exception as e:
        logger.error(f"Supabase feedback error: {e}")

def set_generation_status(username: str, status: str, step: str, percent: int):
    """Update generation status in Supabase."""
    try:
        sb = get_supabase()
        sb.table("generation_status").upsert({
            "username": username,
            "status": status,
            "step": step,
            "percent": percent,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).execute()
    except Exception as e:
        logger.error(f"Supabase status save error: {e}")

def get_generation_status(username: str) -> dict:
    """Fetch generation status from Supabase."""
    try:
        sb = get_supabase()
        res = sb.table("generation_status").select("*").eq("username", username).execute()
        if res.data:
            return res.data[0]
    except Exception as e:
        logger.error(f"Supabase status fetch error: {e}")
    return {"status": "idle", "percent": 0, "step": ""}
