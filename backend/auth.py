"""
Mizan.ai — Authentication (JWT)
"""
import os
import jwt
import time
from functools import wraps
from fastapi import HTTPException, Request

SECRET_KEY = os.getenv("JWT_SECRET", "mizan-ai-secret-key-2026")
ALGORITHM = "HS256"
TOKEN_EXPIRY = 60 * 60 * 24 * 7  # 7 days

def create_token(user_id: int, username: str) -> str:
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": int(time.time()) + TOKEN_EXPIRY,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")

def get_current_user(request: Request) -> dict:
    """Extract user from Authorization header."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Non authentifié")
    token = auth.split(" ", 1)[1]
    return decode_token(token)
