"""
Mizan.ai — API Server (Production-grade)

Features:
  ✅ Lifespan context manager
  ✅ Rate limiting middleware (IP-based)
  ✅ Monitoring middleware (latency, errors, p50/p95/p99)
  ✅ Pagination on list endpoints
  ✅ Health check + metrics endpoints
  ✅ Pydantic validation on all inputs
  ✅ Auth endpoints (Supabase Auth)
  ✅ Stripe billing (checkout, webhook, portal)
  ✅ Quotas per plan (Free/Pro/Enterprise)
  ✅ Job queue for brief generation
  ✅ Scheduler trigger endpoint
  ✅ CORS with env-based origins
"""
import os
import sys
import time
import pathlib
from collections import defaultdict
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List
from loguru import logger

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
root_dir = pathlib.Path(__file__).parent.parent.resolve()
load_dotenv(str(root_dir / '.env'))

from database import (
    init_db,
    get_user_by_username,
    update_user_profile,
    set_generation_status,
    get_generation_status,
    get_supabase,
    store_manifesto_embedding,
)
from auth import get_current_user
from feedback import router as feedback_router
from monitoring import monitoring_middleware, get_metrics
from quotas import check_brief_quota, get_usage_summary, QuotaExceeded
from job_queue import enqueue_job, get_queue_stats
from stripe_billing import (
    get_user_plan, create_checkout_session, create_portal_session,
    handle_stripe_webhook, PlanTier, STRIPE_AVAILABLE,
)


# ══════════════════════════════════════════
# Lifespan
# ══════════════════════════════════════════
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Mizan.ai API starting...")
    init_db()
    yield
    logger.info("🛑 Mizan.ai API shutting down...")


# ── App ──
app = FastAPI(
    title="Mizan.ai API",
    version="6.0 (SaaS)",
    lifespan=lifespan,
)


# ══════════════════════════════════════════
# CORS
# ══════════════════════════════════════════
_allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
_frontend_url = os.getenv("FRONTEND_URL", "")
if _frontend_url:
    _allowed_origins.append(_frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════
# Rate Limiting Middleware
# ══════════════════════════════════════════
RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX_REQUESTS = 60
_rate_limit_db: dict = defaultdict(list)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.url.path in ("/api/health", "/api/billing/webhook"):
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    now = time.time()

    _rate_limit_db[client_ip] = [
        t for t in _rate_limit_db[client_ip]
        if now - t < RATE_LIMIT_WINDOW
    ]

    if len(_rate_limit_db[client_ip]) >= RATE_LIMIT_MAX_REQUESTS:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Try again later."},
            headers={"Retry-After": str(RATE_LIMIT_WINDOW)},
        )

    _rate_limit_db[client_ip].append(now)
    response = await call_next(request)
    return response


# Monitoring middleware
app.middleware("http")(monitoring_middleware)

# Include feedback router
app.include_router(feedback_router)


# ══════════════════════════════════════════
# Health Check
# ══════════════════════════════════════════
@app.get("/api/health")
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


# ══════════════════════════════════════════
# Auth Endpoints
# ══════════════════════════════════════════
class SignupRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)
    username: str = Field(..., min_length=2, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")

class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)


