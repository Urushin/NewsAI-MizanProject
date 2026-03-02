"""
Mizan.ai — Usage Quotas per Plan

Enforces per-plan limits:
  Free:       1 brief/day,  10 articles/brief
  Pro:        5 briefs/day, 30 articles/brief
  Enterprise: Unlimited,    100 articles/brief
"""
from datetime import datetime, timezone
from typing import Optional
from loguru import logger

from stripe_billing import get_user_plan, PlanTier, PLAN_LIMITS


class QuotaExceeded(Exception):
    """Raised when a user exceeds their plan's quota."""
    def __init__(self, plan: str, limit_name: str, current: int, max_val: int):
        self.plan = plan
        self.limit_name = limit_name
        self.current = current
        self.max_val = max_val
        super().__init__(
            f"Quota exceeded: {limit_name} ({current}/{max_val}) on plan '{plan}'. "
            f"Upgrade to unlock more."
        )


def check_brief_quota(user_id: str, supabase_client) -> dict:
    """Check if user can generate a new brief today.
    
    Returns:
        dict with 'allowed', 'used', 'limit', 'plan'
    
    Raises:
        QuotaExceeded if the user has hit their daily limit.
    """
    plan_info = get_user_plan(user_id, supabase_client)
    tier = PlanTier(plan_info["plan"])
    limits = PLAN_LIMITS[tier]
    max_briefs = limits["briefs_per_day"]

    # Unlimited plan
    if max_briefs == -1:
        return {
            "allowed": True,
            "used": 0,
            "limit": -1,
            "plan": tier.value,
        }

    # Count today's briefs
    today = datetime.now(timezone.utc).date().isoformat()
    try:
        res = (
            supabase_client.table("daily_briefs")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("date", today)
            .execute()
        )
        used = res.count if hasattr(res, "count") and res.count is not None else len(res.data)
    except Exception as e:
        logger.error(f"Quota check error: {e}")
        used = 0

    allowed = used < max_briefs

    if not allowed:
        raise QuotaExceeded(tier.value, "briefs_per_day", used, max_briefs)

    return {
        "allowed": True,
        "used": used,
        "limit": max_briefs,
        "plan": tier.value,
    }


def get_articles_limit(user_id: str, supabase_client) -> int:
    """Get the max articles per brief for the user's plan."""
    plan_info = get_user_plan(user_id, supabase_client)
    tier = PlanTier(plan_info["plan"])
    return PLAN_LIMITS[tier]["articles_per_brief"]


def get_history_days(user_id: str, supabase_client) -> int:
    """Get the number of days of history available for the user's plan."""
    plan_info = get_user_plan(user_id, supabase_client)
    tier = PlanTier(plan_info["plan"])
    return PLAN_LIMITS[tier]["history_days"]


def can_deep_scrape(user_id: str, supabase_client) -> bool:
    """Check if the user's plan allows deep scraping."""
    plan_info = get_user_plan(user_id, supabase_client)
    tier = PlanTier(plan_info["plan"])
    return PLAN_LIMITS[tier]["deep_scrape"]


def get_usage_summary(user_id: str, supabase_client) -> dict:
    """Full usage summary for the user's billing dashboard."""
    plan_info = get_user_plan(user_id, supabase_client)
    tier = PlanTier(plan_info["plan"])
    limits = PLAN_LIMITS[tier]

    today = datetime.now(timezone.utc).date().isoformat()
    try:
        res = (
            supabase_client.table("daily_briefs")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("date", today)
            .execute()
        )
        briefs_today = res.count if hasattr(res, "count") and res.count is not None else len(res.data)
    except Exception:
        briefs_today = 0

    return {
        "plan": tier.value,
        "plan_name": limits["name"],
        "briefs_today": briefs_today,
        "briefs_limit": limits["briefs_per_day"],
        "articles_limit": limits["articles_per_brief"],
        "history_days": limits["history_days"],
        "deep_scrape": limits["deep_scrape"],
        "subscription_id": plan_info.get("subscription_id"),
        "current_period_end": plan_info.get("current_period_end"),
    }
