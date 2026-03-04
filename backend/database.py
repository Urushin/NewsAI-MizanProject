"""
Mizan.ai — Database (Supabase / Postgres)
"""
import os
from datetime import datetime, timedelta
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
        sb.table("url_cache").upsert({"url": url, "content": content, "fetched_at": datetime.utcnow().isoformat()}).execute()
    except Exception as e:
        logger.error(f"Supabase cache insert error: {e}")

# --- User & Profile Management ---

def get_user_by_username(username: str) -> Optional[dict]:
    """Fetch user profile by username. In development, returns a mock if missing."""
    try:
        sb = get_supabase()
        res = sb.table("profiles").select("*").eq("username", username).execute()
        if res.data:
            return res.data[0]
        
        # DEV MOCK: Enable local development without manual Supabase entries
        if os.getenv("APP_STAGE") == "development":
            logger.info(f"🛠️  [DEV] Mocking user profile for username '{username}'")
            return {
                "id": "00000000-0000-0000-0000-000000000000",
                "username": username or "DevUser",
                "language": "fr",
                "score_threshold": 70,
                "identity": {"name": "Dev User", "role": "Journaliste"},
                "interests": {}, # Removed hardcoded AI/Tech tags to allow manifesto override
                "rejection_rules": []
            }
        return None
    except Exception as e:
        logger.error(f"Supabase user error: {e}")
        return None

def get_user_by_id(user_id: str) -> Optional[dict]:
    """Fetch user profile by UUID. In development, returns a mock if missing."""
    try:
        sb = get_supabase()
        res = sb.table("profiles").select("*").eq("id", user_id).execute()
        if res.data:
            return res.data[0]
        
        # DEV MOCK
        if os.getenv("APP_STAGE") == "development":
            logger.info(f"🛠️  [DEV] Mocking user profile for ID '{user_id}'")
            return {
                "id": user_id,
                "username": "DevUser",
                "language": "fr",
                "score_threshold": 70,
                "identity": {"name": "Dev User", "role": "Journaliste"},
                "interests": {},
                "rejection_rules": []
            }
        return None
    except Exception as e:
        logger.error(f"Supabase status error: {e}")
        return None

def update_user_profile(user_id: str, updates: Dict[str, Any]):
    """Update user profile fields (JSONB). Uses upsert to ensure the record exists."""
    try:
        sb = get_supabase()
        # Use upsert instead of update so the mock DevUser's profile gets created in DB on first save
        data = {"id": user_id, **updates}
        sb.table("profiles").upsert(data).execute()
        logger.info(f"✅ Profil mis à jour/créé pour {user_id}")
    except Exception as e:
        logger.error(f"Supabase profile update error: {e}")

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
        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
        res = sb.table("processed_articles").select("url").eq("user_id", user_id).gte("processed_at", cutoff).execute()
        return {r["url"] for r in res.data}
    except Exception as e:
        logger.error(f"Supabase processed fetch error: {e}")
        return set()

# --- Daily Brief Persistence ---

def store_daily_brief(user_id: str, brief_data: dict):
    """Save the final brief to Supabase instead of JSON."""
    try:
        sb = get_supabase()
        sb.table("daily_briefs").upsert({
            "user_id": user_id,
            "global_digest": brief_data.get("global_digest"),
            "content": brief_data.get("content", []),
            "date": datetime.now().date().isoformat()
        }, on_conflict="user_id,date").execute()
        logger.info("✅ Brief enregistré dans Supabase.")
    except Exception as e:
        logger.error(f"Supabase brief store error: {e}")

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
            "created_at": datetime.utcnow().isoformat()
        }).execute()
    except Exception as e:
        logger.error(f"Supabase feedback error: {e}")

def set_generation_status(username: str, status: str, step: str, percent: int):
    """
    Note: Supabase doesn't have a direct equivalent to SQLite's INSERT OR REPLACE for this.
    We'll use an 'upsert' pattern.
    """
    try:
        sb = get_supabase()
        sb.table("generation_status").upsert({
            "username": username,
            "status": status,
            "step": step,
            "percent": percent,
            "updated_at": datetime.utcnow().isoformat()
        }).execute()
    except Exception:
        pass

def get_generation_status(username: str) -> dict:
    try:
        sb = get_supabase()
        res = sb.table("generation_status").select("*").eq("username", username).execute()
        if res.data:
            return res.data[0]
    except Exception:
        pass
    return {"status": "idle", "percent": 0, "step": ""}