@app.post("/api/auth/signup")
def signup(body: SignupRequest):
    sb = get_supabase()
    try:
        auth_res = sb.auth.sign_up({
            "email": body.email,
            "password": body.password,
            "options": {"data": {"username": body.username}},
        })

        if not auth_res.user:
            raise HTTPException(status_code=400, detail="Signup failed")

        user_id = auth_res.user.id

        sb.table("profiles").insert({
            "id": user_id,
            "username": body.username,
            "language": "fr",
            "score_threshold": 70,
            "identity": {},
            "interests": {},
            "rejection_rules": [],
            "preferences": {},
        }).execute()

        return {
            "message": "Compte créé",
            "user_id": user_id,
            "access_token": auth_res.session.access_token if auth_res.session else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/auth/login")
def login(body: LoginRequest):
    sb = get_supabase()
    try:
        auth_res = sb.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })

        if not auth_res.session:
            raise HTTPException(status_code=401, detail="Identifiants invalides")

        return {
            "access_token": auth_res.session.access_token,
            "refresh_token": auth_res.session.refresh_token,
            "user": {
                "id": auth_res.user.id,
                "email": auth_res.user.email,
                "username": auth_res.user.user_metadata.get("username", ""),
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=401, detail=str(e))


# ══════════════════════════════════════════
# Profile Endpoints
# ══════════════════════════════════════════
class UpdateProfileRequest(BaseModel):
    language: Optional[str] = Field(None, pattern=r"^(fr|en|ja|ar|es|de)$")
    score_threshold: Optional[int] = Field(None, ge=0, le=100)
    identity: Optional[dict] = None
    interests: Optional[dict] = None
    rejection_rules: Optional[List[str]] = Field(None, max_length=50)
    preferences: Optional[dict] = None


@app.get("/api/me")
def get_profile(request: Request):
    payload = get_current_user(request)
    sb = get_supabase()
    res = sb.table("profiles").select("*").eq("id", payload["user_id"]).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return res.data[0]


@app.put("/api/me/profile")
def update_full_profile(request: Request, body: UpdateProfileRequest):
    payload = get_current_user(request)
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if updates:
        update_user_profile(payload["user_id"], updates)
    return {"status": "ok"}


@app.get("/api/me/profile")
def get_full_profile(request: Request):
    payload = get_current_user(request)
    sb = get_supabase()
    res = sb.table("profiles").select("*").eq("id", payload["user_id"]).execute()
    user = res.data[0] if res.data else {}
    return {
        "identity": user.get("identity") or {},
        "interests": user.get("interests") or {},
        "rejection_rules": user.get("rejection_rules") or [],
        "preferences": user.get("preferences") or {},
    }


# ══════════════════════════════════════════
# Taxonomy Endpoint
# ══════════════════════════════════════════
@app.get("/api/taxonomy")
def get_taxonomy():
    """Return the topic taxonomy for the onboarding wizard."""
    import json
    taxonomy_path = os.path.join(os.path.dirname(__file__), "taxonomy.json")
    try:
        with open(taxonomy_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


# ══════════════════════════════════════════
# Manifesto Endpoints
# ══════════════════════════════════════════
@app.get("/api/me/manifesto")
def get_manifesto(request: Request):
    """Get user's manifesto text."""
    payload = get_current_user(request)
    sb = get_supabase()

    # Read from manifesto file (backend/manifests/{username}.txt)
    res = sb.table("profiles").select("username").eq("id", payload["user_id"]).execute()
    username = res.data[0]["username"] if res.data else ""

    manifesto_path = os.path.join(os.path.dirname(__file__), "manifests", f"{username}.txt")
    try:
        with open(manifesto_path, "r", encoding="utf-8") as f:
            return {"content": f.read()}
    except FileNotFoundError:
        return {"content": ""}


class ManifestoUpdate(BaseModel):
    content: str = Field(..., max_length=10000)


@app.put("/api/me/manifesto")
def update_manifesto(request: Request, body: ManifestoUpdate):
    """Update user's manifesto text."""
    payload = get_current_user(request)
    sb = get_supabase()

    res = sb.table("profiles").select("username").eq("id", payload["user_id"]).execute()
    username = res.data[0]["username"] if res.data else ""

    manifesto_dir = os.path.join(os.path.dirname(__file__), "manifests")
    os.makedirs(manifesto_dir, exist_ok=True)
    manifesto_path = os.path.join(manifesto_dir, f"{username}.txt")

    with open(manifesto_path, "w", encoding="utf-8") as f:
        f.write(body.content)

    # Generate and store embedding for Vector Search
    from llm_wrapper import get_embedding_provider
    embed_provider = get_embedding_provider()
    if embed_provider and body.content.strip():
        try:
            vectors = embed_provider.embed([body.content])
            if vectors:
                store_manifesto_embedding(payload["user_id"], vectors[0])
        except Exception as e:
            logger.error(f"Failed to embed manifesto for {username}: {e}")

    return {"status": "ok"}


# ══════════════════════════════════════════
# Preferences & Password Endpoints
# ══════════════════════════════════════════
class PreferencesUpdate(BaseModel):
    summary_length: Optional[int] = Field(None, ge=1, le=4)


@app.put("/api/me/profile/preferences")
def update_preferences(request: Request, body: PreferencesUpdate):
    """Update user preferences (summary_length, etc.)."""
    payload = get_current_user(request)
    sb = get_supabase()

    # Get current preferences and merge
    res = sb.table("profiles").select("preferences").eq("id", payload["user_id"]).execute()
    current_prefs = res.data[0].get("preferences") or {} if res.data else {}

    if body.summary_length is not None:
        current_prefs["summary_length"] = body.summary_length

    sb.table("profiles").update({"preferences": current_prefs}).eq("id", payload["user_id"]).execute()
    return {"status": "ok"}


class PasswordUpdate(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=128)


@app.put("/api/me/password")
def update_password(request: Request, body: PasswordUpdate):
    """Change user password via Supabase Auth Admin API."""
    payload = get_current_user(request)
    sb = get_supabase()

    try:
        sb.auth.admin.update_user_by_id(payload["user_id"], {"password": body.new_password})
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ══════════════════════════════════════════
# Onboarding Manifesto Generation
# ══════════════════════════════════════════
class OnboardingRequest(BaseModel):
    topics: List[str]
    subtopics: List[str] = []
    custom: str = ""


@app.post("/api/onboarding/manifesto")
def generate_onboarding_manifesto(request: Request, body: OnboardingRequest):
    """Generate a manifesto from onboarding wizard selections."""
    payload = get_current_user(request)
    sb = get_supabase()

    res = sb.table("profiles").select("username").eq("id", payload["user_id"]).execute()
    username = res.data[0]["username"] if res.data else ""

    # Build manifesto from selections
    lines = ["# Mon Manifesto Mizan.ai", ""]
    lines.append("## Domaines d'intérêt")
    for topic in body.topics:
        lines.append(f"- {topic}")
    if body.subtopics:
        lines.append("")
        lines.append("## Sous-thèmes prioritaires")
        for sub in body.subtopics:
            lines.append(f"- {sub}")
    if body.custom:
        lines.append("")
        lines.append("## Notes personnelles")
        lines.append(body.custom)

    manifesto_text = "\n".join(lines)

    # Save to file
    manifesto_dir = os.path.join(os.path.dirname(__file__), "manifests")
    os.makedirs(manifesto_dir, exist_ok=True)
    manifesto_path = os.path.join(manifesto_dir, f"{username}.txt")
    with open(manifesto_path, "w", encoding="utf-8") as f:
        f.write(manifesto_text)

    # Update profile interests in Supabase
    interests = {topic: body.subtopics for topic in body.topics}
    sb.table("profiles").update({"interests": interests}).eq("id", payload["user_id"]).execute()

    # Generate and store embedding for Vector Search
    from llm_wrapper import get_embedding_provider
    embed_provider = get_embedding_provider()
    if embed_provider and manifesto_text.strip():
        try:
            vectors = embed_provider.embed([manifesto_text])
            if vectors:
                store_manifesto_embedding(payload["user_id"], vectors[0])
        except Exception as e:
            logger.error(f"Failed to embed onboarding manifesto for {username}: {e}")

    return {"status": "ok", "manifesto": manifesto_text}


# ══════════════════════════════════════════
# Brief Endpoints
# ══════════════════════════════════════════
@app.get("/api/brief")
def get_brief(request: Request, date: Optional[str] = None):
    payload = get_current_user(request)
    sb = get_supabase()

    query = sb.table("daily_briefs").select("*").eq("user_id", payload["user_id"])
    if date:
        query = query.eq("date", date)
    else:
        query = query.order("date", desc=True).limit(1)

    res = query.execute()
    if not res.data:
        return {"content": []}

    brief = res.data[0]
    return {
        "date": brief["date"],
        "global_digest": brief["global_digest"],
        "content": brief["content"],
        "total_kept": len(brief["content"]),
    }


@app.get("/api/brief/history")
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


@app.post("/api/brief/generate")
def generate_brief(request: Request, background_tasks: BackgroundTasks, mode: str = "prod"):
    payload = get_current_user(request)
    user_id = payload["user_id"]
    sb = get_supabase()
    res = sb.table("profiles").select("*").eq("id", user_id).execute()
    user = res.data[0] if res.data else {}

    username = user.get("username", payload.get("username", ""))
    language = user.get("language", "fr")
    threshold = user.get("score_threshold", 70)

    # Check quota
    try:
        check_brief_quota(user_id, sb)
    except QuotaExceeded as e:
        raise HTTPException(status_code=429, detail=str(e))

    if mode == "test":
        from pipeline import run_pipeline_for_user
        return run_pipeline_for_user(username, language, threshold, mode="test")

    # Enqueue via job queue (durable, retryable, priority-aware)
    plan_info = get_user_plan(user_id, sb)
    priority = 1 if plan_info["plan"] in ("pro", "enterprise") else 0

    job = enqueue_job(
        job_type="generate_brief",
        payload={"username": username, "language": language, "score_threshold": threshold},
        user_id=user_id,
        priority=priority,
    )
    return {"message": "Generation queued", "status": "queued", "job_id": job.get("id")}


@app.get("/api/brief/status")
def get_brief_status(request: Request):
    payload = get_current_user(request)
    username = payload.get("username", "")
    return get_generation_status(username)


# ══════════════════════════════════════════
# Billing Endpoints (Stripe)
# ══════════════════════════════════════════
class CheckoutRequest(BaseModel):
    plan: str = Field(..., pattern=r"^(pro|enterprise)$")


@app.get("/api/billing/plan")
def get_plan(request: Request):
    """Get the current user's plan and limits."""
    payload = get_current_user(request)
    sb = get_supabase()
    return get_user_plan(payload["user_id"], sb)


@app.get("/api/billing/usage")
def get_usage(request: Request):
    """Get the current user's usage summary."""
    payload = get_current_user(request)
    sb = get_supabase()
    return get_usage_summary(payload["user_id"], sb)


@app.post("/api/billing/checkout")
def checkout(request: Request, body: CheckoutRequest):
    """Create a Stripe Checkout session."""
    if not STRIPE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Stripe is not configured")

    payload = get_current_user(request)
    sb = get_supabase()
    email = payload.get("email", "")
    tier = PlanTier(body.plan)

    try:
        return create_checkout_session(payload["user_id"], email, tier, sb)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/billing/portal")
def billing_portal(request: Request):
    """Create a Stripe Customer Portal session."""
    if not STRIPE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Stripe is not configured")

    payload = get_current_user(request)
    sb = get_supabase()
    email = payload.get("email", "")

    try:
        return create_portal_session(payload["user_id"], email, sb)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/billing/webhook")
async def stripe_webhook(request: Request):
    """Stripe webhook (no auth — validated by Stripe signature)."""
    payload_bytes = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    sb = get_supabase()

    try:
        return handle_stripe_webhook(payload_bytes, sig_header, sb)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ══════════════════════════════════════════
# Scheduler Trigger
# ══════════════════════════════════════════
SCHEDULER_SECRET = os.getenv("SCHEDULER_SECRET", "")


@app.post("/api/scheduler/trigger")
def trigger_scheduler(request: Request):
    """Trigger daily brief scheduler. Protected by SCHEDULER_SECRET."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.replace("Bearer ", "")

    if not SCHEDULER_SECRET or token != SCHEDULER_SECRET:
        raise HTTPException(status_code=403, detail="Invalid scheduler secret")

    from scheduler import schedule_daily_briefs
    return schedule_daily_briefs()


# ══════════════════════════════════════════
# Metrics & Queue Stats
# ══════════════════════════════════════════
@app.get("/api/metrics")
def metrics():
    """Application metrics (latency, errors, uptime)."""
    return get_metrics()


@app.get("/api/queue/stats")
def queue_stats():
    """Job queue statistics."""
    return get_queue_stats()
