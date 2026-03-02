"""
Mizan.ai — CRON Scheduler

Generates daily briefs for all active users.
Run via crontab, Vercel CRON, Railway CRON, or GitHub Actions.

Usage:
    # Direct execution (crontab — every day at 7:00 AM)
    0 7 * * * cd /path/to/project && .venv/bin/python backend/scheduler.py

    # Or via API trigger
    curl -X POST https://your-api.com/api/scheduler/trigger \
      -H "Authorization: Bearer $SCHEDULER_SECRET"
"""
import os
import sys
import pathlib
from datetime import datetime, timezone
from loguru import logger

# Setup path
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
root_dir = pathlib.Path(__file__).parent.parent.resolve()
load_dotenv(str(root_dir / '.env'))

from database import get_supabase
from job_queue import enqueue_job
from stripe_billing import get_user_plan, PlanTier, PLAN_LIMITS


def schedule_daily_briefs():
    """Enqueue brief generation jobs for all active users.
    
    Logic:
    1. Fetch all users with profiles
    2. Skip users who already have a brief for today
    3. Enqueue jobs with priority based on plan tier
    """
    sb = get_supabase()
    today = datetime.now(timezone.utc).date().isoformat()

    logger.info(f"📅 Scheduler started for {today}")

    # 1. Fetch all user profiles
    try:
        res = sb.table("profiles").select("id, username, language, score_threshold").execute()
        users = res.data or []
    except Exception as e:
        logger.error(f"Failed to fetch users: {e}")
        return {"status": "error", "error": str(e)}

    if not users:
        logger.warning("No users found")
        return {"status": "ok", "scheduled": 0}

    # 2. Fetch today's already-generated briefs
    try:
        briefs_res = (
            sb.table("daily_briefs")
            .select("user_id")
            .eq("date", today)
            .execute()
        )
        already_done = {b["user_id"] for b in (briefs_res.data or [])}
    except Exception:
        already_done = set()

    # 3. Enqueue jobs for users who haven't gotten today's brief
    scheduled = 0
    skipped = 0

    for user in users:
        user_id = user["id"]

        if user_id in already_done:
            skipped += 1
            continue

        # Determine priority based on plan
        plan_info = get_user_plan(user_id, sb)
        tier = PlanTier(plan_info["plan"])
        priority = 1 if tier in (PlanTier.PRO, PlanTier.ENTERPRISE) else 0

        try:
            enqueue_job(
                job_type="generate_brief",
                payload={
                    "username": user["username"],
                    "language": user.get("language", "fr"),
                    "score_threshold": user.get("score_threshold", 70),
                },
                user_id=user_id,
                priority=priority,
            )
            scheduled += 1
        except Exception as e:
            logger.error(f"Failed to enqueue for {user['username']}: {e}")

    logger.info(
        f"📋 Scheduler done: {scheduled} jobs queued, {skipped} already done, "
        f"{len(users)} total users"
    )

    return {
        "status": "ok",
        "date": today,
        "scheduled": scheduled,
        "skipped": skipped,
        "total_users": len(users),
    }


if __name__ == "__main__":
    result = schedule_daily_briefs()
    print(f"\n📊 Result: {result}")
