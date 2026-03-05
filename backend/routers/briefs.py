from fastapi import APIRouter, HTTPException, Request, BackgroundTasks, Query
from typing import Optional
from database import get_supabase, get_generation_status, get_user_by_id, get_user_by_username, get_daily_brief
from auth import get_current_user
from quotas import check_brief_quota, QuotaExceeded
from stripe_billing import get_user_plan
from job_queue import enqueue_job

router = APIRouter(prefix="/api/brief", tags=["briefs"])

@router.get("")
def get_brief(request: Request, date: Optional[str] = None):
    payload = get_current_user(request)

    brief = get_daily_brief(payload["user_id"], date)
    if not brief:
        return {"content": []}

    return {
        "date": brief["date"],
        "global_digest": brief.get("global_digest"),
        "content": brief.get("content", []),
        "total_kept": len(brief.get("content", [])),
    }

@router.get("/history")
def get_brief_history(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
):
    payload = get_current_user(request)
    sb = get_supabase()
    offset = (page - 1) * per_page

    res = (
        sb.table("daily_briefs")
        .select("date, global_digest", count="exact")
        .eq("user_id", payload["user_id"])
        .order("date", desc=True)
        .range(offset, offset + per_page - 1)
        .execute()
    )

    total = res.count if hasattr(res, 'count') and res.count else len(res.data)
    return {
        "dates": res.data,
        "page": page,
        "per_page": per_page,
        "total": total,
    }

@router.post("/generate")
def generate_brief(request: Request, background_tasks: BackgroundTasks, mode: str = "prod"):
    import os
    payload = get_current_user(request)
    user_id = payload["user_id"]
    sb = get_supabase()
    
    # DEV MODE: the fake UUID doesn't exist in DB, run pipeline directly
    is_dev = os.getenv("APP_STAGE") == "development"
    
    user = get_user_by_id(user_id) or {}

    username = user.get("username", payload.get("username", ""))
    language = user.get("language", "fr")
    threshold = user.get("score_threshold", 70)

    # In dev mode without a real profile, use defaults from the auth payload
    if is_dev and (not user or user.get("id") == "00000000-0000-0000-0000-000000000000"):
        username = payload.get("username", "DevUser")

    try:
        check_brief_quota(user_id, sb)
    except QuotaExceeded as e:
        raise HTTPException(status_code=429, detail=str(e))

    # Reset status so frontend doesn't see old "done" status
    from database import set_generation_status
    set_generation_status(username, "pending", "Initializing...", 0)

    if mode == "test" or is_dev:
        # Synchronous execution (dev shortcut or explicit test mode)
        # Keep the actual requested mode so "prod" saves to DB via store_daily_brief
        from pipeline import run_pipeline_for_user
        return run_pipeline_for_user(username, language, threshold, mode=mode)

    plan_info = get_user_plan(user_id, sb)
    priority = 1 if plan_info["plan"] in ("pro", "enterprise") else 0

    job = enqueue_job(
        job_type="generate_brief",
        payload={"username": username, "language": language, "score_threshold": threshold},
        user_id=user_id,
        priority=priority,
    )
    return {"message": "Generation queued", "status": "queued", "job_id": job.get("id")}

@router.get("/status")
def get_brief_status(request: Request):
    payload = get_current_user(request)
    username = payload.get("username", "")
    return get_generation_status(username)

# Decision Engine Implementation
@router.post("/trigger-check")
def trigger_brief_check(request: Request):
    from datetime import datetime
    import pytz
    
    payload = get_current_user(request)
    user_id = payload["user_id"]
    sb = get_supabase()
    
    # 1. Check if brief already generated today
    today_str = datetime.now(pytz.utc).strftime("%Y-%m-%d")
    res_briefs = sb.table("daily_briefs").select("id").eq("user_id", user_id).eq("date", today_str).execute()
    if res_briefs.data:
        return {"status": "already_generated", "message": "Un brief existe déjà pour aujourd'hui."}
        
    # 2. Check if a job is already pending or processing
    res_jobs = sb.table("job_queue").select("id").eq("user_id", user_id).eq("job_type", "generate_brief").in_("status", ["pending", "processing", "retry"]).execute()
    if res_jobs.data:
        return {"status": "queued", "message": "Génération déjà en cours."}

    # 3. Check quotas and enqueue
    user = get_user_by_id(user_id) or {}
    username = user.get("username", payload.get("username", ""))
    language = user.get("language", "fr")
    threshold = user.get("score_threshold", 70)

    try:
        check_brief_quota(user_id, sb)
    except QuotaExceeded as e:
        raise HTTPException(status_code=429, detail=str(e))

    plan_info = get_user_plan(user_id, sb)
    priority = 1 if plan_info["plan"] in ("pro", "enterprise") else 0

    # Reset status
    from database import set_generation_status
    set_generation_status(username, "pending", "Initializing...", 0)

    job = enqueue_job(
        job_type="generate_brief",
        payload={"username": username, "language": language, "score_threshold": threshold},
        user_id=user_id,
        priority=priority,
    )
    
    return {"status": "queued", "message": "Génération lancée.", "job_id": job.get("id")}
