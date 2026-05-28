"""
NewsAI — Synthesis Module
Logic for AI analysis of articles (Batch evaluation and Global Digest).
"""
import json
import asyncio
import time
import re
from typing import List, Optional, Dict, Any
from loguru import logger
from models import ArticleVerdict
from llm_wrapper import get_providers, parse_llm_json, langfuse
from database import get_media_metadata
from chimera import _extract_source_domain

# ── Batch Config ──
BATCH_SIZE = 5

# ── Synthesis Prompts ──

def get_system_prompt_final_pass(profile: Dict[str, Any]) -> str:
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
CRITICAL OVERRIDE: If the user provided 'identity' (Contexte de Vie) like age, location, or occupation, you MUST highly score and KEEP any news (laws, taxes, local events, industry changes) that directly impacts them in real life, even if outside their usual interests.
Output ONLY valid JSON. No markdown, no explanation.
For each article, return a JSON object with these exact fields:
- "localized_title": string (Concrete journalistic title)
{summary_instruction}
- "score": int 0-100
- "keep": bool
- "category": "Impact" | "Passion" | "Tech" | "Politik" | "Business" | "World" | "Security" | "Trending"
- "sub_category": string
- "reason": string
- "credibility_score": int 0-100 (source reliability / relevance to general news)(100 = neutre/factuel, <60 = orienté, <40 = manipulateur)
- "neutrality_score": int 0-100 (100 = neutre/factuel, <60 = orienté, <40 = manipulateur)
- "detected_biases": array of strings (ex: ["Pente Glissante", "Faux Dilemme", "Cadrage Idéologique"])
- "bias_details": array of objects [{{"label": "Nom du biais", "reason": "Exemple concret dans l'article"}}]
- "primary_evidence": string | null (Ex: "Confirmé par Reuters 14:30")

COGNITIVE BIAS CODEX:
1. Pente Glissante: Prétendre qu'une étape mènera à une catastrophe sans preuve.
2. Faux Dilemme: Réduire à deux options opposées.
3. Homme de Paille: Déformer l'argument pour l'attaquer.
4. Cadrage (Framing): Utiliser des mots chargés (ex: "cure d'austérité" vs "optimisation").
5. Appel à la Peur: Mots apocalyptiques pour paralyser le jugement.
6. Fausse Équivalence: Donner le même poids à des faits et des rumeurs.

Return a JSON array of objects.
"""

SYSTEM_PROMPT_DIGEST = """You are a news synthesis AI. Given a list of filtered articles, write a concise 3-sentence executive summary of the user's day in news. Write in the user's language. Output only the summary text, no JSON."""

# ── Internal Helpers ──

def _profile_context(profile: Dict[str, Any]) -> str:
    """Build a compact profile context string for LLM prompts."""
    identity = json.dumps(profile.get("identity", {}), ensure_ascii=False)
    interests = json.dumps(profile.get("interests", {}), ensure_ascii=False)
    rules = json.dumps(profile.get("rejection_rules", []), ensure_ascii=False)
    return f"User identity: {identity}\nInterests: {interests}\nBlock rules: {rules}"

def _build_batch_prompt(articles: List[Dict[str, Any]], profile: Dict[str, Any], lang: str) -> str:
    """Build a prompt for batched article evaluation with Head-Tail Truncation."""
    profile_ctx = _profile_context(profile)
    article_list = []
    
    # Regex to strip simple markdown hyperlinks [text](url) to just text, saving chunks of tokens
    md_link_pattern = re.compile(r'\[([^\]]+)\]\([^\)]+\)')
    
    for i, a in enumerate(articles):
        raw_content = a.get("content", "")
        cleaned_content = md_link_pattern.sub(r'\1', raw_content)
        
        # Head-Tail Clipping
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

IMPORTANT IMPACT RULE: If the article directly impacts the user's daily life based on their 'identity', keep it and explain why in the 'reason' field.

Evaluate these {len(articles)} top matched articles:

{articles_text}

Return a JSON array with one object per article.
"""

async def call_llm(prompt: str, system_prompt: str) -> str:
    """Call the first available LLM provider."""
    providers = get_providers()
    if not providers:
        raise RuntimeError("No LLM provider available.")

    last_error = None
    for provider in providers:
        try:
            logger.debug(f"   📡 Calling {provider.name}...")
            return await provider.generate(prompt, system_prompt)
        except Exception as e:
            logger.warning(f"   ⚠️ LLM error ({provider.name}): {e}")
            last_error = e

    raise RuntimeError(f"All LLM providers failed. Last error: {last_error}")

def _parse_verdicts(raw_text: str, urls: List[str], titles: List[str]) -> List[ArticleVerdict]:
    """Parse LLM JSON output into strict ArticleVerdict objects."""
    try:
        data = parse_llm_json(raw_text)
    except Exception as e:
        logger.error(f"Failed to parse LLM JSON: {e}")
        return []

    if not isinstance(data, list):
        data = [data]

    verdicts = []
    from pydantic import ValidationError
    
    for i, item in enumerate(data):
        try:
            if not item.get("link") and i < len(urls):
                item["link"] = urls[i]
            if "localized_title" not in item:
                item["localized_title"] = titles[i] if i < len(titles) else "Unknown"

            v = ArticleVerdict(**item)
            verdicts.append(v)
        except ValidationError as e:
            logger.warning(f"Pydantic Validation Error on output #{i}: {e.errors()}")
        except Exception as e:
            logger.warning(f"Skipping invalid verdict #{i}: {e}")

    return verdicts

# ── Public Methods ──

@langfuse.observe(name="Synthesis: Batch Process")
async def process_articles_in_batches(articles: List[Dict[str, Any]], profile: Dict[str, Any], lang: str) -> List[ArticleVerdict]:
    """Split articles into batches and process them through the LLM in parallel."""
    all_verdicts = []
    batches = [articles[i : i + BATCH_SIZE] for i in range(0, len(articles), BATCH_SIZE)]
    
    logger.info(f"   ⚙️ Processing {len(batches)} batches in parallel...")
    
    async def _handle_batch(batch, batch_idx):
        try:
            prompt = _build_batch_prompt(batch, profile, lang)
            raw_response = await call_llm(prompt, get_system_prompt_final_pass(profile))
            
            urls = [a.get("url") for a in batch]
            titles = [a.get("title") for a in batch]
            return _parse_verdicts(raw_response, urls, titles)
        except Exception as e:
            logger.error(f"   ❌ Batch {batch_idx + 1} failed: {e}")
            return []

    results = await asyncio.gather(*[_handle_batch(b, i) for i, b in enumerate(batches)])
    for res in results:
        all_verdicts.extend(res)
            
    return all_verdicts

@langfuse.observe(name="Synthesis: Global Digest")
async def generate_global_digest(articles: List[ArticleVerdict], profile: Dict[str, Any], lang: str) -> str:
    """Generate a 3-sentence executive summary of all kept articles."""
    if not articles:
        return ""

    profile_ctx = _profile_context(profile)
    titles = "\n".join(f"- {v.localized_title} ({v.category}, score {v.score})" for v in articles[:20])

    prompt = f"""{profile_ctx}

Language: {lang}

Today's filtered articles:
{titles}

Write a concise 3-sentence executive summary of today's news for this user."""

    try:
        return (await call_llm(prompt, SYSTEM_PROMPT_DIGEST)).strip()
    except Exception as e:
        logger.error(f"Digest generation failed: {e}")
        return ""
