"""
Mizan.ai — Chimera Cognitive Engine
3-Stage Multi-Source Fusion Pipeline:
  🔬 Stage 1: The Surgeon  (Local extraction via difflib)
  📋 Stage 2: The Secretary (LLM data point extraction)
  ✍️ Stage 3: The Analyst   (LLM journalistic synthesis)

All stages use mistral-small-latest via the existing llm_wrapper.
"""
import re
import difflib
from typing import List, Dict, Tuple
from loguru import logger


# ══════════════════════════════════════════
# Constants
# ══════════════════════════════════════════
SIMILARITY_THRESHOLD = 0.55       # difflib ratio to consider two sentences "same fact"
MIN_SENTENCE_LENGTH = 30          # Ignore very short sentences (noise)
MAX_COMMON_FACTS = 5              # Max "trunk" sentences to keep
MAX_UNIQUE_FACTS = 10             # Max "branch" sentences to keep
MAX_SENTENCES_PER_ARTICLE = 40    # Cap sentences extracted per article

# Regex to split text into sentences (handles ., !, ?)
_SENTENCE_SPLIT = re.compile(r'(?<=[.!?])\s+')
# Regex to clean markdown artifacts from scraped content
_MD_CLEANUP = re.compile(r'\[([^\]]+)\]\([^\)]+\)')
_URL_CLEANUP = re.compile(r'https?://\S+')
_WHITESPACE_CLEANUP = re.compile(r'\s{2,}')


# ══════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════
def _clean_text(text: str) -> str:
    """Remove markdown links, raw URLs, and excessive whitespace."""
    text = _MD_CLEANUP.sub(r'\1', text)
    text = _URL_CLEANUP.sub('', text)
    text = _WHITESPACE_CLEANUP.sub(' ', text)
    return text.strip()


def _split_sentences(text: str) -> List[str]:
    """Split text into clean sentences, filtering noise."""
    cleaned = _clean_text(text)
    raw_sentences = _SENTENCE_SPLIT.split(cleaned)
    return [
        s.strip() for s in raw_sentences
        if len(s.strip()) >= MIN_SENTENCE_LENGTH
    ][:MAX_SENTENCES_PER_ARTICLE]


def _extract_source_domain(url: str) -> str:
    """Extract a clean domain name from a URL."""
    try:
        from urllib.parse import urlparse
        hostname = urlparse(url).hostname or ""
        return hostname.replace("www.", "")
    except Exception:
        return "source"


def _sentence_similarity(a: str, b: str) -> float:
    """Compute similarity ratio between two sentences using difflib."""
    return difflib.SequenceMatcher(None, a.lower(), b.lower()).ratio()


# ══════════════════════════════════════════
# STAGE 1: The Secretary (LLM Data Points per Article)
# ══════════════════════════════════════════
SECRETARY_SYSTEM_PROMPT = """You are a data extraction AI. Your role is to transform a single news article into clean, factual data points.
Rules:
- Output ONLY a JSON array of strings
- Each string is a single factual data point
- Keep each point to 1 sentence max
- Write in the user's language
- No markdown, no explanation, ONLY the JSON array"""

def build_secretary_prompt(article_content: str, lang: str) -> str:
    """Build the prompt for the Secretary stage for a single article."""
    return f"""Language: {lang}

Extract ALL key factual data points from the following article content.
Output ONLY a clean JSON array of strings.

Content:
{article_content[:5000]}"""


# ══════════════════════════════════════════
# STAGE 2: The Surgeon (Local Extraction & Grouping)
# ══════════════════════════════════════════
def group_data_points(articles_data: List[Tuple[str, List[str]]]) -> Dict[str, List[str]]:
    """
    Extract the 'common trunk' (shared facts) and 'unique branches' 
    (divergent info) from a list of articles' data points.
    
    Args:
        articles_data: List of (source, data_points)
        
    Returns:
        {
            "common": ["Fact shared across sources...", ...],
            "unique": ["[reuters.com] Unique detail...", ...]
        }
    """
    if not articles_data:
        return {"common": [], "unique": []}
    
    if len(articles_data) == 1:
        # Single article
        src, points = articles_data[0]
        return {
            "common": points[:MAX_COMMON_FACTS],
            "unique": []
        }
    
    # Compare points from the first article against ALL other articles
    base_source, base_points = articles_data[0]
    other_articles = articles_data[1:]
    
    common_sentences = []
    unique_sentences = []
    
    for base_point in base_points:
        is_common = False
        for other_source, other_points in other_articles:
            for other_point in other_points:
                if _sentence_similarity(base_point, other_point) >= SIMILARITY_THRESHOLD:
                    is_common = True
                    break
            if is_common:
                break
        
        if is_common:
            common_sentences.append(base_point)
        else:
            unique_sentences.append(f"[{base_source}] {base_point}")
    
    # Find Unique Branches from other articles
    for other_source, other_points in other_articles:
        for other_point in other_points:
            has_match = False
            for base_point in base_points:
                if _sentence_similarity(other_point, base_point) >= SIMILARITY_THRESHOLD:
                    has_match = True
                    break
            
            if not has_match:
                unique_sentences.append(f"[{other_source}] {other_point}")
    
    # Trim to limits
    common_sentences = common_sentences[:MAX_COMMON_FACTS]
    unique_sentences = unique_sentences[:MAX_UNIQUE_FACTS]
    
    logger.info(
        f"   🔬 Surgeon: {len(common_sentences)} common facts, "
        f"{len(unique_sentences)} unique branches from {len(articles_data)} articles"
    )
    
    return {
        "common": common_sentences,
        "unique": unique_sentences
    }


