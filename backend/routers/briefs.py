from fastapi import APIRouter, HTTPException, Request, BackgroundTasks, Query
from typing import Optional
import os
import re
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


import hashlib
import json
from pathlib import Path

def _get_audit_cache_path(link: str) -> str:
    """Returns absolute path to cached audit file based on URL hash."""
    h = hashlib.md5(link.encode()).hexdigest()
    cache_dir = Path(__file__).parent.parent / "cache"
    cache_dir.mkdir(exist_ok=True)
    return str(cache_dir / f"audit_{h}.json")

async def _generate_deep_audit_data(link: str, title: str, summary: Optional[list[str]], language: str = "fr") -> dict:
    """Core logic: runs editorial LLM analysis + reliability engine in parallel."""
    from llm_wrapper import get_providers
    from collector import get_cached_content
    from reliability_engine import InformationAnalyzerAgent
    
    providers = get_providers()
    if not providers:
        raise Exception("No LLM provider available")
    llm = providers[0]
    
    content = get_cached_content(link)
    if not content:
        content = "Résumé indisponible car le contenu complet n'a pas pu être extrait de la source."

    # ── Build editorial analysis prompt ──
    prompt = f"Titre: {title}\n\n"
    if summary:
        bullet_list = "\n".join([f"- {s}" for s in summary])
        prompt += f"POINTS CLÉS À DÉVELOPPER ET EXPLIQUER :\n{bullet_list}\n\n"
    
    prompt += f"Contenu source de l'article principal (pour contexte additionnel):\n{content[:4000]}"
    
    sys_prompt = f"""Tu es un journaliste analyste expert. Rédige une analyse globale, percutante et factuelle de la revue de presse ci-dessous en {language}. 
    
    RÈGLES CRUCIALES :
    - Ne commence JAMAIS ta synthèse par "L'article..." ou "L'article révèle" car il s'agit d'une synthèse condensante de plusieurs sujets. Entre directement dans le vif des faits.
    - Tu DOIS impérativement développer, expliquer et mettre en contexte CHACUN des "POINTS CLÉS À DÉVELOPPER" listés dans le prompt. Aucun point ne doit être oublié.
    - Ajoute du contexte analytique (géopolitique, économique, social...) pour chaque info afin d'aider l'utilisateur à bien en comprendre les enjeux.
    - Ton ton doit être éditorial, neutre et informatif.
    
    Insère des citations numérotées comme [1], [2] à la fin des phrases contenant des chiffres ou faits importants.
    
    À la toute fin de ta réponse, ajoute EXACTEMENT la structure suivante :
    === CITATIONS ===
    [1] « citation exacte à extraire du texte »
    [2] « autre citation exacte... »"""
    
    # ── Determine sources count for synthesis scoring ──
    sources_count = len(summary) if summary else 1
    combined_text = f"{title}\n\n{content[:4000]}"
    
    # ── Run editorial analysis + reliability engine IN PARALLEL ──
    import asyncio
    agent = InformationAnalyzerAgent()
    
    editorial_task = llm.generate(prompt, sys_prompt, max_tokens=850)
    reliability_task = agent.process(
        text=combined_text,
        url=link,
        title=title,
        sources_count=sources_count,
        llm=llm,
    )
    
    raw_output, verdict = await asyncio.gather(editorial_task, reliability_task)
    
    # ── Parse editorial output (citations) ──
    analysis_text = raw_output.strip()
    citations_dict = {}
    
    if "=== CITATIONS ===" in raw_output:
        parts = raw_output.split("=== CITATIONS ===")
        analysis_text = parts[0].strip()
        citations_section = parts[1].strip() if len(parts) > 1 else ""
        cite_entries = re.findall(r'\[(\d+)\]\s*([^\[]+)', citations_section)
        for num, text in cite_entries:
            citations_dict[num] = text.strip().strip('«»"\'')
    
    # ── Build backward-compatible audit_scores from verdict ──
    audit_scores = {
        "Source": {"score": max(1, min(5, verdict.source_reputation_score // 20)), "reason": f"Réputation domaine: {verdict.source_reputation_score}/100"},
        "Factualité": {"score": max(1, min(5, verdict.factual_score // 20)), "reason": f"Score factuel: {verdict.factual_score}/100"},
        "Manipulation": {"score": max(1, min(5, (100 - verdict.manipulation_score) // 20)), "reason": f"Indice manipulation: {verdict.manipulation_score}/100 (inversé)"},
    }
    
    # ── Extract highlights ──
    highlights = []
    if content and "Résumé indisponible" not in content:
        sents = re.split(r'(?<=[.!?])\s+', content)
        highlights = [s.strip() for s in sents if len(s.split()) >= 12][:3]
    
    return {
        "status": "success", 
        "analysis": analysis_text, 
        "citations": citations_dict, 
        "highlights": highlights,
        "audit_scores": audit_scores,
        "audit_reasons": [],
        "reliability_verdict": verdict.to_dict(),
        "used_cache": bool(content)
    }

async def pre_warm_deep_audit_task(articles: list, language: str = "fr"):
    """Background task to pre-warm deep audits for list of keep=True articles."""
    from loguru import logger
    logger.info(f"🔥 Pre-warming Deep Audits for {len(articles)} articles...")
    
    for a in articles:
        try:
            # support both dict and pydantic models
            link = a.link if hasattr(a, 'link') else a.get("link")
            title = a.localized_title if hasattr(a, 'localized_title') else a.get("localized_title", a.get("title"))
            summary = a.summary if hasattr(a, 'summary') else a.get("summary")
            
            if not link or not title: continue
            
            cache_path = _get_audit_cache_path(link)
            if Path(cache_path).exists():
                continue # Already warmed
                
            logger.debug(f"   Pre-warming: {title[:50]}...")
            data = await _generate_deep_audit_data(link, title, summary, language)
            if data and data.get("status") == "success":
                with open(cache_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning(f"   Pre-warm failed for {getattr(a, 'title', 'unknown') if hasattr(a, 'title') else 'unknown'}: {e}")

from pydantic import BaseModel

class AnalyzeRequest(BaseModel):
    link: str
    title: str
    language: str = "fr"
    summary: Optional[list[str]] = None

@router.post("/analyze")
async def analyze_article(request: Request, body: AnalyzeRequest):
    payload = get_current_user(request)
    sb = get_supabase()
    is_dev = os.getenv("APP_STAGE") == "development"
    
    plan_info = get_user_plan(payload["user_id"], sb)
    
    if plan_info.get("plan") not in ("pro", "enterprise") and not is_dev:
        return {
            "status": "upgrade_required", 
            "analysis": "L'Intelligence Artificielle de NewsAI est capable de rédiger l'analyse détaillée de cet article, de croiser les sources et d'en extraire le contexte géopolitique caché.\n\nCependant, cette fonctionnalité demande des capacités de lecture poussées (Premium Tokens). Passez au plan Pro pour débloquer l'analyse approfondie de ce contenu."
        }
    cache_path = _get_audit_cache_path(body.link)
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cached_data = json.load(f)
                cached_data["used_audit_cache"] = True  # Flag for monitoring
                return cached_data
        except: pass
        
    try:
        data = await _generate_deep_audit_data(body.link, body.title, body.summary, body.language)
        # Try caching on-demand too
        try:
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except: pass
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
