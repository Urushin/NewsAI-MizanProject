"""
Mizan.ai — Database (Supabase / Postgres)
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

# --- DX Mode Helpers ---
_DX_MOCK_USER_ID = "00000000-0000-0000-0000-000000000000"

def _is_dx_fk_error(user_id: str, error: Exception) -> bool:
    """Check if this is a FK violation for the mock user in development mode."""
    return (
        os.getenv("APP_STAGE") == "development"
        and user_id == _DX_MOCK_USER_ID
        and "23503" in str(error)
    )

def _dx_cache_path(filename: str) -> str:
    """Get path in local DX cache directory, creating it if needed."""
    cache_dir = os.path.join(os.path.dirname(__file__), "cache")
    os.makedirs(cache_dir, exist_ok=True)
    return os.path.join(cache_dir, filename)

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

def _get_mock_profile(user_id: str = "00000000-0000-0000-0000-000000000000", username: str = "DevUser") -> dict:
    """Centralized mock profile for local development (DX)."""
    return {
        "id": user_id,
        "username": username or "DevUser",
        "language": "fr",
        "score_threshold": 70,
        "identity": {"name": "Dev User", "role": "Journaliste"},
        "interests": {},
        "rejection_rules": []
    }

def get_user_by_username(username: str) -> Optional[dict]:
    """Fetch user profile by username. In development, returns a mock if missing."""
    try:
        # DX MODE: Try local JSON fallback FIRST to capture modified interests
        if os.getenv("APP_STAGE") == "development" and username in ("DevUser", "Dev User", ""):
            import json as _json
            path = _dx_cache_path(f"profile_{_DX_MOCK_USER_ID}.json")
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    logger.info(f"🛠️ [DX] Profil chargé localement pour username '{username}'")
                    return _json.load(f)

        sb = get_supabase()
        res = sb.table("profiles").select("*").eq("username", username).execute()
        if res.data:
            return res.data[0]
        
        # DEV MOCK: Enable local development without manual Supabase entries
        if os.getenv("APP_STAGE") == "development":
            logger.info(f"🛠️  [DEV] Mocking initial user profile for username '{username}'")
            return _get_mock_profile(username=username)
        return None
    except Exception as e:
        logger.error(f"Supabase user error: {e}")
        return None

def get_user_by_id(user_id: str) -> Optional[dict]:
    """Fetch user profile by UUID. In development, returns a mock if missing, priorities local cache."""
    try:
        # DX MODE: Try local JSON fallback FIRST
        if os.getenv("APP_STAGE") == "development" and user_id == _DX_MOCK_USER_ID:
            import json as _json
            path = _dx_cache_path(f"profile_{user_id}.json")
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    logger.info(f"🛠️ [DX] Profil chargé depuis le cache local")
                    return _json.load(f)

        sb = get_supabase()
        res = sb.table("profiles").select("*").eq("id", user_id).execute()
        if res.data:
            return res.data[0]
        
        # DEV MOCK fallback if no local cache exists
        if os.getenv("APP_STAGE") == "development":
            logger.info(f"🛠️  [DEV] Mocking initial user profile for ID '{user_id}'")
            return _get_mock_profile(user_id=user_id)
        return None
    except Exception as e:
        logger.error(f"Supabase status error: {e}")
        return None

def update_user_profile(user_id: str, updates: Dict[str, Any]):
    """Update user profile fields (JSONB). Uses upsert to ensure the record exists."""
    try:
        # DX MODE: Handle mock user via local file
        if os.getenv("APP_STAGE") == "development" and user_id == _DX_MOCK_USER_ID:
            import json as _json
            path = _dx_cache_path(f"profile_{user_id}.json")
            
            # Load existing or mock
            current_profile = {}
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    current_profile = _json.load(f)
            else:
                current_profile = _get_mock_profile(user_id=user_id)
            
            # Merge updates
            current_profile.update(updates)
            
            # Save
            with open(path, "w", encoding="utf-8") as f:
                _json.dump(current_profile, f, ensure_ascii=False)
            logger.info(f"✅ [DX] Profil mis à jour localement -> {path}")
            return

        sb = get_supabase()
        # Use upsert instead of update so the mock DevUser's profile gets created in DB on first save
        data = {"id": user_id, **updates}
        sb.table("profiles").upsert(data).execute()
        logger.info(f"✅ Profil mis à jour/créé pour {user_id}")
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
        if _is_dx_fk_error(user_id, e):
            logger.debug("🛠️ [DX] Skipping processed_articles save (mock user)")
            return
        logger.error(f"Supabase record error: {e}")

def get_recent_processed_urls(user_id: str, days: int = 7) -> set:
    """Return the set of article URLs processed recently from Supabase."""
    # DX MODE: Return empty set so developers can test repeatedly
    if os.getenv("APP_STAGE") == "development":
        return set()
    try:
        sb = get_supabase()
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        res = sb.table("processed_articles").select("url").eq("user_id", user_id).gte("processed_at", cutoff).execute()
        return {r["url"] for r in res.data}
    except Exception as e:
        logger.error(f"Supabase processed fetch error: {e}")
        return set()

# --- Daily Brief Persistence ---

def store_daily_brief(user_id: str, brief_data: dict):
    """Save the final brief to Supabase, with local JSON fallback for DX mode."""
    import json as _json
    date_str = datetime.now().date().isoformat()
    # Save sources locally to avoid Supabase DB schema mismatch and save space
    sources = brief_data.get("sources_scanned", [])
    if sources:
        sources_path = _dx_cache_path(f"sources_{user_id}.json")
        try:
            with open(sources_path, "w", encoding="utf-8") as f:
                _json.dump({"date": date_str, "sources_scanned": sources}, f, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Failed to cache sources locally: {e}")

    # Prepare data for Supabase (without sources_scanned)
    data_for_supabase = {
        "user_id": user_id,
        "global_digest": brief_data.get("global_digest"),
        "content": brief_data.get("content", []),
        "date": date_str
    }
    try:
        sb = get_supabase()
        sb.table("daily_briefs").upsert(data_for_supabase, on_conflict="user_id,date").execute()
        logger.info("✅ Brief enregistré dans Supabase.")
    except Exception as e:
        if _is_dx_fk_error(user_id, e) or os.getenv("APP_STAGE") == "development":
            path = _dx_cache_path(f"brief_{user_id}.json")
            with open(path, "w", encoding="utf-8") as f:
                _json.dump(data_for_supabase, f, ensure_ascii=False)
            logger.info(f"🛠️ [DX] Brief sauvegardé localement → {path}")
            return
        logger.error(f"Supabase brief store error: {e}")

def get_daily_sources(user_id: str) -> list:
    """Fetch the scanned sources associated with the latest brief from local cache."""
    import json as _json
    path = _dx_cache_path(f"sources_{user_id}.json")
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = _json.load(f)
                return data.get("sources_scanned", [])
        except Exception:
            pass
    return []


def get_daily_brief(user_id: str, date: Optional[str] = None) -> Optional[dict]:
    """Fetch daily brief from Supabase, with local JSON fallback for DX mode."""
    import json as _json
    # DX MODE: Try local JSON fallback FIRST to allow rapid developer iteration
    if os.getenv("APP_STAGE") == "development":
        path = _dx_cache_path(f"brief_{user_id}.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                local = _json.load(f)
                if not date or local.get("date") == date:
                    logger.info(f"🛠️ [DX] Brief chargé depuis le cache local (priorité DX)")
                    return local
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
        if _is_dx_fk_error(user_id, e):
            logger.debug("🛠️ [DX] Skipping feedback save (mock user)")
            return
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
            "updated_at": datetime.now(timezone.utc).isoformat()
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
