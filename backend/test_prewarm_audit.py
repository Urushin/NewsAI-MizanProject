import asyncio
import sys
import os

# For imports
sys.path.append(os.path.dirname(__file__))

from routers.briefs import pre_warm_deep_audit_task, _get_audit_cache_path

class MockArticle:
    def __init__(self, link, title, summary):
        self.link = link
        self.localized_title = title
        self.summary = summary

async def main():
    link = "https://www.lemonde.fr/international/article/2026/03/16/test-intelligence"
    test_article = MockArticle(
        link=link,
        title="La France renforce ses accords de défense avec le Japon",
        summary=["Sécurité maritime renforcée", "Exercices conjoints prévus en 2026"]
    )
    
    print(f"Checking cache path...")
    cache_p = _get_audit_cache_path(link)
    print(f"Cache location: {cache_p}")
    
    print("Running pre-warm task...")
    await pre_warm_deep_audit_task([test_article], language="fr")
    
    import pathlib
    if pathlib.Path(cache_p).exists():
        print("✅ SUCCESS: Cache file created!")
        with open(cache_p, "r", encoding="utf-8") as f:
             print(f.read()[:300] + "...")
    else:
        print("❌ FAIL: Cache file NOT created.")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
    asyncio.run(main())
