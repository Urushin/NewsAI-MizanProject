import sys
import asyncio
from pipeline import run_pipeline_for_user

print("Starting pipeline test for admin...")
result = run_pipeline_for_user("admin", "fr", 70, mode="prod")
print("Pipeline result:", result.keys() if isinstance(result, dict) else "Not a dict")
if isinstance(result, dict) and "status" in result:
    print("Status:", result["status"])
if isinstance(result, dict):
    print("Items kept:", result.get("total_kept"))
