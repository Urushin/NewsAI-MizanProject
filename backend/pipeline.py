"""
Mizan.ai — Pipeline (Real LLM Calls)
Two-pass cognitive filtering + global digest.
"""
import json
import os
import sys
import time
from datetime import datetime
import pathlib
from dotenv import load_dotenv

# Roots setup
root_dir = pathlib.Path(__file__).parent.parent.resolve()
load_dotenv(str(root_dir / '.env'))
from typing import List, Tuple

from models import RawArticle, ArticleVerdict
from loguru import logger
from collector import collect_articles, fetch_article_content
from llm_wrapper import get_providers, parse_llm_json, strip_markdown_fences
from database import (
    get_recent_processed_urls, record_processed_urls,
    get_user_by_username,
    store_daily_brief, set_generation_status,
    store_article_embeddings, get_manifesto_embedding, match_articles
)


# ── Helpers ──

def load_user_profile(user: dict) -> dict:
    """Formats the profile data from the raw Supabase user object."""
    if not user:
        return {"identity": {}, "interests": {}, "rejection_rules": []}
    return {
        "identity": user.get("identity") or {},
        "interests": user.get("interests") or {},
        "rejection_rules": user.get("rejection_rules") or [],
        "preferences": user.get("preferences") or {}
    }


def _status(username: str, step: str, percent: int):
    """Update progress status in Supabase."""
    set_generation_status(username, "processing", step, percent)


def _profile_context(profile: dict) -> str:
    """Build a compact profile context string for LLM prompts."""
    identity = json.dumps(profile.get("identity", {}), ensure_ascii=False)
    interests = json.dumps(profile.get("interests", {}), ensure_ascii=False)
    rules = json.dumps(profile.get("rejection_rules", []), ensure_ascii=False)
    return f"User identity: {identity}\nInterests: {interests}\nBlock rules: {rules}"


def _build_user_interest_sources(profile: dict) -> list:
    """Convert user profile interests into collector-compatible source dicts.
    
    If user has interests stored as a dict like {"crypto": 0.8, "AI": 0.9},
    convert them into Google News search sources.
    If interests is already a list of source dicts, return as-is.
    """
    interests = profile.get("interests", {})
    if not interests:
        return []
    
    # Already in list format (configured sources)
    if isinstance(interests, list):
        return interests
    
    # Dict format {"topic": weight} → convert to search sources
    sources = []
    for topic, weight in interests.items():
        if isinstance(weight, (int, float)) and weight < 0.3:
            continue  # Skip low-interest topics
        
        # Build the search query
        query_parts = [topic]
        if isinstance(weight, list):
            # The 'weight' is actually a list of subtopics from the wizard
            query_parts.extend(weight)
        
        query_str = " OR ".join(f'"{p}"' if " " in p else p for p in query_parts)
            
        sources.append({
            "id": f"user_topic_{topic}",
            "active": True,
            "type": "topic",
            "query": query_str,
            "category": topic,
            "language": profile.get("preferences", {}).get("language", "fr"),
        })
    return sources


def _verdict_to_dict(v: ArticleVerdict) -> dict:
    d = {
        "title": v.localized_title,
        "localized_title": v.localized_title,
        "link": v.link,
        "category": v.category,
        "score": v.score,
        "reason": v.reason,
        "credibility_score": v.credibility_score,
        "summary": v.summary,
        "keep": v.keep,
    }
    # Chimera fusion metadata
    if v.sources_count > 1:
        d["sources_count"] = v.sources_count
        d["source_urls"] = v.source_urls
    return d


