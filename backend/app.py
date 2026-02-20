"""
Mizan.ai — FastAPI Backend
All API endpoints for auth, profile, brief generation, and article dismissal.
"""
import os
import sys
import json
import time

from fastapi import FastAPI, HTTPException, Request, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# Add backend dir to path for local imports
sys.path.insert(0, os.path.dirname(__file__))

from database import (
    init_db, seed_users,
    get_user_by_username, get_user_by_id,
    create_user, update_user, update_password,
    verify_password, dismiss_article, get_dismissed_titles
)
from auth import create_token, get_current_user

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

# ── App ──────────────────────────────────────────────────
app = FastAPI(title="Mizan.ai API", version="3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup ──────────────────────────────────────────────
@app.on_event("startup")
def startup():
    init_db()
    seed_users()

# ── Request Models ───────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str

class SignupRequest(BaseModel):
    username: str
    password: str
    language: str = "fr"

class UpdateProfileRequest(BaseModel):
    language: Optional[str] = None
    score_threshold: Optional[int] = None

class UpdatePasswordRequest(BaseModel):
    new_password: str

class ManifestoUpdate(BaseModel):
    content: str

class DismissRequest(BaseModel):
    article_title: str

# ── Auth Endpoints ───────────────────────────────────────
@app.post("/api/auth/login")
def login(req: LoginRequest):
    user = get_user_by_username(req.username)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Identifiants incorrects")
    token = create_token(user["id"], user["username"])
    return {
        "token": token,
        "user": _user_response(user),
    }

@app.post("/api/auth/signup")
def signup(req: SignupRequest):
    user_id = create_user(req.username, req.password, req.language)
    if user_id == -1:
        raise HTTPException(status_code=409, detail="Ce nom d'utilisateur existe déjà")
    # Create a default manifesto for the new user (interests only, no language instructions)
    manifesto_path = _manifesto_path(req.username)
    if not os.path.exists(manifesto_path):
        default = _default_manifesto(req.language)
        with open(manifesto_path, "w", encoding="utf-8") as f:
            f.write(default)
    token = create_token(user_id, req.username)
    return {
        "token": token,
        "user": {
            "id": user_id,
            "username": req.username,
            "language": req.language,
            "score_threshold": 70,
        },
    }

# ── Profile Endpoints ────────────────────────────────────
@app.get("/api/me")
def get_profile(request: Request):
    payload = get_current_user(request)
    user = get_user_by_id(payload["user_id"])
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return _user_response(user)

@app.put("/api/me")
def update_profile(req: UpdateProfileRequest, request: Request):
    payload = get_current_user(request)
    updates = {}
    if req.language is not None:
        updates["language"] = req.language
    if req.score_threshold is not None:
        updates["score_threshold"] = req.score_threshold
    if updates:
        update_user(payload["user_id"], **updates)
    # Return updated user so frontend can sync
    user = get_user_by_id(payload["user_id"])
    return {"status": "ok", "user": _user_response(user)}

@app.put("/api/me/password")
def change_password(req: UpdatePasswordRequest, request: Request):
    payload = get_current_user(request)
    update_password(payload["user_id"], req.new_password)
    return {"status": "ok"}

# ── Manifesto Endpoints ──────────────────────────────────
@app.get("/api/me/manifesto")
def get_manifesto(request: Request):
    payload = get_current_user(request)
    path = _manifesto_path(payload["username"])
    if not os.path.exists(path):
        return {"content": ""}
    with open(path, "r", encoding="utf-8") as f:
        return {"content": f.read()}

@app.put("/api/me/manifesto")
def update_manifesto(req: ManifestoUpdate, request: Request):
    payload = get_current_user(request)
    path = _manifesto_path(payload["username"])
    with open(path, "w", encoding="utf-8") as f:
        f.write(req.content)
    return {"status": "ok"}

# ── Article Dismiss ──────────────────────────────────────
@app.post("/api/articles/dismiss")
def dismiss(req: DismissRequest, request: Request):
    payload = get_current_user(request)
    user = get_user_by_id(payload["user_id"])
    dismiss_article(payload["user_id"], req.article_title)

    # Append feedback to manifesto in the user's own language
    lang = user["language"] if user else "en"
    dismiss_labels = {
        "fr": "NE PAS MONTRER de news similaire à",
        "en": "DO NOT SHOW news similar to",
        "ja": "次のようなニュースを表示しないでください",
    }
    label = dismiss_labels.get(lang, dismiss_labels["en"])
    path = _manifesto_path(payload["username"])
    with open(path, "a", encoding="utf-8") as f:
        f.write(f'\n- {label} : "{req.article_title}"')
    return {"status": "dismissed"}

# ── Brief Endpoint ───────────────────────────────────────
@app.get("/api/brief")
def get_brief(request: Request, date: Optional[str] = None):
    payload = get_current_user(request)
    user = get_user_by_id(payload["user_id"])
    username = user["username"]
    data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

    if date:
        # Load archived brief for a specific date
        brief_path = os.path.join(data_dir, "briefs", username, f"brief_{date}.json")
    else:
        # Load the current (latest) brief
        brief_path = os.path.join(data_dir, f"brief_{username}.json")

    if not os.path.exists(brief_path):
        return {
            "date": date or "",
            "generated_at": "",
            "total_collected": 0,
            "total_kept": 0,
            "duration_seconds": 0,
            "content": [],
        }
    with open(brief_path, "r", encoding="utf-8") as f:
        brief = json.load(f)

    # Filter out dismissed articles
    dismissed = get_dismissed_titles(payload["user_id"])
    if dismissed:
        brief["content"] = [
            a for a in brief["content"]
            if a.get("title") not in dismissed
        ]
        brief["total_kept"] = len(brief["content"])

    return brief


@app.get("/api/brief/history")
def get_brief_history(request: Request):
    """List all available brief dates for the current user."""
    payload = get_current_user(request)
    user = get_user_by_id(payload["user_id"])
    username = user["username"]

    archive_dir = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "data", "briefs", username,
    )
    if not os.path.isdir(archive_dir):
        return {"dates": []}

    entries = []
    for fname in sorted(os.listdir(archive_dir), reverse=True):
        if not fname.startswith("brief_") or not fname.endswith(".json"):
            continue
        date_str = fname.replace("brief_", "").replace(".json", "")
        # Read total_kept from the brief for display
        fpath = os.path.join(archive_dir, fname)
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                data = json.load(f)
            entries.append({
                "date": date_str,
                "total_kept": data.get("total_kept", 0),
                "total_collected": data.get("total_collected", 0),
            })
        except (json.JSONDecodeError, IOError):
            entries.append({"date": date_str, "total_kept": 0, "total_collected": 0})


    return {"dates": entries}


