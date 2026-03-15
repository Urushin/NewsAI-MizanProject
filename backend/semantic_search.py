"""
NewsAI — Semantic Search Module
Handles embeddings generation and pgvector matching.
"""
from typing import List, Dict, Any, Optional
from loguru import logger
from llm_wrapper import get_embedding_provider, langfuse
from database import (
    get_manifesto_embedding, 
    store_article_embeddings, 
    match_articles
)

@langfuse.observe(name="Semantic Search: Filtering")
async def run_semantic_filtering(user_id: str, representatives: List[Any], match_count: int = 15) -> List[str]:
    """
    Generate embeddings for list of articles and return URLs of top matches 
    based on user's manifesto embedding.
    """
    user_vector = get_manifesto_embedding(user_id)
    if not user_vector:
        logger.warning(f"No manifesto embedding found for user {user_id}. Skipping semantic search.")
        return []

    embed_provider = get_embedding_provider()
    if not embed_provider:
        logger.error("No embedding provider available.")
        return []

    # Prepare text points
    texts_to_embed = [
        f"{a.title}\n{a.content[:1000] if a.content else ''}" 
        for a in representatives
    ]
    
    try:
        logger.info(f"   📡 Generating Embeddings for {len(representatives)} articles...")
        embeddings = await embed_provider.embed(texts_to_embed)
        
        # Package and save to DB for future use and matching
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
        
        # Perform matching
        logger.info("   🔍 Semantic Search Matching...")
        top_matches = match_articles(user_vector, match_count=match_count)
        
        if not top_matches:
            return []
            
        # Filter by minimum similarity if needed
        good_matches = [m for m in top_matches if m.get("similarity", 0) > 0.1]
        if not good_matches:
            good_matches = top_matches[:5]
            
        return [m.get("url") for m in good_matches]
        
    except Exception as e:
        logger.error(f"Embedding/Vector Search failed: {e}")
        return []