def _extract_keywords(text: str, top_n: int = 12) -> set:
    """Extract significant keywords from text for topic matching."""
    import re
    # Common stop words (EN + FR) to ignore
    STOP = {
        "the", "a", "an", "in", "on", "at", "to", "for", "of", "and", "or", "is",
        "it", "its", "was", "are", "be", "has", "have", "had", "by", "with", "from",
        "this", "that", "not", "but", "as", "if", "will", "can", "been", "more",
        "all", "also", "than", "into", "after", "new", "says", "said", "would",
        "could", "about", "over", "just", "no", "so", "up", "out", "their", "which",
        "le", "la", "les", "de", "des", "du", "un", "une", "et", "en", "est", "dans",
        "qui", "que", "par", "pour", "sur", "au", "aux", "son", "sa", "ses", "avec",
        "ce", "cette", "il", "elle", "nous", "vous", "ils", "sont", "pas", "plus",
        "être", "avoir", "faire", "dit", "fait", "été", "selon", "après", "entre",
    }
    words = re.findall(r'[a-zA-ZÀ-ÿ]{3,}', text.lower())
    # Count word frequency
    freq = {}
    for w in words:
        if w not in STOP:
            freq[w] = freq.get(w, 0) + 1
    # Return top N by frequency
    sorted_words = sorted(freq.items(), key=lambda x: -x[1])
    return {w for w, _ in sorted_words[:top_n]}


def _article_similarity(a: 'RawArticle', b: 'RawArticle') -> float:
    """
    Compute similarity between two articles. Only groups articles covering
    the SAME event/story, not just the same general topic.
    """
    import difflib
    
    # Signal 1: Title similarity (strongest signal)
    title_sim = difflib.SequenceMatcher(
        None, a.title.lower(), b.title.lower()
    ).ratio()
    
    # GATE: If titles share almost nothing, these are different stories
    if title_sim < 0.20:
        return 0.0
    
    # Signal 2: Content lead similarity (first 500 chars)
    content_a = (a.content or "")[:500].lower()
    content_b = (b.content or "")[:500].lower()
    if content_a and content_b:
        content_sim = difflib.SequenceMatcher(None, content_a, content_b).ratio()
    else:
        content_sim = 0.0
    
    # Weighted: title dominates
    score = (title_sim * 0.60) + (content_sim * 0.40)
    
    # Boost: very similar titles always group
    if title_sim >= 0.50:
        score = max(score, title_sim)
    
    return score


# Clustering config
CLUSTER_THRESHOLD = 0.45   # Higher = stricter (was 0.38)
MAX_CLUSTER_SIZE = 4       # Cap: no cluster bigger than 4 articles

def cluster_articles(articles: List[RawArticle]) -> List[List[RawArticle]]:
    """Group articles about the SAME event (strict clustering)."""
    clusters: List[List[RawArticle]] = []
    
    for article in articles:
        best_score = 0.0
        best_cluster_idx = -1
        
        for idx, cluster in enumerate(clusters):
            # Skip full clusters
            if len(cluster) >= MAX_CLUSTER_SIZE:
                continue
            # Compare against the FIRST article (representative) only for speed
            score = _article_similarity(article, cluster[0])
            if score > best_score:
                best_score = score
                best_cluster_idx = idx
        
        if best_score >= CLUSTER_THRESHOLD and best_cluster_idx >= 0:
            clusters[best_cluster_idx].append(article)
        else:
            clusters.append([article])
    
    # Log cluster stats
    multi = [c for c in clusters if len(c) >= 2]
    if multi:
        logger.info(f"   🔗 Clustering: {len(multi)} multi-source clusters detected (largest: {max(len(c) for c in multi)} articles)")
    
    return clusters


# ── LLM Calls (Real) ──

BATCH_SIZE = 5  # Reduced from 10: Prevents OOM/Lost-In-The-Middle and optimizes token usage

