"""
Mizan.ai — Nightly Profile Updater (Supabase)
Reads feedback from Supabase, uses LLM to adjust user interests.
Usage: python profile_updater.py [username]
"""
import os
import sys
import json
import asyncio
import pathlib
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
root_dir = pathlib.Path(__file__).parent.parent.resolve()
load_dotenv(str(root_dir / '.env'))

from loguru import logger
from llm_wrapper import get_providers, parse_llm_json, strip_markdown_fences
from database import get_supabase


def load_interactions(user_id: str) -> list:
    """Load recent rejected feedbacks from Supabase (last 24h)."""
    sb = get_supabase()
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    try:
        res = (
            sb.table("feedbacks")
            .select("*")
            .eq("user_id", user_id)
            .gte("created_at", cutoff)
            .execute()
        )
        return res.data or []
    except Exception as e:
        logger.error(f"Failed to load interactions: {e}")
        return []


def load_profile(user_id: str) -> dict:
    """Load user profile from Supabase."""
    sb = get_supabase()
    try:
        res = sb.table("profiles").select("*").eq("id", user_id).execute()
        if res.data:
            return res.data[0]
    except Exception as e:
        logger.error(f"Failed to load profile: {e}")
    return {"identity": {}, "interests": {}, "rejection_rules": []}


def save_profile(user_id: str, interests: dict, rejection_rules: list):
    """Update user profile in Supabase."""
    sb = get_supabase()
    try:
        sb.table("profiles").update({
            "interests": interests,
            "rejection_rules": rejection_rules,
        }).eq("id", user_id).execute()
        logger.info(f"✅ Profile updated for {user_id}")
    except Exception as e:
        logger.error(f"Failed to save profile: {e}")


def clear_processed_feedback(user_id: str, feedback_ids: list):
    """Delete processed feedbacks from Supabase."""
    if not feedback_ids:
        return
    sb = get_supabase()
    try:
        for fid in feedback_ids:
            sb.table("feedbacks").delete().eq("id", fid).execute()
        logger.info(f"🗑️ Cleared {len(feedback_ids)} processed feedbacks")
    except Exception as e:
        logger.error(f"Failed to clear feedback: {e}")


def build_prompt(rejected: list, profile: dict) -> str:
    interests = json.dumps(profile.get("interests", {}), ensure_ascii=False)
    rules = json.dumps(profile.get("rejection_rules", []), ensure_ascii=False)
    articles = "\n".join(f'- "{a["article_title"]}"' for a in rejected[:20])

    return f"""Rejected articles:
{articles}

Current interests: {interests}
Current block rules: {rules}

Analyze patterns. Return JSON only:
{{"analysis":"short pattern","adjustments":[{{"topic":"existing_key","delta":-0.15}}],"new_blocked_rules":["rule if clear pattern"]}}

Delta range: -0.3 to +0.1. Only adjust existing topics. Only add rules for clear patterns."""


async def run_nightly_update(user_id: str, username: str):
    logger.info(f"🌙 [{username}] Reading interactions from Supabase...")

    interactions = load_interactions(user_id)
    if not interactions:
        logger.info(f"   ℹ️  No interactions. Done.")
        return

    rejected = [i for i in interactions if i.get("action") == "rejected"]
    read_count = sum(1 for i in interactions if i.get("action") == "read")
    logger.info(f"   📊 {read_count} reads, {len(rejected)} rejects")

    if not rejected:
        logger.info(f"   ✅ No rejects. Profile unchanged.")
        clear_processed_feedback(user_id, [i["id"] for i in interactions])
        return

    profile = load_profile(user_id)
    prompt = build_prompt(rejected, profile)

    providers = get_providers()
    if not providers:
        logger.error("   ❌ No LLM provider.")
        return

    result = None
    for provider in providers:
        try:
            text = await provider.generate(prompt)
            result = json.loads(strip_markdown_fences(text))
            break
        except Exception as e:
            logger.warning(f"   ⚠️ LLM error ({provider.name}): {e}")

    if not result or not isinstance(result, dict):
        logger.error("   ❌ Failed to get LLM response.")
        return

    analysis = result.get("analysis", "")
    adjustments = result.get("adjustments", [])
    new_rules = result.get("new_blocked_rules", [])

    logger.info(f"   🧠 {analysis}")

    interests = profile.get("interests", {})
    for adj in adjustments:
        topic = adj.get("topic", "")
        delta = adj.get("delta", 0)
        if topic in interests:
            old = interests[topic]
            new_val = round(max(0.0, min(1.0, old + delta)), 2)
            interests[topic] = new_val
            logger.info(f"   📉 {topic}: {old:.2f} → {new_val:.2f} ({delta:+.2f})")

    existing_rules = set(profile.get("rejection_rules", []))
    rejection_rules = list(existing_rules)
    for rule in new_rules:
        if rule and rule not in existing_rules:
            rejection_rules.append(rule)
            logger.info(f"   🚫 New rule: {rule}")

    save_profile(user_id, interests, rejection_rules)
    clear_processed_feedback(user_id, [i["id"] for i in interactions])
    logger.info(f"   ✅ Profile updated.")


async def run_all_users():
    """Run nightly update for all users in Supabase."""
    sb = get_supabase()
    try:
        res = sb.table("profiles").select("id, username").execute()
        if not res.data:
            logger.info("No users found.")
            return
        for user in res.data:
            await run_nightly_update(user["id"], user["username"])
    except Exception as e:
        logger.error(f"Failed to list users: {e}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Accept username as argument, resolve to user_id
        username = sys.argv[1]
        sb = get_supabase()
        res = sb.table("profiles").select("id, username").eq("username", username).execute()
        if res.data:
            asyncio.run(run_nightly_update(res.data[0]["id"], username))
        else:
            logger.error(f"User '{username}' not found in Supabase.")
    else:
        asyncio.run(run_all_users())
