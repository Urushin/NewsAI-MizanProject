"""
Mizan.ai — Data Models (Pydantic V2)
"""
from pydantic import BaseModel, Field
from typing import List, Literal


class RawArticle(BaseModel):
    title: str
    link: str
    published: str = "Date inconnue"
    source_interest: str = ""
    content: str = ""


class ArticleVerdict(BaseModel):
    """Two-stage cognitive filter output."""
    localized_title: str
    summary: str = ""
    score: int = Field(ge=0, le=100)
    keep: bool = True
    category: Literal["Impact", "Passion"] = "Passion"
    reason: str = ""
    credibility_score: int = Field(ge=0, le=10, default=5)
    link: str = ""


# Backward compat alias
AnalyzedArticle = ArticleVerdict


class DailyBrief(BaseModel):
    date: str
    generated_at: str = ""
    total_collected: int = 0
    total_kept: int = 0
    duration_seconds: float = 0.0
    global_digest: str = ""
    content: List[dict] = []
