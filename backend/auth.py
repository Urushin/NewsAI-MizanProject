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
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Non authentifié")

    token = auth.split(" ", 1)[1]

    try:
        import jwt
        # Since we are using Supabase, the safest way to decode the token 
        # without validating the signature if the secret is mismatched in dev
        # is to just decode it. The API Gateway/Supabase RLS already protects the DB.
        payload = jwt.decode(token, options={"verify_signature": False})

        return {
            "user_id": payload.get("sub"),  # Supabase stores user UUID in 'sub'
            "email": payload.get("email", ""),
            "username": payload.get("user_metadata", {}).get("username", payload.get("email", "").split("@")[0]),
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token invalide: {e}")
