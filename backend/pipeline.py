"""
Mizan.ai — Pipeline (Multi-User)
Runs the ETL pipeline for a specific user.
"""
import json
import os
import sys
import time
from datetime import datetime
from typing import List, Dict, Optional
from pydantic import ValidationError

from models import RawArticle, AnalyzedArticle, DailyBrief
from collector import collect_articles
from llm_wrapper import get_providers
from database import (
    get_recent_processed_urls, record_processed_urls,
    purge_old_processed, get_user_by_username,
)

MAX_RETRIES = 2
BASE_WAIT = 2
MANIFESTS_DIR = os.path.join(os.path.dirname(__file__), "manifests")
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
FRONTEND_PUBLIC = os.path.join(os.path.dirname(os.path.dirname(__file__)), "daily-brief-ui", "public")


def load_manifesto(username: str) -> str:
    path = os.path.join(MANIFESTS_DIR, f"{username}.txt")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    return "Strict filter. Keep only major verifiable facts."


def build_prompt(articles: list, manifesto: str, language: str, score_threshold: int) -> str:
    """
    Build the AI prompt. Language instruction is injected HERE, not in the manifesto.
    Articles now include content_preview for informed analysis.
    """
    lang_instructions = {
        "fr": "Traduis TOUJOURS les titres et résumés en FRANÇAIS, même si la source est anglaise.",
        "en": "ALL titles and summaries MUST be in ENGLISH, regardless of original language.",
        "ja": "すべてのタイトルと要約は必ず日本語で書いてください。元の言語に関係なく。",
    }
    lang_line = lang_instructions.get(language, lang_instructions["en"])

    lang_names = {"fr": "français", "en": "English", "ja": "日本語"}
    lang_name = lang_names.get(language, "English")

    return f"""Tu es un FILTRE D'INTELLIGENCE. Pas un assistant. Un analyste froid.

═══ MANIFESTO DE L'UTILISATEUR ═══
{manifesto}

═══ GRILLE DE SCORING (STRICTE) ═══
90-100 : Fait majeur, chiffres précis, impact direct (loi votée, crash >5%, sortie officielle)
70-89  : Info intéressante avec données concrètes, mais pas urgente
50-69  : Pertinent au profil mais manque de substance factuelle
0-49   : Bruit, opinion, rumeur, hors-profil → REJETER

═══ RÈGLES ═══
1. Score < {score_threshold} → "keep": false. Pas de négociation.
2. Résumé : 2-3 lignes MAX. Chiffres obligatoires si disponibles.
3. Catégorie : Utilise EXACTEMENT une de ces valeurs → "Politique & Monde", "Investissement & Crypto", "Tech & IA", "Culture & Manga", "Sport & Combat", "Niche"
4. Conserve le lien (link) original de chaque article.
5. LANGUE DE SORTIE ({lang_name}) : {lang_line}
6. UTILISE LE CONTENU (content_preview) pour scorer et résumer — ne te base PAS uniquement sur le titre.
   Si content_preview est vide, juge sur le titre seul et baisse le score de 10 points.

═══ ARTICLES À ANALYSER ═══
{json.dumps(articles, ensure_ascii=False)}

═══ FORMAT DE SORTIE ═══
Renvoie UNIQUEMENT un tableau JSON valide, sans texte autour, sans markdown :
[
  {{
    "title": "Titre en {lang_name}",
    "category": "Catégorie",
    "score": 85,
    "summary": "Résumé en {lang_name} basé sur le contenu réel...",
    "keep": true,
    "link": "https://..."
  }}
]"""


def analyze_batch(articles: list, manifesto: str, language: str, score_threshold: int) -> list:
    """Analyze a batch of RawArticles with the LLM, including content previews."""
    payload = []
    for a in articles:
        preview = a.content[:500] + "..." if len(a.content) > 500 else a.content
        if not preview:
            preview = "(Contenu inaccessible, juger sur le titre uniquement)"
        payload.append({
            "title": a.title,
            "link": a.link,
            "source_interest": a.source_interest,
            "content_preview": preview,
        })
    prompt = build_prompt(payload, manifesto, language, score_threshold)

    providers = get_providers()
    if not providers:
        print("❌ CRITIQUE : Aucune API Key configurée.")
        return []

    for attempt in range(MAX_RETRIES):
        for provider in providers:
            try:
                print(f"      👉 Tentative avec {provider.name}...")
                text = provider.generate(prompt)

                # Clean markdown wrappers
                text = text.strip()
                if text.startswith("```"):
                    text = text.split("\n", 1)[1] if "\n" in text else text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()

                raw = json.loads(text)

                # Handle both array and object-wrapped formats
                if isinstance(raw, dict):
                    raw_list = None
                    for v in raw.values():
                        if isinstance(v, list):
                            raw_list = v
                            break
                    if raw_list is None:
                        raise ValueError(f"JSON object sans tableau: {list(raw.keys())}")
                elif isinstance(raw, list):
                    raw_list = raw
                else:
                    raise ValueError(f"Format JSON inattendu: {type(raw)}")

                validated = []
                for item in raw_list:
                    try:
                        validated.append(AnalyzedArticle(**item))
                    except (ValidationError, TypeError):
                        pass
                return validated

            except Exception as e:
                print(f"         ⚠️ Échec {provider.name} : {e}")
                continue

        wait = BASE_WAIT * (2 ** attempt)
        print(f"   ⏳ Tous les providers ont échoué. Pause {wait}s...")
        time.sleep(wait)

    print("   ❌ Abandon du batch.")
    return []


