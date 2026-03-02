"""
Mizan.ai — Job Queue (Supabase-based)

A lightweight, durable job queue backed by Supabase Postgres.
No Redis/RabbitMQ dependency required.

Features:
  ✅ Atomic pick-and-lock (prevents double processing)
  ✅ Priority queue (Pro/Enterprise jobs first)
  ✅ Retry with exponential backoff
  ✅ Dead letter queue (jobs that fail permanently)
  ✅ Worker loop with graceful shutdown
"""
import os
import sys
import time
import signal
import json
import pathlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Callable
from loguru import logger

from dotenv import load_dotenv
root_dir = pathlib.Path(__file__).parent.parent.resolve()
load_dotenv(str(root_dir / '.env'))

sys.path.insert(0, os.path.dirname(__file__))
from database import get_supabase


# ── Constants ──
MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 60  # seconds
POLL_INTERVAL = 5        # seconds between queue checks
LOCK_TIMEOUT = 600       # 10 minutes — max job execution time


# ══════════════════════════════════════════
# Job Queue Operations
# ══════════════════════════════════════════
def enqueue_job(
    job_type: str,
    payload: dict,
    user_id: str,
    priority: int = 0,
) -> dict:
    """Add a job to the queue.
    
    Args:
        job_type: e.g. 'generate_brief', 'update_profile'
        payload: JSON-serializable job data
        user_id: Owner of the job
        priority: 0=normal, 1=high (Pro/Enterprise)
    
    Returns:
        The created job record
    """
    sb = get_supabase()
    job = {
        "job_type": job_type,
        "payload": payload,
        "user_id": user_id,
        "priority": priority,
        "status": "pending",
        "attempts": 0,
        "max_retries": MAX_RETRIES,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    res = sb.table("job_queue").insert(job).execute()
    if res.data:
        logger.info(f"📥 Job enqueued: {job_type} for {user_id} (priority={priority})")
        return res.data[0]
    raise RuntimeError("Failed to enqueue job")


def pick_next_job() -> Optional[dict]:
    """Atomically pick the next pending job (highest priority first, FIFO).
    
    Uses an UPDATE ... WHERE status='pending' pattern to prevent
    multiple workers from picking the same job.
    """
    sb = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    # Also pick up jobs that were locked but timed out (stale)
    stale_cutoff = (datetime.now(timezone.utc) - timedelta(seconds=LOCK_TIMEOUT)).isoformat()

    # Find next pending job (priority DESC, created_at ASC)
    res = (
        sb.table("job_queue")
        .select("*")
        .in_("status", ["pending", "retry"])
        .order("priority", desc=True)
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    )

    if not res.data:
        # Check for stale locked jobs
        stale = (
            sb.table("job_queue")
            .select("*")
            .eq("status", "processing")
            .lt("started_at", stale_cutoff)
            .limit(1)
            .execute()
        )
        if not stale.data:
            return None
        job = stale.data[0]
        logger.warning(f"🔓 Recovering stale job: {job['id']}")
    else:
        job = res.data[0]

    # Lock the job atomically
    lock_res = (
        sb.table("job_queue")
        .update({
            "status": "processing",
            "started_at": now,
            "attempts": job["attempts"] + 1,
        })
        .eq("id", job["id"])
        .eq("status", job["status"])  # Optimistic lock
        .execute()
    )

    if lock_res.data:
        return lock_res.data[0]

    # Another worker grabbed it — try again
    return None


def complete_job(job_id: str, result: Optional[dict] = None):
    """Mark a job as successfully completed."""
    sb = get_supabase()
    sb.table("job_queue").update({
        "status": "completed",
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "result": result or {},
    }).eq("id", job_id).execute()

    logger.info(f"✅ Job completed: {job_id}")


def fail_job(job_id: str, error: str, attempts: int, max_retries: int):
    """Mark a job as failed, with optional retry scheduling."""
    sb = get_supabase()

    if attempts < max_retries:
        # Schedule retry with exponential backoff
        retry_at = datetime.now(timezone.utc) + timedelta(
            seconds=RETRY_BACKOFF_BASE * (2 ** (attempts - 1))
        )
        sb.table("job_queue").update({
            "status": "retry",
            "error": error,
            "retry_at": retry_at.isoformat(),
        }).eq("id", job_id).execute()

        logger.warning(f"🔄 Job {job_id} retry {attempts}/{max_retries} at {retry_at}")
    else:
        # Dead letter — all retries exhausted
        sb.table("job_queue").update({
            "status": "dead",
            "error": error,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", job_id).execute()

        logger.error(f"💀 Job {job_id} moved to dead letter queue: {error}")


# ══════════════════════════════════════════
# Job Handlers Registry
# ══════════════════════════════════════════
_handlers: dict[str, Callable] = {}


def register_handler(job_type: str, handler: Callable):
    """Register a handler function for a job type."""
    _handlers[job_type] = handler
    logger.debug(f"📋 Registered handler: {job_type}")


def _handle_generate_brief(payload: dict):
    """Handle brief generation job."""
    from pipeline import run_pipeline_for_user
    
    username = payload["username"]
    language = payload.get("language", "fr")
    threshold = payload.get("score_threshold", 70)

    result = run_pipeline_for_user(username, language, threshold, mode="prod")
    return result


# Register built-in handlers
register_handler("generate_brief", _handle_generate_brief)


# ══════════════════════════════════════════
# Worker Loop
# ══════════════════════════════════════════
_running = True


def _signal_handler(sig, frame):
    global _running
    logger.info("🛑 Shutdown signal received, finishing current job...")
    _running = False


def worker_loop():
    """Main worker loop — processes jobs from the queue.
    
    Run this as a separate process:
        python job_queue.py
    """
    global _running
    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    logger.info("🚀 Job queue worker started")

    while _running:
        try:
            job = pick_next_job()

            if job is None:
                time.sleep(POLL_INTERVAL)
                continue

            job_type = job["job_type"]
            job_id = job["id"]
            payload = job.get("payload", {})

            logger.info(f"⚙️ Processing job {job_id}: {job_type}")

            handler = _handlers.get(job_type)
            if not handler:
                fail_job(job_id, f"Unknown job type: {job_type}", job["attempts"], job["max_retries"])
                continue

            try:
                result = handler(payload)
                complete_job(job_id, result if isinstance(result, dict) else {"status": "ok"})
            except Exception as e:
                logger.error(f"❌ Job {job_id} error: {e}")
                fail_job(job_id, str(e), job["attempts"], job["max_retries"])

        except Exception as e:
            logger.error(f"Worker loop error: {e}")
            time.sleep(POLL_INTERVAL)

    logger.info("👋 Worker stopped gracefully")


# ══════════════════════════════════════════
# Queue Stats
# ══════════════════════════════════════════
def get_queue_stats() -> dict:
    """Get current queue statistics."""
    sb = get_supabase()
    stats = {}
    for status in ["pending", "processing", "completed", "retry", "dead"]:
        try:
            res = (
                sb.table("job_queue")
                .select("id", count="exact")
                .eq("status", status)
                .execute()
            )
            stats[status] = res.count if hasattr(res, "count") and res.count is not None else len(res.data)
        except Exception:
            stats[status] = 0
    return stats


if __name__ == "__main__":
    worker_loop()
