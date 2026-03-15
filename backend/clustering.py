"""
NewsAI — Clustering Module
Logic for grouping similar articles together to avoid redundancy.
"""
import re
import difflib
from typing import List, Set
from loguru import logger
from models import RawArticle
from llm_wrapper import langfuse

# Common stop words (EN + FR) to ignore during keyword extraction
STOP_WORDS = {
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

# Clustering config
CLUSTER_THRESHOLD = 0.45   # Higher = stricter
MAX_CLUSTER_SIZE = 4       # Cap: no cluster bigger than 4 articles
SHINGLE_SIZE = 2           # Word-based shingles for blocking strategy

def extract_keywords(text: str, top_n: int = 12) -> Set[str]:
    """Extract significant keywords from text for topic matching."""
    text = text.lower()
    words = re.findall(r'[a-zA-ZÀ-ÿ]{3,}', text)
    # Count word frequency
    freq = {}
    for w in words:
        if w not in STOP_WORDS:
            freq[w] = freq.get(w, 0) + 1
    # Return top N by frequency
    sorted_words = sorted(freq.items(), key=lambda x: -x[1])
    return {w for w, _ in sorted_words[:top_n]}

def get_title_shingles(title: str, size: int = 2) -> Set[str]:
    """Generate word-based shingles for fast candidate lookup (blocking)."""
    words = [w for w in re.findall(r'[a-zA-ZÀ-ÿ]{3,}', title.lower()) if w not in STOP_WORDS]
    if len(words) < size:
        return set(words)
    return {" ".join(words[i:i+size]) for i in range(len(words) - size + 1)}

def calculate_article_similarity(a: RawArticle, b: RawArticle) -> float:
    """
    Compute similarity between two articles. We group articles that
    are about the EXACT same subject using String comparison + Keyword overlapping.
    """
    title_a = a.title.lower()
    title_b = b.title.lower()
    
    # Signal 1: Title string similarity
    title_sim = difflib.SequenceMatcher(None, title_a, title_b).ratio()
    
    # Signal 2: Keyword overlap in title/content
    a_kw = extract_keywords(title_a + " " + (a.content or "")[:200], top_n=5)
    b_kw = extract_keywords(title_b + " " + (b.content or "")[:200], top_n=5)
    
    overlap = len(a_kw.intersection(b_kw))
    
    # If they share at least 2 strong keywords, we consider them same topic
    if overlap >= 2:
        return 0.8
    # If they share 1 strong keyword and have a baseline text resemblance
    if overlap == 1 and title_sim > 0.15:
        return 0.5
        
    # Content similarity as fallback for poorly titled articles
    content_a = (a.content or "")[:500].lower()
    content_b = (b.content or "")[:500].lower()
    if content_a and content_b:
        content_sim = difflib.SequenceMatcher(None, content_a, content_b).ratio()
    else:
        content_sim = 0.0
        
    score = (title_sim * 0.60) + (content_sim * 0.40)
    
    if title_sim >= 0.40:
        score = max(score, title_sim)
        
    return score

@langfuse.observe(name="Clustering: Grouping")
def cluster_articles(articles: List[RawArticle]) -> List[List[RawArticle]]:
    """
    Group articles about the SAME event.
    Scalable implementation using Inverted Index Blocking (LSH-lite strategy).
    Complexity: O(N * average_candidates_per_article) instead of O(N^2).
    """
    clusters: List[List[RawArticle]] = []
    # Map from shingle -> list of cluster indices
    shingle_index: Dict[str, Set[int]] = {}
    
    # Pre-cache keywords and shingles to avoid redundant computation
    article_meta = []
    for art in articles:
        article_meta.append({
            "shingles": get_title_shingles(art.title, SHINGLE_SIZE),
            "keywords": extract_keywords(art.title + " " + (art.content or "")[:200], top_n=5)
        })

    for i, article in enumerate(articles):
        meta = article_meta[i]
        best_score = 0.0
        best_cluster_idx = -1
        
        # 1. Candidate Selection via Inverted Index
        candidate_indices = set()
        for shingle in meta["shingles"]:
            if shingle in shingle_index:
                candidate_indices.update(shingle_index[shingle])
        
        # 2. Refined Comparison (only against candidates)
        for idx in candidate_indices:
            cluster = clusters[idx]
            if len(cluster) >= MAX_CLUSTER_SIZE:
                continue
            
            # Use cached keywords for the candidate (representative is clusters[idx][0])
            # We need to find the original index of the representative
            rep_idx = articles.index(cluster[0])
            rep_meta = article_meta[rep_idx]
            
            score = _calculate_similarity_with_meta(article, meta, cluster[0], rep_meta)
            
            if score > best_score:
                best_score = score
                best_cluster_idx = idx
        
        # 3. Decision & Index Update
        if best_score >= CLUSTER_THRESHOLD and best_cluster_idx >= 0:
            clusters[best_cluster_idx].append(article)
            target_idx = best_cluster_idx
        else:
            clusters.append([article])
            target_idx = len(clusters) - 1
            
        # Add new article's shingles to index for future lookups
        for shingle in meta["shingles"]:
            if shingle not in shingle_index:
                shingle_index[shingle] = set()
            shingle_index[shingle].add(target_idx)
    
    # Log cluster stats
    multi = [c for c in clusters if len(c) >= 2]
    if multi:
        logger.info(f"   🔗 Scalable Clustering: {len(multi)} multi-source clusters from {len(articles)} articles")
    
    return clusters

def _calculate_similarity_with_meta(a: RawArticle, a_meta: dict, b: RawArticle, b_meta: dict) -> float:
    """Optimized version of similarity using precomputed metadata."""
    title_a = a.title.lower()
    title_b = b.title.lower()
    
    title_sim = difflib.SequenceMatcher(None, title_a, title_b).ratio()
    
    # Shingle overlap is a very strong signal
    s_overlap = len(a_meta["shingles"].intersection(b_meta["shingles"]))
    if s_overlap >= 2: return 0.9
    
    # Keyword overlap
    overlap = len(a_meta["keywords"].intersection(b_meta["keywords"]))
    if overlap >= 2: return 0.8
    if overlap == 1 and title_sim > 0.15: return 0.5
    
    content_a = (a.content or "")[:500].lower()
    content_b = (b.content or "")[:500].lower()
    content_sim = difflib.SequenceMatcher(None, content_a, content_b).ratio() if content_a and content_b else 0.0
    
    score = (title_sim * 0.60) + (content_sim * 0.40)
    return max(score, title_sim) if title_sim >= 0.40 else score
