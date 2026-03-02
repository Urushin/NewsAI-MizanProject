import os
import sys
import glob
from loguru import logger
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(__file__))
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

from database import get_supabase, store_manifesto_embedding
from llm_wrapper import get_embedding_provider

def main():
    sb = get_supabase()
    embed_provider = get_embedding_provider()
    
    if not embed_provider:
        logger.error("No embedding provider available. Check MISTRAL_API_KEY.")
        return

    # Fetch users from profiles
    res = sb.table("profiles").select("id, username").execute()
    users = {profile["username"]: profile["id"] for profile in res.data}
    
    manifest_dir = os.path.join(os.path.dirname(__file__), "manifests")
    if not os.path.exists(manifest_dir):
        logger.warning(f"Manifests directory not found at {manifest_dir}")
        return

    for filepath in glob.glob(os.path.join(manifest_dir, "*.txt")):
        filename = os.path.basename(filepath)
        username = os.path.splitext(filename)[0]
        
        user_id = users.get(username)
        if not user_id:
            logger.warning(f"User {username} not found in DB, skipping.")
            continue
            
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read().strip()
            
        if not content:
            logger.warning(f"Empty manifesto for {username}, skipping.")
            continue
            
        logger.info(f"Generating embedding for {username}...")
        try:
            vectors = embed_provider.embed([content])
            if vectors:
                store_manifesto_embedding(user_id, vectors[0])
                logger.info(f"✅ Embedded and saved manifesto for {username}")
        except Exception as e:
            logger.error(f"Failed to embed manifesto for {username}: {e}")

if __name__ == "__main__":
    main()
