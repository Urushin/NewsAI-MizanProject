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

        # Try to auto-confirm the user via admin API
        try:
            sb.auth.admin.update_user_by_id(user_id, {"email_confirm": True})
        except Exception as e:
            logger.warning(f"Could not auto-confirm user {user_id}: {e}")

        # Try to create the profile row (may fail due to RLS if service_role isn't working)
        try:
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
        except Exception as e:
            logger.warning(f"Profile insert failed (RLS?), will be created on first update: {e}")

        # Sign in to get a valid session token (signup may not always return one)
        try:
            login_res = sb.auth.sign_in_with_password({
                "email": body.email,
                "password": body.password
            })
            access_token = login_res.session.access_token if login_res.session else None
        except Exception:
            access_token = auth_res.session.access_token if auth_res.session else None

        return {
            "message": "Compte créé",
            "access_token": access_token,
            "user": {
                "id": user_id,
                "email": body.email,
                "username": body.username,
                "language": "fr",
                "score_threshold": 70
            }
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
            "password": body.password
        })
        
        if not auth_res.user:
            raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
            
        # Get profile data
        profile = sb.table("profiles").select("*").eq("id", auth_res.user.id).single().execute()
        
        return {
            "access_token": auth_res.session.access_token,
            "refresh_token": auth_res.session.refresh_token,
            "user": profile.data if profile.data else {
                "id": auth_res.user.id,
                "email": auth_res.user.email,
                "username": auth_res.user.user_metadata.get("username", "User")
            }
        }
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=401, detail="Identifiants invalides")
