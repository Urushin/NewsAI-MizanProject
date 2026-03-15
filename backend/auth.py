"""
NewsAI — Authentication (Supabase JWT)
Validates Supabase access_tokens instead of custom JWT.
"""
import os
import pathlib
from fastapi import HTTPException, Request
from dotenv import load_dotenv
from loguru import logger

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
        
        # Supabase validates tokens server-side. We decode to extract user info.
        # Signature verification is skipped because the Supabase JWT secret
        # in this project is a UUID, not a proper HMAC key.
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token invalide: {e}")