def get_system_prompt_final_pass(profile: dict) -> str:
    level = profile.get("preferences", {}).get("summary_length", 1)
    
    if level == 1:
        summary_instruction = "- \"summary\": array of strings (exactly 3 very short bullet points, max 100 characters each)"
    elif level == 2:
        summary_instruction = "- \"summary\": array of strings (one single string inside the array containing a medium concatenation of 3 sentences)"
    elif level == 3:
        summary_instruction = "- \"summary\": array of strings (one single string inside the array containing a structured paragraph of about 250 words)"
    else:
        summary_instruction = "- \"summary\": array of strings (one single string inside the array containing a deep analytical summary with context and implications of 400+ words)"

    return f"""You are a news relevance AI for a personalized news app.
You evaluate the user's daily TOP matches that were found via vector search.
Output ONLY valid JSON. No markdown, no explanation.
For each article, return a JSON object with these exact fields:
- "localized_title": string (Mandatory: Translate and rewrite as a punchy journalistic title in the user's language)
{summary_instruction}
- "score": int 0-100 (relevance to the user, should usually be high)
- "keep": bool (true unless completely irrelevant)
- "category": "Impact" or "Passion" or "Tech" or "Politik" or "Business" or "World" or "Security" or "Trending"
- "reason": string (1 sentence explaining WHY this article matters to this user)
- "credibility_score": int 0-10 (source reliability)
- "link": string (the article URL, unchanged)
Return a JSON array of objects."""

SYSTEM_PROMPT_DIGEST = """You are a news synthesis AI. Given a list of filtered articles, write a concise 3-sentence executive summary of the user's day in news. Write in the user's language. Output only the summary text, no JSON."""


import re

def _build_batch_prompt(articles: List[dict], profile: dict, lang: str) -> str:
    """Build a prompt for batched article evaluation with Head-Tail Truncation."""
    profile_ctx = _profile_context(profile)
    article_list = []
    
    # Regex to strip simple markdown hyperlinks [text](url) to just text, saving chunks of tokens
    md_link_pattern = re.compile(r'\[([^\]]+)\]\([^\)]+\)')
    
    for i, a in enumerate(articles):
        raw_content = a.get("content", "")
        # Clean obvious markdown links that consume useless tokens
        cleaned_content = md_link_pattern.sub(r'\1', raw_content)
        
        # Head-Tail Clipping: Keep first 800 chars (Lead) and last 400 chars (Conclusion)
        if len(cleaned_content) > 1300:
            head = cleaned_content[:800]
            tail = cleaned_content[-400:]
            content_snippet = f"{head}\n\n...[TRUNCATED TO SAVE CONTEXT]...\n\n{tail}"
        else:
            content_snippet = cleaned_content
            
        article_list.append(f'{i+1}. Title: "{a.get("title")}"\n   URL: {a.get("url")}\n   Source: {a.get("source_interest")}\n   Content: {content_snippet}')

    articles_text = "\n\n".join(article_list)

    return f"""{profile_ctx}

Language: {lang}

Evaluate these {len(articles)} top matched articles:

{articles_text}

Return a JSON array with one object per article. Each object must have: localized_title, summary, score, keep, category, reason, credibility_score, link."""


async def _call_llm(prompt: str, system_prompt: str) -> str:
    """Call the first available LLM provider."""
    providers = get_providers()
    if not providers:
        raise RuntimeError("No LLM provider available. Check MISTRAL_API_KEY.")

    last_error = None
    for provider in providers:
        try:
            return await provider.generate(prompt, system_prompt)
        except Exception as e:
            logger.warning(f"LLM error ({provider.name}): {e}")
            last_error = e

    raise RuntimeError(f"All LLM providers failed. Last error: {last_error}")


async def _process_articles_in_batches(articles: List[dict], profile: dict, lang: str) -> List[ArticleVerdict]:
    """Helper to split articles into batches and process them through the LLM."""
    all_verdicts = []
    
    # Split into batches
    for i in range(0, len(articles), BATCH_SIZE):
        batch = articles[i : i + BATCH_SIZE]
        logger.info(f"   ⚙️ Processing LLM batch {i // BATCH_SIZE + 1} ({len(batch)} articles)")
        
        try:
            prompt = _build_batch_prompt(batch, profile, lang)
            raw_response = await _call_llm(prompt, get_system_prompt_final_pass(profile))
            
            urls = [a.get("url") for a in batch]
            titles = [a.get("title") for a in batch]
            verdicts = _parse_verdicts(raw_response, urls, titles)
            
            all_verdicts.extend(verdicts)
        except Exception as e:
            logger.error(f"   ❌ Batch {i // BATCH_SIZE + 1} failed: {e}")
            
    return all_verdicts