def generate_daily_brief(articles: list, manifesto: str, language: str) -> str:
    """Generate the final HTML brief from selected articles."""
    if not articles:
        return "<p>Aucun article pertinent aujourd'hui.</p>"

    lang_names = {"fr": "Français", "en": "English", "ja": "Japanese"}
    lang_name = lang_names.get(language, "English")

    articles_json = json.dumps([a.model_dump() for a in articles], ensure_ascii=False)

    prompt = f"""
RÔLE : Rédacteur en chef d'un média d'élite.
TON : Synthétique, percutant, factuel. Pas de bla-bla.
LANGUE : {lang_name}

TACHE : Rédige une "Daily Brief" HTML à partir des articles suivants.

CONTRAINTES HTML :
- Utilise des balises <h2> pour les catégories.
- Utilise <ul> et <li> pour les articles.
- Pour chaque article :
  - Titre en <strong> avec un lien <a href="...">.
  - Résumé court juste après.
  - Score de pertinence entre parenthèses (ex: "Score: 85").
- Ajoute une section "💡 L'Insight du Jour" à la fin (synthèse globale en 2 phrases).
- CSS minimaliste inline autorisé (ex: style="color: #333").

MANIFESTO UTILISATEUR :
{manifesto}

ARTICLES :
{articles_json}

FORMAT DE SORTIE :
Uniquement le code HTML (pas de ```html, pas de préambule).
"""

    providers = get_providers()
    if not providers:
        return "<p>Erreur: Aucun provider IA disponible.</p>"

    for attempt in range(MAX_RETRIES):
        for provider in providers:
            try:
                print(f"      👉 Génération du brief avec {provider.name}...")
                html = provider.generate(prompt)
                
                # Cleanup
                if html.startswith("```"):
                    html = html.split("\n", 1)[1] if "\n" in html else html[3:]
                if html.endswith("```"):
                    html = html[:-3]
                
                return html.strip()
            except Exception as e:
                print(f"         ⚠️ Échec génération : {e}")
                continue
        time.sleep(2)

    return "<p>Erreur lors de la génération du brief.</p>"

# Global status tracker: { "username": { "status": "running", "step": "Initialisation...", "percent": 0 } }
GENERATION_STATUS = {}

def update_status(username: str, step: str, percent: int):
    """Updates the generation status for a user."""
    GENERATION_STATUS[username] = {
        "status": "running",
        "step": step,
        "percent": percent,
        "updated_at": time.time()
    }

