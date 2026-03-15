from fastapi import APIRouter, HTTPException, Request, BackgroundTasks, Query
from typing import Optional
from database import get_supabase, get_generation_status, get_user_by_id, get_user_by_username, get_daily_brief, get_daily_sources
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
        "youtube_videos": brief.get("youtube_videos", []),
        "total_kept": len(brief.get("content", [])),
    }

@router.get("/sources")
def get_sources_scanned(request: Request):
    payload = get_current_user(request)
    return get_daily_sources(payload["user_id"])

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
def generate_brief(request: Request, background_tasks: BackgroundTasks, mode: str = "prod", force: bool = False):
    import os
    payload = get_current_user(request)
    user_id = payload["user_id"]
    sb = get_supabase()
    
    # DEV MODE: the fake UUID doesn't exist in DB, run pipeline directly
    is_dev = os.getenv("APP_STAGE") == "development"
    
    user = get_user_by_id(user_id) or {}

    # In production, we strictly use the user profile from DB
    if not user:
        raise HTTPException(status_code=404, detail="Profil utilisateur introuvable")

    username = user.get("username", payload.get("username", ""))
    language = user.get("language", "fr")
    threshold = user.get("score_threshold", 70)

    try:
        check_brief_quota(user_id, sb)
    except QuotaExceeded as e:
        raise HTTPException(status_code=429, detail=str(e))

    # Reset status so frontend doesn't see old "done" status
    from database import set_generation_status
    set_generation_status(username, "pending", "Initializing...", 0)

    from pipeline import _run_pipeline_for_user_async

    if mode == "test" or is_dev:
        # Avoid blocking the main thread/event loop. Use background tasks even in dev/test.
        background_tasks.add_task(_run_pipeline_for_user_async, username, language, threshold, mode, force)
        return {"message": "Generation started in background", "status": "processing"}

    plan_info = get_user_plan(user_id, sb)
    priority = 1 if plan_info["plan"] in ("pro", "enterprise") else 0

    try:
        job = enqueue_job(
            job_type="generate_brief",
            payload={"username": username, "language": language, "score_threshold": threshold, "force": force},
            user_id=user_id,
            priority=priority,
        )
        return {"message": "Generation queued", "status": "queued", "job_id": job.get("id")}
    except Exception as e:
        # Fallback: if job_queue insert fails (e.g. RLS), run pipeline directly
        from loguru import logger
        logger.warning(f"Job queue insert failed ({e}), falling back to direct background task")
        from pipeline import _run_pipeline_for_user_async
        background_tasks.add_task(_run_pipeline_for_user_async, username, language, threshold, "prod", force)
        return {"message": "Generation started in background (direct)", "status": "processing"}

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

    # Check plan for priority
    plan_info = get_user_plan(user_id, sb)
    priority = 1 if plan_info.get("plan") in ("pro", "enterprise") else 0

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


from pydantic import BaseModel
from llm_wrapper import get_providers
from collector import get_cached_content
import os

class AnalyzeRequest(BaseModel):
    link: str
    title: str
    language: str = "fr"

@router.post("/analyze")
async def analyze_article(request: Request, body: AnalyzeRequest):
    payload = get_current_user(request)
    sb = get_supabase()
    is_dev = os.getenv("APP_STAGE") == "development"
    
    plan_info = get_user_plan(payload["user_id"], sb)
    
    # We strictly gate the actual LLM call behind Pro plan, unless in Dev Mode
    if plan_info.get("plan") not in ("pro", "enterprise") and not is_dev:
        return {
            "status": "upgrade_required", 
            "analysis": "L'Intelligence Artificielle de NewsAI est capable de rédiger l'analyse détaillée de cet article, de croiser les sources et d'en extraire le contexte géopolitique caché.\n\nCependant, cette fonctionnalité demande des capacités de lecture poussées (Premium Tokens). Passez au plan Pro pour débloquer l'analyse approfondie de ce contenu."
        }
        
    providers = get_providers()
    if not providers:
        raise HTTPException(status_code=500, detail="No LLM provider available")
    llm = providers[0]
    
    content = get_cached_content(body.link)
    
    if not content:
        content = "Résumé indisponible car le contenu complet n'a pas pu être extrait de la source."

    prompt = f"Title: {body.title}\nContent:\n{content[:4000]}"
    sys_prompt = f"Tu es un journaliste analyste expert. Rédige une analyse détaillée, percutante et factuelle (environ 2 paragraphes) de l'article suivant. Donne du contexte et explique les enjeux cachés. Écris en {body.language}. N'écris pas d'introduction bateau, ne copie pas le titre, donne directement l'analyse textuelle."
    
    try:
        analysis = await llm.generate(prompt, sys_prompt, max_tokens=600)
        return {"status": "success", "analysis": analysis.strip(), "used_cache": bool(content)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
