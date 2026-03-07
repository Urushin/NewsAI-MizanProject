import os
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from loguru import logger
from database import get_supabase, update_user_profile, store_manifesto_embedding, get_user_by_id, get_user_by_username
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
    user = get_user_by_id(payload["user_id"])
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return user


@router.put("/me/profile")
def update_full_profile(request: Request, body: UpdateProfileRequest):
    payload = get_current_user(request)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        update_user_profile(payload["user_id"], updates)
    return {"status": "ok"}


@router.get("/me/profile")
def get_full_profile(request: Request):
    payload = get_current_user(request)
    user = get_user_by_id(payload["user_id"]) or {}
    return {
        "identity": user.get("identity") or {},
        "interests": user.get("interests") or {},
        "rejection_rules": user.get("rejection_rules") or [],
        "preferences": user.get("preferences") or {},
    }

@router.get("/me/manifesto")
def get_manifesto(request: Request):
    payload = get_current_user(request)
    user = get_user_by_id(payload["user_id"]) or {}
    username = user.get("username", "")

    manifesto_path = os.path.join(os.path.dirname(__file__), "..", "manifests", f"{username}.txt")
    try:
        with open(manifesto_path, "r", encoding="utf-8") as f:
            return {"content": f.read()}
    except FileNotFoundError:
        return {"content": ""}


class ManifestoUpdate(BaseModel):
    content: str = Field(..., max_length=10000)

@router.put("/me/manifesto")
async def update_manifesto(request: Request, body: ManifestoUpdate):
    payload = get_current_user(request)
    user = get_user_by_id(payload["user_id"]) or {}
    username = user.get("username", "")

    manifesto_dir = os.path.join(os.path.dirname(__file__), "..", "manifests")
    os.makedirs(manifesto_dir, exist_ok=True)
    manifesto_path = os.path.join(manifesto_dir, f"{username}.txt")

    with open(manifesto_path, "w", encoding="utf-8") as f:
        f.write(body.content)

    # Parse the markdown to extract topics and subtopics for the backend scraper
    interests = {}
    current_section = None
    topics = []
    
    for line in body.content.split("\n"):
        line = line.strip()
        if not line:
            continue
            
        if line.startswith("## Domaines d'intérêt"):
            current_section = "topics"
        elif line.startswith("## Sous-thèmes prioritaires"):
            current_section = "subtopics"
        elif line.startswith("## Notes personnelles"):
            current_section = "custom"
        elif line.startswith("-") and current_section == "topics":
            topic = line[1:].strip()
            interests[topic] = []
            topics.append(topic)
        elif line.startswith("-") and current_section == "subtopics":
            subtopic = line[1:].strip()
            # Distribute to the first topic for clustering purposes
            if topics:
                interests[topics[0]].append(subtopic)
            else:
                if "Sujets" not in interests:
                    interests["Sujets"] = []
                interests["Sujets"].append(subtopic)
        elif current_section == "custom" and not line.startswith("#"):
            if "Notes personnelles" not in interests:
                interests["Notes personnelles"] = []
            interests["Notes personnelles"].append(line)

    if interests:
        update_user_profile(payload["user_id"], {"interests": interests})

    embed_provider = get_embedding_provider()
    if embed_provider and body.content.strip():
        try:
            vectors = await embed_provider.embed([body.content])
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
    user = get_user_by_id(payload["user_id"]) or {}
    current_prefs = user.get("preferences") or {}

    if body.summary_length is not None:
        current_prefs["summary_length"] = body.summary_length

    update_user_profile(payload["user_id"], {"preferences": current_prefs})
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
    # Contexte de Vie (Demographics)
    age_range: str = ""
    exact_age: str = ""
    location: str = ""
    exact_location: str = ""
    occupation: str = ""
    exact_occupation: str = ""
    youtube_channels: str = ""

@router.post("/onboarding/manifesto")
async def generate_onboarding_manifesto(request: Request, body: OnboardingRequest):
    payload = get_current_user(request)
    user = get_user_by_id(payload["user_id"]) or {}
    username = user.get("username", "")

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

    # Add Demographic override part
    has_demographics = any([body.age_range, body.exact_age, body.location, body.exact_location, body.occupation, body.exact_occupation])
    
    if has_demographics:
        lines.append("")
        lines.append("## Contexte de Vie")
        lines.append("> Ce contexte permet un ciblage d'actualités ayant un impact réel sur ma vie quotidienne.")
        if body.exact_age or body.age_range:
            age = body.exact_age if body.exact_age else body.age_range
            lines.append(f"- Âge : {age}")
        if body.exact_location or body.location:
            loc = body.exact_location if body.exact_location else body.location
            lines.append(f"- Localisation : {loc}")
        if body.exact_occupation or body.occupation:
            occ = body.exact_occupation if body.exact_occupation else body.occupation
            lines.append(f"- Profession / Secteur : {occ}")

    if body.youtube_channels.strip():
        lines.append("")
        lines.append("## Chaînes YouTube Suivies")
        lines.append("> Ce chapitre précise les chaînes YouTube pour lesquelles l'utilisateur souhaite un flux vidéo quotidien.")
        for channel in body.youtube_channels.split("\n"):
            channel = channel.strip()
            if channel:
                lines.append(f"- {channel}")

    manifesto_text = "\n".join(lines)

    manifesto_dir = os.path.join(os.path.dirname(__file__), "..", "manifests")
    os.makedirs(manifesto_dir, exist_ok=True)
    manifesto_path = os.path.join(manifesto_dir, f"{username}.txt")
    with open(manifesto_path, "w", encoding="utf-8") as f:
        f.write(manifesto_text)

    interests = {topic: body.subtopics for topic in body.topics}
    if body.custom.strip():
        # Treat custom notes as a standalone topic so it is fetched explicitly
        interests["Notes personnelles"] = [body.custom.strip()]
        
    updates = {"interests": interests}
    if has_demographics:
        updates["identity"] = {
            "age_range": body.age_range,
            "exact_age": body.exact_age,
            "location": body.location,
            "exact_location": body.exact_location,
            "occupation": body.occupation,
            "exact_occupation": body.exact_occupation
        }

    # Store youtube channels as preferences
    if body.youtube_channels:
        channels_list = [c.strip() for c in body.youtube_channels.split("\n") if c.strip()]
        current_prefs = user.get("preferences") or {}
        current_prefs["youtube_channels"] = channels_list
        updates["preferences"] = current_prefs

    update_user_profile(payload["user_id"], updates)

    embed_provider = get_embedding_provider()
    if embed_provider and manifesto_text.strip():
        try:
            vectors = await embed_provider.embed([manifesto_text])
            if vectors:
                store_manifesto_embedding(payload["user_id"], vectors[0])
        except Exception as e:
            logger.error(f"Failed to embed onboarding manifesto for {username}: {e}")

    return {"status": "ok", "manifesto": manifesto_text}
