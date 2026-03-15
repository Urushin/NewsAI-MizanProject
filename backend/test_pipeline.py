import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from llm_wrapper import get_providers
from pipeline import _run_pipeline_for_user_async

async def main():
    print("Testing pipeline...")
    res = await _run_pipeline_for_user_async("DevUser", language="fr", score_threshold=70, mode="prod", force=True)
    images = [(c.get("title"), c.get("image_url")) for c in res.get("content", [])]
    import pprint
    pprint.pprint(images)

asyncio.run(main())