# ══════════════════════════════════════════
# STAGE 3: The Analyst (LLM Synthesis)
# ══════════════════════════════════════════
def build_analyst_system_prompt(profile: dict) -> str:
    """Build the system prompt for the Analyst stage, respecting summary_length preference."""
    level = profile.get("preferences", {}).get("summary_length", 1)
    
    if level == 1:
        style = "exactly 3 very short bullet points (max 100 chars each)"
    elif level == 2:
        style = "a medium-length paragraph of 3 concatenated sentences"
    elif level == 3:
        style = "a structured paragraph of about 250 words with context"
    else:
        style = "a deep analytical summary of 400+ words with geopolitical/economic implications"
    
    return f"""You are a senior intelligence analyst writing a synthesis report.
You receive pre-processed data points from multiple news sources.
Your job is to write a single, cohesive synthesis that:
- Merges all information into a fluid journalistic narrative
- Explicitly mentions when sources contradict each other ("Selon X... mais Y affirme...")
- Attributes key claims to their sources
- Highlights the most impactful implications

Output ONLY valid JSON with these exact fields:
- "localized_title": string (Mandatory: Write a highly informative, concrete journalistic title in the user's language. The title MUST contain the core factual information. DO NOT use generic titles, clickbait, or meta-descriptions like 'An article about...'. Automatically remove publisher tags like [VC Now].)
- "summary": array of strings ({style})
- "score": int 0-100 (relevance to the user)
- "keep": bool (true if the synthesis contains actual factual news value. False if it lacks concrete information or is purely an empty shell)
- "category": "Impact" or "Passion" or "Tech" or "Politik" or "Business" or "World" or "Security" or "Trending"
- "sub_category": string (CRITICAL: Be extremely specific. DO NOT use generic terms like 'Général', 'News' or 'Actualité'. Use thematic clusters like 'Entrepreneuriat Féminin', 'Marché Immobilier', 'Tensions au Moyen-Orient', 'IA Géopolitique', etc.)
- "reason": string (1 very direct sentence explaining the core consequence or impact of this news. Do NOT use introductory phrases like 'Ce sujet est pertinent pour...' or 'Cette information montre que...'. Go straight to the point.)
- "credibility_score": int 0-10 (average source reliability)

Output ONLY the JSON object. No markdown, no explanation."""


def build_analyst_prompt(
    extracted_facts: Dict[str, List[str]], 
    profile: dict, 
    lang: str, 
    sources: List[str],
    original_titles: List[str]
) -> str:
    """Build the prompt for the Analyst stage."""
    import json
    
    identity = json.dumps(profile.get("identity", {}), ensure_ascii=False)
    interests = json.dumps(profile.get("interests", {}), ensure_ascii=False)
    
    common_text = "\n".join(f"- {s}" for s in extracted_facts["common"])
    unique_text = "\n".join(f"- {s}" for s in extracted_facts["unique"])
    titles_text = "\n".join(f"- {t}" for t in original_titles)
    sources_text = ", ".join(set(sources))
    
    return f"""User identity: {identity}
User interests: {interests}
Language: {lang}

IMPORTANT IMPACT RULE: If the article directly impacts the user's daily life based on their identity (age, location, occupation etc), keep it and explicitly state why in the 'reason' field instead of just saying "it matches your interests".

Original article titles covering this topic:
{titles_text}

Sources: {sources_text}

COMMON FACTS (reported by multiple sources):
{common_text if common_text else "(none)"}

UNIQUE/DIVERGENT INFORMATION (from specific sources):
{unique_text if unique_text else "(none)"}

Write a single JSON object synthesizing ALL the above data points into one cohesive article."""


