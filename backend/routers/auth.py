from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from loguru import logger
from database import get_supabase

router = APIRouter(prefix="/api/auth", tags=["auth"])

class SignupRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)
    username: str = Field(..., min_length=2, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")

class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)


@router.post("/signup")
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


@router.post("/login")
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
