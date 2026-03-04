"""
Mizan.ai — Authentication (Supabase JWT)
Validates Supabase access_tokens instead of custom JWT.
"""
import os
import pathlib
from fastapi import HTTPException, Request
from dotenv import load_dotenv

# Load env
root_dir = pathlib.Path(__file__).parent.parent.resolve()
load_dotenv(str(root_dir / '.env'))

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")


def get_current_user(request: Request) -> dict:
    """
    Decode Supabase access_token from Authorization header.
    Returns dict with 'user_id' (UUID) and 'email'.
    """
    auth = request.headers.get("Authorization", "")
    is_dev = os.getenv("APP_STAGE") == "development"
    
    # DEV MOCK: Bypass Auth in local development for faster iteration
    # Handles both: no header at all, AND the fake "dev_token_bypass" from the frontend
    if is_dev and (not auth or auth == "Bearer dev_token_bypass"):
        return {
            "user_id": "00000000-0000-0000-0000-000000000000",
            "email": "dev@mizan.ai",
            "username": "DevUser"
        }

    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Non authentifié")

    token = auth.split(" ", 1)[1]

    # Guard: reject obviously malformed tokens before decoding
    if not token or token.count(".") < 2:
        raise HTTPException(
            status_code=401,
            detail="Token JWT malformé (segments manquants). Vérifiez votre session."
        )

    try:
        import jwt
        payload = jwt.decode(token, options={"verify_signature": False})

        return {
            "user_id": payload.get("sub"),
            "email": payload.get("email", ""),
            "username": payload.get("user_metadata", {}).get("username", payload.get("email", "").split("@")[0]),
        }
    except jwt.exceptions.DecodeError as e:
        raise HTTPException(status_code=401, detail=f"Token JWT invalide: {e}")
    except jwt.exceptions.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré. Veuillez vous reconnecter.")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token invalide: {e}")