# ══════════════════════════════════════════
# ORCHESTRATOR: Full Chimera Pipeline
# ══════════════════════════════════════════
import asyncio

async def synthesize_cluster(
    cluster_articles: List[Dict],
    profile: dict,
    lang: str,
    call_llm_fn,
) -> Dict:
    """
    Run the full 3-stage Chimera pipeline on a cluster of related articles.
    """
    cluster_title = cluster_articles[0].get("title", "Unknown")[:60]
    logger.info(f"   🧬 Chimera: Processing cluster \"{cluster_title}...\" ({len(cluster_articles)} articles)")
    
    # ── Stage 1: The Secretary (Fact extraction per article) ──
    # Run LLM calls concurrently for all articles. Caching handles duplicates perfectly!
    async def _extract_points(article: Dict) -> Tuple[str, List[str]]:
        source = _extract_source_domain(article.get("url", ""))
        content = article.get("content", "")
        if not content:
            return source, []
            
        prompt = build_secretary_prompt(content, lang)
        try:
            raw_dp = await call_llm_fn(prompt, SECRETARY_SYSTEM_PROMPT)
            from llm_wrapper import parse_llm_json
            dp_list = parse_llm_json(raw_dp)
            if isinstance(dp_list, dict):
                for v in dp_list.values():
                    if isinstance(v, list):
                        dp_list = v
                        break
            if not isinstance(dp_list, list):
                dp_list = [str(dp_list)]
            return source, [str(dp) for dp in dp_list if dp]
        except Exception as e:
            logger.warning(f"   ⚠️ Secretary failed for {source}: {e}")
            return source, _split_sentences(content)[:5] # Fallback to 5 sentences
            
    tasks = [_extract_points(a) for a in cluster_articles]
    articles_data = await asyncio.gather(*tasks)
    
    # ── Stage 2: The Surgeon (Grouping facts locally) ──
    extracted_facts = group_data_points(articles_data)
    
    # ── Stage 3: The Analyst (LLM Synthesis) ──
    original_titles = [a.get("title", "") for a in cluster_articles]
    source_urls = [a.get("url", "") for a in cluster_articles]
    sources = [data[0] for data in articles_data]
    
    analyst_prompt = build_analyst_prompt(
        extracted_facts, profile, lang, sources, original_titles
    )
    analyst_system = build_analyst_system_prompt(profile)
    
    try:
        raw_verdict = await call_llm_fn(analyst_prompt, analyst_system)
        
        from llm_wrapper import parse_llm_json
        verdict_data = parse_llm_json(raw_verdict)
        
        if isinstance(verdict_data, list) and verdict_data:
            if isinstance(verdict_data[0], str):
                # The LLM hallucinated just the summary list instead of the full dict. Recover it!
                verdict_data = {
                    "localized_title": cluster_articles[0].get("title", "Actualité"),
                    "summary": verdict_data,
                    "score": 75,
                    "keep": True,
                    "category": "Passion",
                    "reason": "Synthèse récupérée à partir d'une réponse partielle de l'IA.",
                    "credibility_score": 6
                }
            else:
                # If the LLM returned a list of dicts, take the first one
                verdict_data = verdict_data[0]
            
        if not isinstance(verdict_data, dict):
            raise ValueError(f"LLM returned non-dict Analyst payload. Type: {type(verdict_data)}. Content: {str(verdict_data)[:100]}")
        
        # Inject fusion metadata
        verdict_data["sources_count"] = len(cluster_articles)
        verdict_data["source_urls"] = source_urls
        
        # Ensure link is set
        if not verdict_data.get("link"):
            verdict_data["link"] = source_urls[0] if source_urls else ""
        
        logger.info(f"   ✍️ Analyst: Synthesis complete for \"{verdict_data.get('localized_title', cluster_title)[:50]}...\"")
        
        return verdict_data
        
    except Exception as e:
        import traceback
        logger.error(f"   ❌ Chimera Fusion failed: {e}\n{traceback.format_exc()}")
        return {
            "localized_title": cluster_articles[0].get("title", "Article"),
            "summary": ["Synthèse non disponible — consultez les articles originaux."],
            "score": 50,
            "keep": True,
            "category": "Passion",
            "reason": "Article collecté automatiquement",
            "credibility_score": 5,
            "link": source_urls[0] if source_urls else "",
            "sources_count": len(cluster_articles),
            "source_urls": source_urls,
        }
