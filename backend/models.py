"""
Daily Brief — Data Models (Pydantic V2)
Validation stricte des données entrantes (RSS) et sortantes (LLM).
"""
from pydantic import BaseModel, Field, HttpUrl
from typing import Optional
from datetime import datetime


class RawArticle(BaseModel):
    """Article brut récupéré depuis un flux RSS."""
    title: str
    link: str
    published: str = "Date inconnue"
    source_interest: str = ""  # La catégorie d'intérêt qui a généré cet article
    content: str = ""  # Texte extrait de l'article (trafilatura)


class AnalyzedArticle(BaseModel):
    """Article analysé et scoré par l'IA."""
    title: str
    category: str
    score: int = Field(ge=0, le=100)
    summary: str
    keep: bool
    link: str = ""


class DailyBrief(BaseModel):
    """Structure finale du briefing quotidien."""
    date: str
    generated_at: str = ""
    total_collected: int = 0
    total_kept: int = 0
    duration_seconds: float = 0.0
    content: list[AnalyzedArticle] = []
