import os
import time
from fastapi import APIRouter, Request, HTTPException
from database import get_supabase
from stripe_billing import STRIPE_AVAILABLE
from job_queue import get_queue_stats
from monitoring import get_metrics

router = APIRouter(prefix="/api", tags=["system"])

@router.get("/health")
def health_check():
    """Health check for monitoring."""
    try:
        sb = get_supabase()
        sb.table("profiles").select("id").limit(1).execute()
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "version": "6.0",
        "database": db_status,
        "stripe": "active" if STRIPE_AVAILABLE else "not_configured",
        "timestamp": time.time(),
    }

@router.get("/taxonomy")
def get_taxonomy():
    """Return the topic taxonomy for the onboarding wizard."""
    import json
    taxonomy_path = os.path.join(os.path.dirname(__file__), "..", "taxonomy.json")
    try:
        with open(taxonomy_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


SCHEDULER_SECRET = os.getenv("SCHEDULER_SECRET", "")

@router.post("/scheduler/trigger")
def trigger_scheduler(request: Request):
    """Trigger daily brief scheduler. Protected by SCHEDULER_SECRET."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "")

    if not SCHEDULER_SECRET or token != SCHEDULER_SECRET:
        raise HTTPException(status_code=403, detail="Invalid scheduler secret")

    from scheduler import schedule_daily_briefs
    return schedule_daily_briefs()

@router.get("/metrics")
def metrics():
    """Application metrics (latency, errors, uptime)."""
    return get_metrics()

@router.get("/queue/stats")
def queue_stats():
    """Job queue statistics."""
    return get_queue_stats()
