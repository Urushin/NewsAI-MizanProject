from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from database import get_supabase
from auth import get_current_user
from stripe_billing import (
    get_user_plan, create_checkout_session, create_portal_session,
    handle_stripe_webhook, PlanTier, STRIPE_AVAILABLE,
)

router = APIRouter(prefix="/api/billing", tags=["billing"])

class CheckoutRequest(BaseModel):
    plan: str = Field(..., pattern=r"^(pro|enterprise)$")

@router.get("/plan")
def get_plan(request: Request):
    payload = get_current_user(request)
    sb = get_supabase()
    return get_user_plan(payload["user_id"], sb)

@router.get("/usage")
def get_usage(request: Request):
    from quotas import get_usage_summary
    payload = get_current_user(request)
    sb = get_supabase()
    return get_usage_summary(payload["user_id"], sb)

@router.post("/checkout")
def checkout(request: Request, body: CheckoutRequest):
    if not STRIPE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Stripe is not configured")

    payload = get_current_user(request)
    sb = get_supabase()
    email = payload.get("email", "")
    tier = PlanTier(body.plan)

    try:
        return create_checkout_session(payload["user_id"], email, tier, sb)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/portal")
def billing_portal(request: Request):
    if not STRIPE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Stripe is not configured")

    payload = get_current_user(request)
    sb = get_supabase()
    email = payload.get("email", "")

    try:
        return create_portal_session(payload["user_id"], email, sb)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload_bytes = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    sb = get_supabase()

    try:
        return handle_stripe_webhook(payload_bytes, sig_header, sb)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