def run_pipeline_for_user(username: str, language: str = "fr", score_threshold: int = 70, mode: str = "prod") -> dict:
    """
    Run the full ETL pipeline for a specific user with progress tracking.
    mode: "prod" (default, full scrape, save DB) or "test" (quick scrape, no DB).
    """
    start = time.time()
    update_status(username, f"[{mode.upper()}] Chargement du profil...", 0)
    
    try:
        manifesto = load_manifesto(username)
        
        # Test Mode settings
        is_test = (mode == "test")
        batch_size = 20 if not is_test else 5

        # Callback for collector
        def collect_progress(msg, pct):
            update_status(username, msg, pct)

        # Resolve user_id for dedup
        user = get_user_by_username(username)
        user_id = user["id"] if user else None

        # Anti-doublon (History) - Only in PROD
        exclude_urls = set()
        if not is_test and user_id:
            exclude_urls = get_recent_processed_urls(user_id, days=7)
            if exclude_urls:
                print(f"   🔁 [{username}] {len(exclude_urls)} URLs déjà vues (7j)")

        # Collect
        update_status(username, "Collecte des sources...", 5)
        print(f"\n📡 [{username}] Collecte des sources (Mode: {mode})...")
        
        # In Test Mode, use quick_mode=True
        raw_articles = collect_articles(
            exclude_urls=exclude_urls, 
            progress_callback=collect_progress,
            quick_mode=is_test
        )
        print(f"   ✅ {len(raw_articles)} articles uniques récupérés.\n")

        if not raw_articles:
            print("❌ Aucun article trouvé.")
            update_status(username, "Aucun article trouvé", 100)
            return {"status": "empty", "total_collected": 0, "total_kept": 0}

        # ── DEDUPLICATION (Content Similarity) ──
        # Simple Jaccard similarity to remove near-duplicates
        def get_tokens(text):
            return set(w.lower() for w in text.split() if len(w) > 3)

        def jaccard_similarity(t1, t2):
            s1 = get_tokens(t1)
            s2 = get_tokens(t2)
            if not s1 or not s2: return 0.0
            return len(s1.intersection(s2)) / len(s1.union(s2))

        unique_articles = []
        if raw_articles:
            update_status(username, "Dé-duplication intelligente...", 20)
            
            # Sort by length desc (keep longest)
            sorted_arts = sorted(raw_articles, key=lambda x: len(x.content or ""), reverse=True)
            
            for art in sorted_arts:
                is_dup = False
                for seen in unique_articles:
                    # Title check
                    if art.title == seen.title: 
                        is_dup = True
                        break
                    # Content check (skip if too short or empty)
                    if art.content and seen.content:
                        sim = jaccard_similarity(art.content, seen.content)
                        if sim > 0.5: 
                            is_dup = True
                            break
                if not is_dup:
                    unique_articles.append(art)
            
        raw_articles = unique_articles # Continue with unique

        # Analyze
        update_status(username, "Analyse IA en cours...", 30)
        print(f"🧠 [{username}] Analyse de {len(raw_articles)} articles avec Mistral...")
        
        kept_articles = []
        total_batches = (len(raw_articles) + batch_size - 1) // batch_size
        if total_batches < 1: total_batches = 1
        
        for i in range(0, len(raw_articles), batch_size):
            batch_num = (i // batch_size) + 1
            percent = 30 + int((batch_num / total_batches) * 50) # 30% to 80%
            update_status(username, f"Analyse par l'IA (lot {batch_num}/{total_batches})...", percent)
            
            batch = raw_articles[i:i + batch_size]
            
            analyzed_batch = analyze_batch(batch, manifesto, language, score_threshold)
            kept_articles.extend(analyzed_batch)
            
            if i + batch_size < len(raw_articles):
                time.sleep(0.5)

        print(f"   ✅ {len(kept_articles)} articles sélectionnés par l'IA.")

        # Save processed URLs - Only in PROD
        if not is_test and user_id and kept_articles:
            urls_to_save = [a.link for a in kept_articles]
            record_processed_urls(user_id, urls_to_save)
            purge_old_processed(days=7)

        # Generate Brief
        update_status(username, "Rédaction du journal...", 85)
        brief_html = generate_daily_brief(kept_articles, manifesto, language)
        brief_data = {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "content": [a.model_dump() for a in kept_articles], # Frontend expects Array here
            "html": brief_html,
            "stats": {
                "total_scanned": len(raw_articles),
                "kept": len(kept_articles),
                "duration": round(time.time() - start, 2),
                "mode": mode
            }
        }

        # Save - Only in PROD
        if not is_test:
            update_status(username, "Sauvegarde et archivage...", 95)
            brief_json = json.dumps(brief_data, ensure_ascii=False, indent=2)
            
            # 1. Main file
            brief_path = os.path.join(DATA_DIR, "briefs", f"{username}.json")
            os.makedirs(os.path.dirname(brief_path), exist_ok=True)
            with open(brief_path, "w", encoding="utf-8") as f:
                f.write(brief_json)
            
            # 2. Archive
            timestamp = datetime.now().strftime("%H-%M-%S")
            date_str = datetime.now().strftime("%Y-%m-%d")
            archive_dir = os.path.join(DATA_DIR, "briefs", username)
            os.makedirs(archive_dir, exist_ok=True)
            archive_path = os.path.join(archive_dir, f"brief_{date_str}_{timestamp}.json")
            with open(archive_path, "w", encoding="utf-8") as f:
                f.write(brief_json)
            
            # 3. Public
            public_dir = os.path.join(os.path.dirname(__file__), "../daily-brief-ui/public/data")
            os.makedirs(public_dir, exist_ok=True)
            public_path = os.path.join(public_dir, "brief.json")
            if username == "admin": 
                with open(public_path, "w", encoding="utf-8") as f:
                    f.write(brief_json)

        update_status(username, "Terminé !", 100)
        GENERATION_STATUS[username]["status"] = "done"
        
        print(f"⏱️  Durée totale : {time.time() - start:.2f}s")
        return brief_data

    except Exception as e:
        print(f"❌ Erreur pipeline: {e}")
        update_status(username, f"Erreur: {str(e)}", 0)
        if username in GENERATION_STATUS:
            GENERATION_STATUS[username]["status"] = "error"
        return {}


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

    username = sys.argv[1] if len(sys.argv) > 1 else "admin"
    lang = sys.argv[2] if len(sys.argv) > 2 else "fr"
    threshold = int(sys.argv[3]) if len(sys.argv) > 3 else 70
    run_pipeline_for_user(username, lang, threshold)