class LLMOutputValidationError(Exception):
    """Custom wrapper for LLM parsing and schema-matching feedback."""
    pass

def _parse_verdicts(raw_text: str, urls: List[str], titles: List[str]) -> List[ArticleVerdict]:
    """Parse LLM JSON output into strict ArticleVerdict objects."""
    try:
        data = parse_llm_json(raw_text)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM JSON: {e}\nRaw: {raw_text[:500]}")
        return []

    if not isinstance(data, list):
        data = [data]

    verdicts = []
    from pydantic import ValidationError
    
    for i, item in enumerate(data):
        try:
            # Ensure link is present (fallback to original article)
            if not item.get("link") and i < len(urls):
                item["link"] = urls[i]
            # Ensure required fields
            if "localized_title" not in item:
                item["localized_title"] = titles[i] if i < len(titles) else "Unknown"

            v = ArticleVerdict(**item)
            verdicts.append(v)
        except ValidationError as e:
            err_msg = f"Pydantic Validation Error on output #{i}: {e.errors()}"
            logger.warning(LLMOutputValidationError(err_msg))
            logger.warning("Graceful degradation: Skipping this specific parsed article due to formatting hallucination.")
        except Exception as e:
            logger.warning(f"Skipping invalid verdict #{i}: {e}")

    return verdicts


async def generate_global_digest(articles: List[ArticleVerdict], profile: dict, lang: str) -> str:
    """Generate a 3-sentence executive summary of all kept articles."""
    if not articles:
        return ""

    profile_ctx = _profile_context(profile)
    titles = "\n".join(f"- {v.localized_title} ({v.category}, score {v.score})" for v in articles[:20])

    prompt = f"""{profile_ctx}

Language: {lang}

Today's filtered articles:
{titles}

Write a concise 3-sentence executive summary of today's news for this user. Focus on the most impactful trends. Write in {lang}."""

    try:
        return (await _call_llm(prompt, SYSTEM_PROMPT_DIGEST)).strip()
    except Exception as e:
        logger.error(f"Digest generation failed: {e}")
        return ""


# ── Main Pipeline ──

def run_pipeline_for_user(username: str, language: str = "fr", score_threshold: int = 70, mode: str = "prod") -> dict:
    """Wrapper that runs the async pipeline synchronously.
    (This keeps the existing API footprint compatible for any external direct calls,
    while internally managing the event loop)."""
    import asyncio
    return asyncio.run(_run_pipeline_for_user_async(username, language, score_threshold, mode))

