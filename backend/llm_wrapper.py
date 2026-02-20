"""
Daily Brief — LLM Provider Wrapper
Mistral only (for speed). Groq and Gemini disabled.
"""
import os
import requests
from abc import ABC, abstractmethod
from dotenv import load_dotenv

load_dotenv()


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    def generate(self, prompt: str) -> str:
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

    def generate(self, prompt: str) -> str:
        resp = requests.post(
            self.base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.model,
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant that outputs only valid JSON arrays. No markdown, no code blocks."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.1,
            },
            timeout=60,
        )

        if resp.status_code != 200:
            raise Exception(f"Mistral HTTP {resp.status_code}: {resp.text[:200]}")

        data = resp.json()
        return data["choices"][0]["message"]["content"]


def get_providers() -> list[LLMProvider]:
    """Returns available LLM providers. Currently Mistral only."""
    providers = []

    mistral_key = os.getenv("MISTRAL_API_KEY")
    if mistral_key:
        try:
            providers.append(MistralProvider(mistral_key))
        except Exception as e:
            print(f"⚠️ Erreur init Mistral: {e}")

    if not providers:
        print("❌ AUCUN PROVIDER IA DISPONIBLE. Vérifiez MISTRAL_API_KEY dans .env")

    return providers
