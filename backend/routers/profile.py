import os
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from loguru import logger
from database import get_supabase, update_user_profile, store_manifesto_embedding
from auth import get_current_user
from llm_wrapper import get_embedding_provider

router = APIRouter(prefix="/api", tags=["profile"])

class UpdateProfileRequest(BaseModel):
    language: Optional[str] = Field(None, pattern=r"^(fr|en|ja|ar|es|de)$")
    score_threshold: Optional[int] = Field(None, ge=0, le=100)
    identity: Optional[dict] = None
    interests: Optional[dict] = None
    rejection_rules: Optional[List[str]] = Field(None, max_length=50)
    preferences: Optional[dict] = None

@router.get("/me")
def get_profile(request: Request):
    payload = get_current_user(request)
    sb = get_supabase()
    res = sb.table("profiles").select("*").eq("id", payload["user_id"]).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return res.data[0]


@router.put("/me/profile")
def update_full_profile(request: Request, body: UpdateProfileRequest):
    payload = get_current_user(request)
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if updates:
        update_user_profile(payload["user_id"], updates)
    return {"status": "ok"}


@router.get("/me/profile")
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

@router.get("/me/manifesto")
def get_manifesto(request: Request):
    payload = get_current_user(request)
    sb = get_supabase()
    res = sb.table("profiles").select("username").eq("id", payload["user_id"]).execute()
    username = res.data[0]["username"] if res.data else ""

    manifesto_path = os.path.join(os.path.dirname(__file__), "..", "manifests", f"{username}.txt")
    try:
        with open(manifesto_path, "r", encoding="utf-8") as f:
            return {"content": f.read()}
    except FileNotFoundError:
        return {"content": ""}


class ManifestoUpdate(BaseModel):
    content: str = Field(..., max_length=10000)

@router.put("/me/manifesto")
def update_manifesto(request: Request, body: ManifestoUpdate):
    payload = get_current_user(request)
    sb = get_supabase()
    res = sb.table("profiles").select("username").eq("id", payload["user_id"]).execute()
    username = res.data[0]["username"] if res.data else ""

    manifesto_dir = os.path.join(os.path.dirname(__file__), "..", "manifests")
    os.makedirs(manifesto_dir, exist_ok=True)
    manifesto_path = os.path.join(manifesto_dir, f"{username}.txt")

    with open(manifesto_path, "w", encoding="utf-8") as f:
        f.write(body.content)

    embed_provider = get_embedding_provider()
    if embed_provider and body.content.strip():
        try:
            vectors = embed_provider.embed([body.content])
            if vectors:
                store_manifesto_embedding(payload["user_id"], vectors[0])
        except Exception as e:
            logger.error(f"Failed to embed manifesto for {username}: {e}")

    return {"status": "ok"}

class PreferencesUpdate(BaseModel):
    summary_length: Optional[int] = Field(None, ge=1, le=4)

@router.put("/me/profile/preferences")
def update_preferences(request: Request, body: PreferencesUpdate):
    payload = get_current_user(request)
    sb = get_supabase()
    res = sb.table("profiles").select("preferences").eq("id", payload["user_id"]).execute()
    current_prefs = res.data[0].get("preferences") or {} if res.data else {}

    if body.summary_length is not None:
        current_prefs["summary_length"] = body.summary_length

    sb.table("profiles").update({"preferences": current_prefs}).eq("id", payload["user_id"]).execute()
    return {"status": "ok"}


class PasswordUpdate(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=128)

@router.put("/me/password")
def update_password(request: Request, body: PasswordUpdate):
    payload = get_current_user(request)
    sb = get_supabase()
    try:
        sb.auth.admin.update_user_by_id(payload["user_id"], {"password": body.new_password})
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class OnboardingRequest(BaseModel):
    topics: List[str]
    subtopics: List[str] = []
    custom: str = ""

@router.post("/onboarding/manifesto")
def generate_onboarding_manifesto(request: Request, body: OnboardingRequest):
    payload = get_current_user(request)
    sb = get_supabase()
    res = sb.table("profiles").select("username").eq("id", payload["user_id"]).execute()
    username = res.data[0]["username"] if res.data else ""

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

    manifesto_dir = os.path.join(os.path.dirname(__file__), "..", "manifests")
    os.makedirs(manifesto_dir, exist_ok=True)
    manifesto_path = os.path.join(manifesto_dir, f"{username}.txt")
    with open(manifesto_path, "w", encoding="utf-8") as f:
        f.write(manifesto_text)

    interests = {topic: body.subtopics for topic in body.topics}
    sb.table("profiles").update({"interests": interests}).eq("id", payload["user_id"]).execute()

    embed_provider = get_embedding_provider()
    if embed_provider and manifesto_text.strip():
        try:
            vectors = embed_provider.embed([manifesto_text])
            if vectors:
                store_manifesto_embedding(payload["user_id"], vectors[0])
        except Exception as e:
            logger.error(f"Failed to embed onboarding manifesto for {username}: {e}")

    return {"status": "ok", "manifesto": manifesto_text}