@app.post("/api/brief/generate")
def generate_brief(request: Request, background_tasks: BackgroundTasks, mode: str = "prod"):
    """
    Trigger brief generation.
    mode='prod' (default): Background task, returns status queued.
    mode='test': Sync execution, returns brief JSON immediately (Preview).
    """
    payload = get_current_user(request)
    user = get_user_by_id(payload["user_id"])
    username = user["username"]

    # Import pipeline dynamically
    from pipeline import run_pipeline_for_user
    
    if mode == "test":
        # Synchronous execution for preview
        print(f"🚀 [API] Launching TEST mode for {username}...")
        result = run_pipeline_for_user(username, user["language"], user["score_threshold"], mode="test")
        return result
    else:
        # Production (Background)
        background_tasks.add_task(run_pipeline_for_user, username, user["language"], user["score_threshold"], mode="prod")
        return {"message": "Generation started", "status": "queued"}

@app.get("/api/brief/status")
def get_brief_status(request: Request):
    """Returns the current generation status for the logged-in user."""
    payload = get_current_user(request)
    user = get_user_by_id(payload["user_id"])
    username = user["username"]
    
    from pipeline import GENERATION_STATUS
    status = GENERATION_STATUS.get(username, {"status": "idle", "percent": 0, "step": ""})
    
    # If done/error, maybe clear it after a read? 
    # For now, keep it. Frontend will stop polling when it sees "done".
    return status

# ── Helpers ──────────────────────────────────────────────
MANIFESTS_DIR = os.path.join(os.path.dirname(__file__), "manifests")

def _user_response(user: dict) -> dict:
    """Standard user response (never expose password_hash)."""
    return {
        "id": user["id"],
        "username": user["username"],
        "language": user["language"],
        "score_threshold": user["score_threshold"],
    }

def _manifesto_path(username: str) -> str:
    os.makedirs(MANIFESTS_DIR, exist_ok=True)
    return os.path.join(MANIFESTS_DIR, f"{username}.txt")

def _default_manifesto(language: str) -> str:
    """Default manifesto for new users. ONLY interests, no language instructions.
    Language is controlled by the user profile and injected by the pipeline."""
    templates = {
        "fr": (
            "Filtre strict. Garde uniquement les faits majeurs vérifiables.\n"
            "Intérêts : tech, crypto, géopolitique, culture.\n"
            "Pas de rumeurs, pas d'opinions, pas de faits divers."
        ),
        "en": (
            "Strict filter. Keep only major verifiable facts.\n"
            "Interests: tech, crypto, geopolitics, culture.\n"
            "No rumors, no opinions, no local crime stories."
        ),
        "ja": (
            "厳格なフィルター。検証可能な主要な事実のみを保持。\n"
            "興味分野：テック、暗号資産、地政学、文化。\n"
            "噂、意見記事、地方事件は不要。"
        ),
    }
    return templates.get(language, templates["en"])
