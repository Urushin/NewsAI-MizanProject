"""
Mizan.ai — LLM Provider Wrapper (Production-grade)

Improvements:
  ✅ Retry with exponential backoff (3 attempts)
  ✅ Response cache (same prompt = same cost)
  ✅ Token usage tracking & logging
  ✅ Langfuse conditional activation
  ✅ Robust JSON parsing with recovery
"""
import os
import re
import json
import asyncio
import hashlib
import pathlib
import httpx
from abc import ABC, abstractmethod
from typing import List, Optional, Union, Type, TypeVar
from loguru import logger

# ── Load env ──
root_dir = pathlib.Path(__file__).parent.parent.resolve()
env_file = root_dir / '.env'

from dotenv import load_dotenv
try:
    if env_file.exists():
        load_dotenv(str(env_file))
    else:
        load_dotenv()
except Exception as e:
    logger.warning(f"Could not load .env file directly: {e}")

# ── Langfuse: conditional activation ──
class DummyLangfuse:
    def observe(self, *args, **kwargs): return lambda x: x
    @property
    def langfuse_context(self):
        class Ctx:
            def update_current_generation(self, *args, **kwargs): pass
        return Ctx()

try:
    _lf_public = os.getenv("LANGFUSE_PUBLIC_KEY", "")
    _lf_secret = os.getenv("LANGFUSE_SECRET_KEY", "")
    if _lf_public and _lf_secret and _lf_public.startswith("pk-lf-"):
        from langfuse.decorators import langfuse_context, observe
        class RealLangfuse:
            def observe(self, *args, **kwargs):
                return observe(*args, **kwargs)
            @property
            def langfuse_context(self):
                return langfuse_context
        langfuse = RealLangfuse()
        logger.info("📊 Langfuse enabled")
    else:
        langfuse = DummyLangfuse()
except Exception:
    langfuse = DummyLangfuse()

from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel

_MARKDOWN_FENCE = re.compile(r"^```(?:json)?\s*\n?", re.MULTILINE)

T = TypeVar('T', bound=BaseModel)

# ── Constants ──
MAX_RETRIES = 3
RETRY_BASE_DELAY = 1.5
LLM_TIMEOUT = 90  # seconds


# ══════════════════════════════════════════
# Token Usage Tracker
# ══════════════════════════════════════════
class TokenTracker:
    """Track cumulative token usage and estimated costs across providers."""

    # Approximate costs per 1M tokens (Mistral Small for text, Mistral Embed for embeddings)
    COST_PER_1M = {"prompt": 0.10, "completion": 0.30, "embedding": 0.0001}

    def __init__(self):
        self.total_prompt = 0
        self.total_completion = 0
        self.total_embedding = 0
        self.total_calls = 0

    def record(self, prompt_tokens: int, completion_tokens: int = 0, embedding_tokens: int = 0):
        self.total_prompt += prompt_tokens
        self.total_completion += completion_tokens
        self.total_embedding += embedding_tokens
        self.total_calls += 1

    @property
    def total_tokens(self) -> int:
        return self.total_prompt + self.total_completion + self.total_embedding

    @property
    def estimated_cost_usd(self) -> float:
        return (
            self.total_prompt / 1_000_000 * self.COST_PER_1M["prompt"]
            + self.total_completion / 1_000_000 * self.COST_PER_1M["completion"]
            + self.total_embedding / 1_000_000 * self.COST_PER_1M["embedding"]
        )

    def summary(self) -> str:
        return (
            f"📊 Tokens: {self.total_tokens:,} "
            f"(prompt: {self.total_prompt:,}, completion: {self.total_completion:,}, embed: {self.total_embedding:,}) | "
            f"Calls: {self.total_calls} | "
            f"Cost: ~${self.estimated_cost_usd:.4f}"
        )


# Global singleton
token_tracker = TokenTracker()


# ══════════════════════════════════════════
# LLM Response Cache
# ══════════════════════════════════════════
_response_cache: dict = {}
_CACHE_MAX_SIZE = 200


def _cache_key(prompt: str, system_prompt: str) -> str:
    content = f"{system_prompt}|||{prompt}"
    return hashlib.sha256(content.encode()).hexdigest()[:16]


