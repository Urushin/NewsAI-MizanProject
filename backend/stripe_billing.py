"""
Mizan.ai — Stripe Billing Integration

Handles:
  ✅ Plan definitions (Free/Pro/Enterprise)
  ✅ Checkout session creation
  ✅ Webhook event processing
  ✅ Subscription status management
  ✅ Customer portal access
"""
import os
import time
from enum import Enum
from typing import Optional
from loguru import logger

try:
    import stripe
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_AVAILABLE = bool(stripe.api_key)
except ImportError:
    STRIPE_AVAILABLE = False
    logger.warning("⚠️ stripe package not installed. Run: pip install stripe")


# ══════════════════════════════════════════
# Plan Definitions
# ══════════════════════════════════════════
class PlanTier(str, Enum):
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


PLAN_LIMITS = {
    PlanTier.FREE: {
        "name": "Free",
        "briefs_per_day": 1,
        "articles_per_brief": 10,
        "history_days": 7,
        "deep_scrape": False,
        "priority_queue": False,
        "price_monthly_eur": 0,
    },
    PlanTier.PRO: {
        "name": "Pro",
        "briefs_per_day": 5,
        "articles_per_brief": 30,
        "history_days": 90,
        "deep_scrape": True,
        "priority_queue": True,
        "price_monthly_eur": 9.99,
    },
    PlanTier.ENTERPRISE: {
        "name": "Enterprise",
        "briefs_per_day": -1,  # Unlimited
        "articles_per_brief": 100,
        "history_days": 365,
        "deep_scrape": True,
        "priority_queue": True,
        "price_monthly_eur": 29.99,
    },
}

# Stripe Price IDs (set in .env)
STRIPE_PRICES = {
    PlanTier.PRO: os.getenv("STRIPE_PRICE_PRO", ""),
    PlanTier.ENTERPRISE: os.getenv("STRIPE_PRICE_ENTERPRISE", ""),
}

STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


# ══════════════════════════════════════════
# Subscription Management
# ══════════════════════════════════════════
def get_user_plan(user_id: str, supabase_client) -> dict:
    """Get the current plan for a user. Returns plan details + limits."""
    try:
        res = (
            supabase_client.table("subscriptions")
            .select("*")
            .eq("user_id", user_id)
            .eq("status", "active")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if res.data:
            sub = res.data[0]
            tier = PlanTier(sub.get("plan", "free"))
            return {
                "plan": tier.value,
                "limits": PLAN_LIMITS[tier],
                "subscription_id": sub.get("stripe_subscription_id"),
                "current_period_end": sub.get("current_period_end"),
                "status": sub.get("status"),
            }
    except Exception as e:
        logger.error(f"Error fetching plan for {user_id}: {e}")

    # Default to free
    return {
        "plan": PlanTier.FREE.value,
        "limits": PLAN_LIMITS[PlanTier.FREE],
        "subscription_id": None,
        "current_period_end": None,
        "status": "active",
    }


def _get_or_create_stripe_customer(user_id: str, email: str, supabase_client) -> str:
    """Get existing Stripe customer ID or create a new one."""
    # Check if user already has a Stripe customer ID
    res = (
        supabase_client.table("profiles")
        .select("stripe_customer_id")
        .eq("id", user_id)
        .execute()
    )
    if res.data and res.data[0].get("stripe_customer_id"):
        return res.data[0]["stripe_customer_id"]

    # Create new Stripe customer
    customer = stripe.Customer.create(
        email=email,
        metadata={"user_id": user_id},
    )

    # Save customer ID to profile
    supabase_client.table("profiles").update(
        {"stripe_customer_id": customer.id}
    ).eq("id", user_id).execute()

    return customer.id


# ══════════════════════════════════════════
# Checkout & Portal
# ══════════════════════════════════════════
def create_checkout_session(
    user_id: str, email: str, plan: PlanTier, supabase_client
) -> dict:
    """Create a Stripe Checkout session for subscription."""
    if not STRIPE_AVAILABLE:
        raise RuntimeError("Stripe is not configured")

    if plan == PlanTier.FREE:
        raise ValueError("Cannot checkout for Free plan")

    price_id = STRIPE_PRICES.get(plan)
    if not price_id:
        raise ValueError(f"No Stripe price configured for plan: {plan.value}")

    customer_id = _get_or_create_stripe_customer(user_id, email, supabase_client)

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{FRONTEND_URL}/billing?status=success",
        cancel_url=f"{FRONTEND_URL}/billing?status=cancelled",
        metadata={"user_id": user_id, "plan": plan.value},
        subscription_data={"metadata": {"user_id": user_id, "plan": plan.value}},
    )

    return {"checkout_url": session.url, "session_id": session.id}


