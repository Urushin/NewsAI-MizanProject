"""
Mizan.ai — Collector
Collecte RSS via Google News + extraction du contenu via trafilatura.
"""
import json
import os
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

import feedparser
import trafilatura

from models import RawArticle

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")

import time
from database import get_cached_content, cache_content

MAX_CONTENT_CHARS = 5000  # Limite pour ne pas exploser les tokens LLM
FETCH_WORKERS = 10        # Threads parallèles pour le scraping


def load_config() -> dict:
    """Charge et retourne la configuration JSON."""
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"❌ config.json introuvable ({CONFIG_FILE}).")
        return {}


def build_google_rss_url(query: str, language: str = "en") -> str:
    """Construit l'URL RSS Google News pour une requête donnée."""
    encoded = urllib.parse.quote(query)
    params = {
        "fr": {"hl": "fr", "gl": "FR", "ceid": "FR:fr"},
        "en": {"hl": "en-US", "gl": "US", "ceid": "US:en"},
        "ja": {"hl": "ja", "gl": "JP", "ceid": "JP:ja"},
    }
    p = params.get(language, params["en"])
    return f"https://news.google.com/rss/search?q={encoded}&hl={p['hl']}&gl={p['gl']}&ceid={p['ceid']}"


def fetch_article_content(url: str) -> str:
    """Télécharge et extrait le texte via trafilatura (cached)."""
    # 1. Check cache
    cached = get_cached_content(url)
    if cached:
        return cached

    # 2. Fetch
    try:
        downloaded = trafilatura.fetch_url(url)
        if downloaded is None:
            return ""
        text = trafilatura.extract(
            downloaded,
            include_comments=False,
            include_tables=True,
            deduplicate=True,
        )
        if not text:
            return ""
        
        # 3. Save cache
        cache_content(url, text)
        
        # Tronquer
        return text[:MAX_CONTENT_CHARS]
    except Exception:
        return ""


def fetch_feed(interest: dict, max_per_topic: int) -> list:
    """Fetches a single RSS feed and returns raw entries."""
    if not interest.get("active") or interest.get("type") != "topic":
        return []

    url = build_google_rss_url(interest["query"], interest.get("language", "en"))
    try:
        feed = feedparser.parse(url)
        entries = []
        for entry in feed.entries[:max_per_topic]:
            # Extract summary/description for Quick Mode
            summary = entry.get("summary") or entry.get("description") or ""
            
            # Clean HTML basic tags if needed, but LLM handles it.
            
            entries.append({
                "title": entry.title.strip(),
                "link": entry.link,
                "published": entry.get("published", "Date inconnue"),
                "source_interest": interest.get("category", "Niche"),
                "summary": summary
            })
        return entries
    except Exception as e:
        print(f"⚠️ Erreur feed {interest.get('id')}: {e}")
        return []


def collect_articles(max_per_topic: int = 3, exclude_urls: set = None, progress_callback=None, quick_mode: bool = False) -> list:
    """
    Parcourt les intérêts actifs, récupère RSS (parallèle),
    déduplique, extrait contenu (parallèle + cache).
    
    Args:
        quick_mode (bool): Si True, mode TEST. 1 seul feed, 3 articles max, pas d'extraction profonde.
    """
    config = load_config()
    if not config:
        return []

    if exclude_urls is None:
        exclude_urls = set()

    if progress_callback:
        progress_callback("Lecture de la configuration...", 5)

    interests = config.get("interests", [])
    if quick_mode and interests:
        interests = [interests[0]] # Only first feed in test mode
        if progress_callback: progress_callback("Mode TEST: Flux unique sélectionné", 10)
    
    raw_entries = []
    
    # ── Phase 1 : Collecte RSS ──────────
    if progress_callback:
        progress_callback(f"Interrogation de {len(interests)} flux RSS...", 10)
    
    # In quick_mode, maybe parallel is overkill for 1 feed, but simpler to keep structure
    with ThreadPoolExecutor(max_workers=5) as executor:
        future_to_int = {executor.submit(fetch_feed, i, max_per_topic): i for i in interests}
        for future in as_completed(future_to_int):
            raw_entries.extend(future.result())

    if progress_callback:
        progress_callback(f"Tri et déduplication...", 20)

    # Dedup
    seen_titles = set()
    articles = []
    skipped_dedup = 0

    for entry in raw_entries:
        if quick_mode and len(articles) >= 3:
            break # Hard limit 3 articles total

        if entry["title"] in seen_titles:
            continue
        seen_titles.add(entry["title"])

        if entry["link"] in exclude_urls:
            skipped_dedup += 1
            continue

        # In Quick Mode, use summary as content
        initial_content = entry.get("summary", "") if quick_mode else ""
        
        articles.append(RawArticle(
            title=entry["title"],
            link=entry["link"],
            published=entry["published"],
            source_interest=entry["source_interest"],
            content=initial_content
        ))

    if skipped_dedup:
        print(f"   🔁 {skipped_dedup} articles ignorés")

    # ── Phase 2 : Extraction Contenu ──────────
    total = len(articles)
    if total == 0:
        return []

    # QUICK MODE: Skip deep scraping
    if quick_mode:
        print(f"   🚀 Mode TEST: Extraction ignorée. {total} articles conservés.")
        if progress_callback: 
            progress_callback(f"Mode TEST: Scraping ignoré ({total} arts)", 50)
        # Use placeholders or fetch simple meta if needed?
        # The prompt will work with titles.
        return articles
        
    if progress_callback:
        progress_callback(f"Extraction du contenu ({total} articles)...", 30)

    print(f"   📥 Extraction du contenu pour {total} articles...")
    
    with ThreadPoolExecutor(max_workers=FETCH_WORKERS) as executor:
        future_to_idx = {
            executor.submit(fetch_article_content, a.link): i
            for i, a in enumerate(articles)
        }
        extracted_count = 0
        for i, future in enumerate(as_completed(future_to_idx)):
            idx = future_to_idx[future]
            try:
                content = future.result()
                if content:
                    articles[idx].content = content
                    extracted_count += 1
                
                if progress_callback and i % 5 == 0:
                    percent = 30 + int((i / total) * 40)
                    progress_callback(f"Extraction: {extracted_count}/{total}", percent)
                    
            except Exception:
                pass

    if progress_callback:
        progress_callback(f"Extraction terminée ({extracted_count}/{total} réussis)", 70)

    print(f"   ✅ Contenu extrait pour {extracted_count}/{total} articles")
    return articles


if __name__ == "__main__":
    # Test simple
    def print_prog(msg, pct):
        print(f"[{pct}%] {msg}")
    
    results = collect_articles(progress_callback=print_prog)
    print(f"✅ {len(results)} articles collectés.")