def _cache_get(prompt: str, system_prompt: str) -> Optional[str]:
    key = _cache_key(prompt, system_prompt)
    return _response_cache.get(key)


def _cache_set(prompt: str, system_prompt: str, response: str):
    if len(_response_cache) >= _CACHE_MAX_SIZE:
        # Evict oldest entries (FIFO)
        oldest = list(_response_cache.keys())[:50]
        for k in oldest:
            del _response_cache[k]
    key = _cache_key(prompt, system_prompt)
    _response_cache[key] = response


# ══════════════════════════════════════════
# Pydantic AI Agent
# ══════════════════════════════════════════
def get_pydantic_ai_agent(result_type: Type[T], system_prompt: str = "You are a helpful assistant.") -> Agent:
    """Returns a Pydantic AI agent configured for Mistral."""
    mistral_key = os.getenv("MISTRAL_API_KEY")
    if not mistral_key:
        raise ValueError("MISTRAL_API_KEY is required")

    os.environ["OPENAI_API_KEY"] = mistral_key
    os.environ["OPENAI_BASE_URL"] = "https://api.mistral.ai/v1"

    try:
        model = OpenAIModel(
            model_name='mistral-small-latest',
            base_url='https://api.mistral.ai/v1',
            api_key=mistral_key,
        )
    except TypeError:
        try:
            model = OpenAIModel(
                model='mistral-small-latest',
                base_url='https://api.mistral.ai/v1',
                api_key=mistral_key,
            )
        except TypeError:
            model = OpenAIModel('mistral-small-latest')

    try:
        return Agent(model, output_type=result_type, system_prompt=system_prompt)
    except TypeError:
        return Agent(model, system_prompt=system_prompt)


# ══════════════════════════════════════════
# LLM Provider (with retry + cache + tracking)
# ══════════════════════════════════════════
class LLMProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str, system_prompt: str = None) -> str:
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        pass


class MistralProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "mistral-small-latest"):
        self.api_key = api_key
        self.model = model
        self._name = f"Mistral ({model})"
        self.base_url = "https://api.mistral.ai/v1/chat/completions"

    @property
    def name(self) -> str:
        return self._name

    @langfuse.observe(as_type="generation")
    async def generate(self, prompt: str, system_prompt: str = None, max_tokens: int = 4000) -> str:
        if system_prompt is None:
            system_prompt = "Output only valid JSON. No markdown."

        # ── Check cache ──
        # Include max_tokens in cache key to avoid hitting old truncated results
        cache_content = f"{system_prompt}|||{prompt}|||{max_tokens}"
        cache_key = hashlib.sha256(cache_content.encode()).hexdigest()[:16]
        
        cached = _response_cache.get(cache_key)
        if cached:
            logger.debug(f"🗂️ Cache hit for prompt hash {cache_key}")
            return cached

        # ── Langfuse input tracking ──
        langfuse.langfuse_context.update_current_generation(
            model=self.model,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
        )

        # ── Retry loop ──
        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
                    resp = await client.post(
                        self.base_url,
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": self.model,
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": prompt},
                            ],
                            "temperature": 0.1,
                            "max_tokens": max_tokens,
                        },
                    )

                if resp.status_code == 429:
                    # Rate limited — wait and retry
                    retry_after = int(resp.headers.get("Retry-After", 5))
                    logger.warning(f"⏳ Rate limited. Waiting {retry_after}s...")
                    await asyncio.sleep(retry_after)
                    continue

                if resp.status_code != 200:
                    raise Exception(f"Mistral HTTP {resp.status_code}: {resp.text[:200]}")

                body = resp.json()
                content = body["choices"][0]["message"]["content"]

                # ── Track token usage ──
                usage = body.get("usage")
                if usage:
                    p_tok = usage.get("prompt_tokens", 0)
                    c_tok = usage.get("completion_tokens", 0)
                    token_tracker.record(p_tok, c_tok)
                    langfuse.langfuse_context.update_current_generation(
                        usage={
                            "prompt_tokens": p_tok,
                            "completion_tokens": c_tok,
                            "total_tokens": p_tok + c_tok,
                        }
                    )

                # ── Cache response only if it looks complete ──
                if content.strip().endswith(('}', ']')):
                    _cache_set(prompt, system_prompt, content)
                else:
                    logger.warning("⚠️ LLM response looks truncated. Skipping cache.")

                return content

            except httpx.TimeoutException:
                last_error = TimeoutError(f"Mistral API timed out after {LLM_TIMEOUT}s")
                logger.warning(f"⏱️ Timeout attempt {attempt+1}/{MAX_RETRIES}")
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(RETRY_BASE_DELAY * (2 ** attempt))
            except Exception as e:
                last_error = e
                if attempt < MAX_RETRIES - 1:
                    delay = RETRY_BASE_DELAY * (2 ** attempt)
                    logger.warning(f"🔄 Mistral error, retry {attempt+1}/{MAX_RETRIES} in {delay}s: {e}")
                    await asyncio.sleep(delay)

        raise RuntimeError(f"Mistral failed after {MAX_RETRIES} attempts: {last_error}")