async def _run_pipeline_for_user_async(username: str, language: str = "fr", score_threshold: int = 70, mode: str = "prod") -> dict:
    t0 = time.time()
    is_test = mode == "test"
    _status(username, "Loading profile from Supabase...", 0)

    try:
        user = get_user_by_username(username)
        if not user:
            logger.error(f"User {username} not found in Supabase")
            set_generation_status(username, "error", "User profile not found", 0)
            return {"status": "error", "message": "User not found"}

        profile = load_user_profile(user)
        user_id = user["id"]

        exclude_urls = set()
        if not is_test:
            exclude_urls = get_recent_processed_urls(user_id, days=7)

        _status(username, "Collecting articles...", 5)
        
        # Build user-specific interest sources from profile
        user_interests = _build_user_interest_sources(profile)
        
        raw = await collect_articles(
            exclude_urls=exclude_urls,
            progress_callback=lambda msg, pct: _status(username, msg, pct),
            quick_mode=is_test,
            skip_scraping=is_test,
            user_interests=user_interests if user_interests else None,
        )
        logger.info(f"📡 [{username}] {len(raw)} articles")

        if not raw:
            _status(username, "No articles", 100)
            set_generation_status(username, "done", "No articles", 100)
            return {"status": "empty", "total_collected": 0, "total_kept": 0, "global_digest": "", "content": []}

        _status(username, "Clustering...", 15)
        clusters = cluster_articles(raw)
        representatives = [c[0] for c in clusters]
        logger.info(f"   🧩 {len(raw)} → {len(clusters)} clusters")

        # Fallback list of articles to keep if vector search completely fails
        kept = []
        
        # ── Vector Search Pipeline (Replaces LLM Passes) ──
        user_vector = get_manifesto_embedding(user_id)
        if user_vector and not is_test:
            _status(username, f"Generating Embeddings for {len(representatives)} articles...", 25)
            from llm_wrapper import get_embedding_provider
            embed_provider = get_embedding_provider()
            
            if embed_provider:
                # Prepare text points
                texts_to_embed = [
                    f"{a.title}\n{a.content[:1000] if a.content else ''}" 
                    for a in representatives
                ]
                try:
                    embeddings = await embed_provider.embed(texts_to_embed)
                    
                    # Package and save
                    db_articles = []
                    for i, a in enumerate(representatives):
                        if i < len(embeddings):
                            db_articles.append({
                                "url": a.link,
                                "title": a.title,
                                "content": a.content or "",
                                "source_interest": a.source_interest,
                                "embedding": embeddings[i]
                            })
                    
                    store_article_embeddings(db_articles)
                    
                    _status(username, "Semantic Search...", 40)
                    top_matches = match_articles(user_vector, match_count=15)
                    logger.info(f"   🎯 Found {len(top_matches)} matches via Vector Search")
                    
                    if top_matches:
                        _status(username, "Final validation...", 50)
                        # Filter similarity (closer to 1.0 is better in newer Supabase RPCs, 
                        # but we check if it's high enough)
                        good_matches = [m for m in top_matches if m.get("similarity", 0) > 0.1]
                        if not good_matches:
                            good_matches = top_matches[:5]
                            
                        # Process in batches of 5 (defined by BATCH_SIZE)
                        kept = await _process_articles_in_batches(good_matches, profile, language)
                        kept = [v for v in kept if v.keep]
                except Exception as e:
                    logger.error(f"Embedding/Vector Search failed: {e}")
        
        # ── Fallback if Vector Search failed or missing manifesto ──
        if not kept:
            logger.warning("Vector search yielded 0 results or failed. Fallback: Chimera + Batch pipeline.")
            _status(username, "Analyzing articles with AI...", 50)
            
            from chimera import synthesize_cluster
            
            # Split clusters into multi-article (→ Chimera fusion) and single-article (→ Batch)
            multi_clusters = [c for c in clusters if len(c) >= 2]
            single_clusters = [c for c in clusters if len(c) == 1]
            
            logger.info(f"   🧬 {len(multi_clusters)} multi-source clusters → Chimera | {len(single_clusters)} single-article → Batch")
            
            # ── Process Multi-Article Clusters via Chimera ──
            chimera_verdicts = []
            for cluster in multi_clusters[:10]:  # Cap at 10 clusters to control token spend
                cluster_dicts = [
                    {
                        "title": a.title,
                        "url": a.link,
                        "content": a.content or "",
                        "source_interest": a.source_interest,
                    }
                    for a in cluster
                ]
                try:
                    _status(username, f"Chimera: Fusing {len(cluster)} sources...", 55)
                    verdict_data = await synthesize_cluster(
                        cluster_dicts, profile, language, _call_llm
                    )
                    
                    # ── Normalize LLM output for Pydantic ──
                    # LLM might return "title" instead of "localized_title"
                    if "title" in verdict_data and "localized_title" not in verdict_data:
                        verdict_data["localized_title"] = verdict_data.pop("title")
                    # Ensure link is present
                    if not verdict_data.get("link"):
                        verdict_data["link"] = cluster[0].link
                    # Ensure score is int
                    if "score" in verdict_data:
                        try:
                            verdict_data["score"] = int(verdict_data["score"])
                        except (ValueError, TypeError):
                            verdict_data["score"] = 70
                    
                    # Parse into ArticleVerdict
                    from pydantic import ValidationError
                    try:
                        v = ArticleVerdict(**verdict_data)
                        if v.keep:
                            chimera_verdicts.append(v)
                            logger.info(f"   ✅ Chimera OK: \"{v.localized_title[:50]}...\"")
                    except ValidationError as e:
                        logger.warning(f"   ⚠️ Chimera verdict validation failed: {e}")
                        # Last resort: build a valid verdict from raw data
                        chimera_verdicts.append(ArticleVerdict(
                            localized_title=verdict_data.get("localized_title", verdict_data.get("title", cluster[0].title)),
                            summary=verdict_data.get("summary", ["Synthèse en cours de reconstruction."]),
                            score=verdict_data.get("score", 70),
                            keep=True,
                            category=verdict_data.get("category", "Passion"),
                            reason=verdict_data.get("reason", "Article fusionné par Chimera"),
                            credibility_score=min(10, max(0, int(verdict_data.get("credibility_score", 5)))),
                            link=verdict_data.get("link", cluster[0].link),
                            sources_count=verdict_data.get("sources_count", len(cluster)),
                            source_urls=verdict_data.get("source_urls", [a.link for a in cluster]),
                        ))
                        
                except Exception as e:
                    logger.error(f"   ❌ Chimera cluster failed: {e}")
            
            logger.info(f"   🧬 Chimera produced {len(chimera_verdicts)} fused articles")
            
            # ── Process Single-Article Clusters via Batch ──
            single_articles = [c[0] for c in single_clusters][:15]
            batch_dicts = [
                {
                    "title": a.title,
                    "url": a.link,
                    "content": a.content or "",
                    "source_interest": a.source_interest,
                }
                for a in single_articles
            ]
            
            batch_verdicts = []
            if batch_dicts:
                try:
                    _status(username, "Processing unique articles...", 70)
                    batch_verdicts = await _process_articles_in_batches(batch_dicts, profile, language)
                    batch_verdicts = [v for v in batch_verdicts if v.keep]
                    logger.info(f"   📝 Batch produced {len(batch_verdicts)} articles")
                except Exception as llm_err:
                    logger.error(f"   ❌ Batch fallback failed: {llm_err}")
            
            # ── Combine Results ──
            kept = chimera_verdicts + batch_verdicts
            
            # Last resort: if even everything failed, use minimal static data
            if not kept:
                logger.warning("All AI paths failed. Using minimal static fallback.")
                for a in (single_articles or [c[0] for c in clusters])[:3]:
                    kept.append(ArticleVerdict(
                        localized_title=a.title,
                        summary=["Résumé non disponible — consultez l'article original."],
                        score=50,
                        keep=True,
                        category="Passion",
                        reason="Article collecté automatiquement",
                        credibility_score=5,
                        link=a.link
                    ))

        logger.info(f"   ✅ Total kept: {len(kept)}")

        if not is_test and kept:
            record_processed_urls(user_id, [v.link for v in kept])

        _status(username, "Generating global digest...", 90)
        digest = await generate_global_digest(kept, profile, language)

        now = datetime.now()
        brief = {
            "date": now.strftime("%Y-%m-%d"),
            "generated_at": now.isoformat(),
            "total_collected": len(raw),
            "total_kept": len(kept),
            "duration_seconds": round(time.time() - t0, 2),
            "global_digest": digest,
            "content": [_verdict_to_dict(v) for v in kept],
        }

        if not is_test:
            _status(username, "Saving to Supabase...", 95)
            store_daily_brief(user_id, brief)

        _status(username, "Done!", 100)
        set_generation_status(username, "done", "Done!", 100)
        logger.info(f"⏱️  {time.time() - t0:.2f}s")
        
        # Log token usage summary
        from llm_wrapper import token_tracker
        logger.info(f"   {token_tracker.summary()}")
        
        return brief

    except Exception as e:
        logger.error(f"❌ Pipeline error: {e}")
        _status(username, f"Error: {e}", 0)
        set_generation_status(username, "error", f"Error: {e}", 0)
        return {"status": "error", "content": []}


# Keep old name for app.py import
update_status = _status

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
    u = sys.argv[1] if len(sys.argv) > 1 else "admin"
    l = sys.argv[2] if len(sys.argv) > 2 else "fr"
    t = int(sys.argv[3]) if len(sys.argv) > 3 else 70
    run_pipeline_for_user(u, l, t)
