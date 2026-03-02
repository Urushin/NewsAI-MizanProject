"""
Mizan.ai — Collector (Production-grade)
Async RSS collection via Google News + content extraction via Firecrawl.

Improvements over v1:
  ✅ Async with asyncio + aiohttp (no more ThreadPoolExecutor blocking FastAPI)
  ✅ Timeouts on all HTTP calls (feedparser + Firecrawl)
  ✅ Rate limiting (throttle Google News requests)
  ✅ User-Agent rotation (anti-bot evasion)
  ✅ Retry strategy with exponential backoff
  ✅ Firecrawl SDK v4+ compatible
"""
import asyncio
import json
import os
import pathlib
import random
import time
import urllib.parse
from typing import List, Optional, Callable

import feedparser
import httpx
from firecrawl import FirecrawlApp
from loguru import logger
from dotenv import load_dotenv

from models import RawArticle
from database import get_cached_content, cache_content

# ── Config ──
root_dir = pathlib.Path(__file__).parent.parent.resolve()
load_dotenv(str(root_dir / '.env'))

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")

MAX_CONTENT_CHARS = 10_000
FETCH_CONCURRENCY = 5          # Max parallel scraping (avoid rate limits)
FEED_TIMEOUT_SEC = 15          # Timeout for RSS feed fetch
SCRAPE_TIMEOUT_SEC = 30        # Timeout for Firecrawl scrape
MAX_RETRIES = 3                # Retry attempts for failed requests
RETRY_BASE_DELAY = 1.0         # Base delay for exponential backoff
GOOGLE_THROTTLE_SEC = 0.5      # Delay between Google News requests


# ── User-Agent Rotation ──
_USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0",
]


def _random_ua() -> str:
    return random.choice(_USER_AGENTS)


# ── Config Loading ──
def load_config() -> dict:
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error(f"config.json not found ({CONFIG_FILE})")
        return {}


# ── Google News URL Builder ──
_GOOGLE_NEWS_PARAMS = {
    "fr": {"hl": "fr", "gl": "FR", "ceid": "FR:fr"},
    "en": {"hl": "en-US", "gl": "US", "ceid": "US:en"},
    "ja": {"hl": "ja", "gl": "JP", "ceid": "JP:ja"},
}


def build_google_rss_url(query: str, language: str = "en") -> str:
    encoded = urllib.parse.quote(query)
    p = _GOOGLE_NEWS_PARAMS.get(language, _GOOGLE_NEWS_PARAMS["en"])
    return f"https://news.google.com/rss/search?q={encoded}&hl={p['hl']}&gl={p['gl']}&ceid={p['ceid']}"


# ── Firecrawl Singleton ──
_firecrawl_app = None


def _get_firecrawl() -> FirecrawlApp:
    global _firecrawl_app
    if _firecrawl_app is None:
        api_key = os.getenv("FIRECRAWL_API_KEY")
        if not api_key:
            logger.warning("FIRECRAWL_API_KEY is empty or not set in .env")
        _firecrawl_app = FirecrawlApp(api_key=api_key)
    return _firecrawl_app


# ── Retry Decorator ──
async def _retry_async(coro_fn, *args, max_retries=MAX_RETRIES, label=""):
    """Execute an async function with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            return await coro_fn(*args)
        except Exception as e:
            if attempt == max_retries - 1:
                logger.warning(f"⚠️ {label} failed after {max_retries} attempts: {e}")
                return None
            delay = RETRY_BASE_DELAY * (2 ** attempt) + random.uniform(0, 0.5)
            logger.debug(f"🔄 {label} attempt {attempt+1} failed, retrying in {delay:.1f}s: {e}")
            await asyncio.sleep(delay)
    return None


# ── Async RSS Feed Fetch ──
async def fetch_feed_async(source: dict, max_per_topic: int, semaphore: asyncio.Semaphore) -> list:
    """Fetch a single RSS feed with timeout and rate limiting."""
    if "url" in source:
        url = source["url"]
    elif source.get("active") and source.get("type") == "topic":
        url = build_google_rss_url(source["query"], source.get("language", "en"))
    else:
        return []

    async with semaphore:
        # Throttle Google News requests
        if "news.google.com" in url:
            await asyncio.sleep(GOOGLE_THROTTLE_SEC + random.uniform(0, 0.3))

        async def _do_fetch():
            headers = {"User-Agent": _random_ua()}
            async with httpx.AsyncClient(timeout=FEED_TIMEOUT_SEC, follow_redirects=True) as client:
                resp = await client.get(url, headers=headers)
                resp.raise_for_status()
                feed = feedparser.parse(resp.text)

            entries = []
            for entry in feed.entries[:max_per_topic]:
                entries.append({
                    "title": entry.title.strip(),
                    "link": entry.link,
                    "published": entry.get("published", "Date inconnue"),
                    "source_interest": source.get("category", "General"),
                    "summary": entry.get("summary") or entry.get("description") or "",
                })
            return entries

        result = await _retry_async(_do_fetch, label=f"Feed:{source.get('id', url[:40])}")
        return result or []


# ── Async Content Extraction (Firecrawl) ──
async def fetch_article_content_async(url: str, semaphore: asyncio.Semaphore) -> str:
    """Download and extract text via Firecrawl with timeout and retry."""
    cached = get_cached_content(url)
    if cached:
        return cached[:MAX_CONTENT_CHARS]

    async with semaphore:
        async def _do_scrape():
            app = _get_firecrawl()
            # Run Firecrawl in thread (SDK is sync)
            loop = asyncio.get_event_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(None, lambda: app.scrape(url, formats=['markdown'])),
                timeout=SCRAPE_TIMEOUT_SEC,
            )

            if result is None:
                return ""

            # Handle dict or Pydantic response
            if isinstance(result, dict):
                text = result.get('markdown', '')
            else:
                text = getattr(result, 'markdown', None) or ''

            return text

        text = await _retry_async(_do_scrape, label=f"Scrape:{url[:60]}")

        if not text:
            logger.warning(f"Firecrawl failed for {url}")
            return ""

        cache_content(url, text)
        return text[:MAX_CONTENT_CHARS]


# ── Sync wrapper for fetch_article_content (backward-compatible) ──
def fetch_article_content(url: str) -> str:
    """Sync wrapper — used by pipeline's _deep_scrape."""
    cached = get_cached_content(url)
    if cached:
        return cached[:MAX_CONTENT_CHARS]

    app = _get_firecrawl()
    for attempt in range(MAX_RETRIES):
        try:
            result = app.scrape(url, formats=['markdown'])
            if result is None:
                break

            if isinstance(result, dict):
                text = result.get('markdown', '')
            else:
                text = getattr(result, 'markdown', None) or ''

            if text:
                cache_content(url, text)
                return text[:MAX_CONTENT_CHARS]
            break
        except Exception as e:
            if attempt == MAX_RETRIES - 1:
                logger.warning(f"Firecrawl failed for {url}: {e}")
            else:
                delay = RETRY_BASE_DELAY * (2 ** attempt) + random.uniform(0, 0.5)
                time.sleep(delay)
    return ""