class MistralEmbeddingProvider:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.model = "mistral-embed"
        self.base_url = "https://api.mistral.ai/v1/embeddings"

    async def embed(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        # ── Retry loop ──
        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
                    resp = await client.post(
                        self.base_url,
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": self.model,
                            "inputs": texts,
                        },
                    )

                if resp.status_code == 429:
                    retry_after = int(resp.headers.get("Retry-After", 5))
                    await asyncio.sleep(retry_after)
                    continue

                if resp.status_code != 200:
                    raise Exception(f"Mistral Embed HTTP {resp.status_code}: {resp.text[:200]}")

                body = resp.json()
                
                # ── Track token usage ──
                usage = body.get("usage")
                if usage:
                    e_tok = usage.get("total_tokens", 0)
                    token_tracker.record(prompt_tokens=0, completion_tokens=0, embedding_tokens=e_tok)

                # Return list of embeddings sorted by their index
                results = sorted(body["data"], key=lambda k: k["index"])
                return [r["embedding"] for r in results]

            except Exception as e:
                last_error = e
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(RETRY_BASE_DELAY * (2 ** attempt))

        raise RuntimeError(f"Mistral Embed failed: {last_error}")


# ══════════════════════════════════════════
# JSON Parsing (robust)
# ══════════════════════════════════════════
def strip_markdown_fences(text: str) -> str:
    """Remove ```json ... ``` fences from LLM output."""
    return _MARKDOWN_FENCE.sub("", text).strip().rstrip("`")


def parse_llm_json(text: str) -> Union[list, dict]:
    """Parse LLM output, handling markdown fences and dict wrappers."""
    cleaned = strip_markdown_fences(text)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.warning(f"JSON parse failed: {e}. Attempting recovery...")
        try:
            last_bracket = max(cleaned.rfind(']'), cleaned.rfind('}'))
            if last_bracket != -1:
                data = json.loads(cleaned[:last_bracket + 1])
                logger.info("✅ JSON recovered by clipping.")
            else:
                raise e
        except Exception:
            logger.error(f"JSON recovery failed. Snippet: {cleaned[:200]}...")
            raise e

    if isinstance(data, dict):
        for v in data.values():
            if isinstance(v, list):
                return v
    return data


# ══════════════════════════════════════════
# Provider Singleton
# ══════════════════════════════════════════
_providers: Optional[List[LLMProvider]] = None
_embedding_provider: Optional[MistralEmbeddingProvider] = None

def get_providers() -> List[LLMProvider]:
    """Returns available LLM providers (cached singleton)."""
    global _providers
    if _providers is not None:
        return _providers

    _providers = []
    mistral_key = os.getenv("MISTRAL_API_KEY")
    if mistral_key:
        _providers.append(MistralProvider(mistral_key))

    if not _providers:
        logger.error("❌ NO LLM PROVIDER. Check MISTRAL_API_KEY in .env")

    return _providers

def get_embedding_provider() -> Optional[MistralEmbeddingProvider]:
    """Returns the embedding provider."""
    global _embedding_provider
    if _embedding_provider is not None:
        return _embedding_provider
        
    mistral_key = os.getenv("MISTRAL_API_KEY")
    if mistral_key:
        _embedding_provider = MistralEmbeddingProvider(mistral_key)
        
    return _embedding_provider
