"""
Mizan.ai — Feedback API (Supabase)
"""
from fastapi import APIRouter, Request
from pydantic import BaseModel
from auth import get_current_user
from database import store_feedback

router = APIRouter()

class FeedbackRequest(BaseModel):
    article_title: str
    article_summary: str = ""
    action: str # "read", "rejected", etc.

@router.post("/api/feedback")
def post_feedback(req: FeedbackRequest, request: Request):
    payload = get_current_user(request)
    user_id = payload["user_id"] # UUID from Supabase Auth

    store_feedback(
        user_id=user_id,
        article_title=req.article_title,
        action=req.action,
        summary=req.article_summary
    )

    return {"status": "ok"}