# ── Main Collection Function (Async) ──
async def _collect_articles_async(
    max_per_topic: int = 3,
    exclude_urls: set = None,
    progress_callback: Optional[Callable] = None,
    quick_mode: bool = False,
    skip_scraping: bool = False,
    user_interests: list = None,
) -> List[RawArticle]:
    """Async article collection with rate limiting, timeouts, and retries."""
    config = load_config()
    if not config:
        return []

    exclude_urls = exclude_urls or set()

    if progress_callback:
        progress_callback("Reading config...", 5)

    rss_sources = config.get("rss_sources", [])
    interests = user_interests if user_interests is not None else config.get("interests", [])
    all_sources = interests + rss_sources

    if quick_mode and all_sources:
        all_sources = [all_sources[0]]

    # ── Phase 1: Fetch RSS feeds (async, rate-limited) ──
    if progress_callback:
        progress_callback(f"Querying {len(all_sources)} feeds...", 10)

    feed_semaphore = asyncio.Semaphore(FETCH_CONCURRENCY)
    feed_tasks = [fetch_feed_async(src, max_per_topic, feed_semaphore) for src in all_sources]
    feed_results = await asyncio.gather(*feed_tasks, return_exceptions=True)

    raw_entries = []
    for result in feed_results:
        if isinstance(result, Exception):
            logger.error(f"Feed task error: {result}")
            continue
        raw_entries.extend(result)

    # ── Dedup by title + exclude already processed ──
    seen_titles = set()
    articles = []
    skipped = 0

    for entry in raw_entries:
        if quick_mode and len(articles) >= 3:
            break

        title = entry["title"]
        if title in seen_titles:
            continue
        seen_titles.add(title)

        if entry["link"] in exclude_urls:
            skipped += 1
            continue

        articles.append(RawArticle(
            title=title,
            link=entry["link"],
            published=entry["published"],
            source_interest=entry["source_interest"],
            content=entry.get("summary", ""),
        ))

    if skipped:
        logger.info(f"🔁 {skipped} articles skipped (already processed)")

    if not articles:
        return []

    # ── Phase 2: Extract content (async, rate-limited) ──
    if quick_mode or skip_scraping:
        return articles

    total = len(articles)
    if progress_callback:
        progress_callback(f"Extracting content ({total} articles)...", 30)

    scrape_semaphore = asyncio.Semaphore(FETCH_CONCURRENCY)
    scrape_tasks = [fetch_article_content_async(a.link, scrape_semaphore) for a in articles]
    scrape_results = await asyncio.gather(*scrape_tasks, return_exceptions=True)

    extracted = 0
    for i, result in enumerate(scrape_results):
        if isinstance(result, Exception):
            logger.error(f"Scrape task error for {articles[i].link}: {result}")
            continue
        if result:
            articles[i].content = result
            extracted += 1
        if progress_callback and i % 5 == 0:
            progress_callback(f"Extracting: {extracted}/{total}", 30 + int((i / total) * 40))

    if progress_callback:
        progress_callback(f"Extraction done ({extracted}/{total})", 70)

    logger.info(f"✅ Content extracted: {extracted}/{total}")
    return articles


# ── Public API (sync wrapper for backward compatibility) ──
def collect_articles(
    max_per_topic: int = 3,
    exclude_urls: set = None,
    progress_callback=None,
    quick_mode: bool = False,
    skip_scraping: bool = False,
    user_interests: list = None,
) -> list:
    """Collect articles from configured sources + user-specific interests.
    
    Sync wrapper around async implementation. Safe to call from sync contexts
    (pipeline CLI) — and from async contexts (FastAPI) via background tasks.
    """
    try:
        loop = asyncio.get_running_loop()
        # Already in an async context — run in a new thread to avoid nested loop issues
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(
                asyncio.run,
                _collect_articles_async(
                    max_per_topic, exclude_urls, progress_callback,
                    quick_mode, skip_scraping, user_interests,
                )
            )
            return future.result()
    except RuntimeError:
        # No event loop — safe to run directly
        return asyncio.run(
            _collect_articles_async(
                max_per_topic, exclude_urls, progress_callback,
                quick_mode, skip_scraping, user_interests,
            )
        )


if __name__ == "__main__":
    def log_prog(msg, pct):
        logger.info(f"[{pct}%] {msg}")
    results = collect_articles(progress_callback=log_prog)
    logger.info(f"✅ {len(results)} articles collected.")