def create_portal_session(user_id: str, email: str, supabase_client) -> dict:
    """Create a Stripe Customer Portal session for managing subscriptions."""
    if not STRIPE_AVAILABLE:
        raise RuntimeError("Stripe is not configured")

    customer_id = _get_or_create_stripe_customer(user_id, email, supabase_client)

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{FRONTEND_URL}/billing",
    )

    return {"portal_url": session.url}


# ══════════════════════════════════════════
# Webhook Handler
# ══════════════════════════════════════════
def handle_stripe_webhook(payload: bytes, sig_header: str, supabase_client) -> dict:
    """Process Stripe webhook events."""
    if not STRIPE_AVAILABLE:
        raise RuntimeError("Stripe is not configured")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        raise ValueError("Invalid webhook signature")

    event_type = event["type"]
    data = event["data"]["object"]

    logger.info(f"📦 Stripe webhook: {event_type}")

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(data, supabase_client)
    elif event_type == "customer.subscription.updated":
        _handle_subscription_updated(data, supabase_client)
    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(data, supabase_client)
    elif event_type == "invoice.payment_failed":
        _handle_payment_failed(data, supabase_client)

    return {"status": "ok", "event": event_type}


def _handle_checkout_completed(session: dict, sb):
    """Checkout completed → activate subscription."""
    user_id = session.get("metadata", {}).get("user_id")
    plan = session.get("metadata", {}).get("plan", "pro")
    subscription_id = session.get("subscription")

    if not user_id:
        logger.error("Checkout completed but no user_id in metadata")
        return

    # Fetch subscription details from Stripe
    sub = stripe.Subscription.retrieve(subscription_id)

    sb.table("subscriptions").upsert({
        "user_id": user_id,
        "stripe_subscription_id": subscription_id,
        "stripe_customer_id": session.get("customer"),
        "plan": plan,
        "status": "active",
        "current_period_start": _ts_to_iso(sub.current_period_start),
        "current_period_end": _ts_to_iso(sub.current_period_end),
    }, on_conflict="user_id").execute()

    logger.info(f"✅ Subscription activated: {user_id} → {plan}")


def _handle_subscription_updated(sub: dict, sb):
    """Subscription updated (plan change, renewal)."""
    user_id = sub.get("metadata", {}).get("user_id")
    if not user_id:
        return

    plan = sub.get("metadata", {}).get("plan", "pro")
    status = sub.get("status", "active")

    sb.table("subscriptions").upsert({
        "user_id": user_id,
        "stripe_subscription_id": sub["id"],
        "plan": plan,
        "status": status,
        "current_period_start": _ts_to_iso(sub.get("current_period_start")),
        "current_period_end": _ts_to_iso(sub.get("current_period_end")),
    }, on_conflict="user_id").execute()

    logger.info(f"🔄 Subscription updated: {user_id} → {plan} ({status})")


def _handle_subscription_deleted(sub: dict, sb):
    """Subscription cancelled → downgrade to free."""
    user_id = sub.get("metadata", {}).get("user_id")
    if not user_id:
        return

    sb.table("subscriptions").update({
        "status": "cancelled",
        "plan": "free",
    }).eq("stripe_subscription_id", sub["id"]).execute()

    logger.info(f"❌ Subscription cancelled: {user_id} → free")


def _handle_payment_failed(invoice: dict, sb):
    """Payment failed → mark subscription as past_due."""
    subscription_id = invoice.get("subscription")
    if not subscription_id:
        return

    sb.table("subscriptions").update({
        "status": "past_due",
    }).eq("stripe_subscription_id", subscription_id).execute()

    logger.warning(f"💳 Payment failed for subscription {subscription_id}")


def _ts_to_iso(ts) -> Optional[str]:
    """Convert Unix timestamp to ISO string."""
    if ts:
        from datetime import datetime, timezone
        return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
    return None
