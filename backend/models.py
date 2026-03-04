"""
Mizan.ai — Data Models (Pydantic V2)
"""
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator
from typing import List, Literal, Annotated
import re

# Strict String defs
StrictStr = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=False)]

class RawArticle(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

    title: StrictStr = Field(..., min_length=1, max_length=500)
    link: StrictStr = Field(..., min_length=1, max_length=1500)
    published: StrictStr = Field(default="Date inconnue")
    source_interest: StrictStr = Field(default="")
    content: StrictStr = Field(default="")


class ArticleVerdict(BaseModel):
    """Two-stage cognitive filter output."""
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

    localized_title: StrictStr = Field(..., min_length=1, max_length=500)
    summary: List[StrictStr] = Field(..., min_length=1, max_length=5)
    score: Annotated[int, Field(ge=0, le=100)]
    keep: bool = True
    category: StrictStr = Field(default="Passion", max_length=50)
    reason: StrictStr = Field(default="", max_length=500)
    credibility_score: Annotated[int, Field(ge=0, le=10)] = 5
    link: StrictStr = Field(default="", max_length=1500)

    @field_validator('summary', mode='before')
    @classmethod
    def clean_summary(cls, v):
        if isinstance(v, str):
            # Fallback if LLM outputs a single string instead of a list
            cleaned = re.sub(r'[*_`]', '', v).strip()
            # Try to split on newlines or periods to get multiple items
            parts = [p.strip() for p in re.split(r'[\n•]', cleaned) if p.strip()]
            if len(parts) >= 2:
                return parts
            return [cleaned] if cleaned else ["Résumé non disponible"]
        if isinstance(v, list):
            # Clean markdown bullets and bold from each string
            cleaned_list = []
            for item in v:
                if isinstance(item, str):
                    c = re.sub(r'^[-•]\s*', '', item)
                    c = re.sub(r'[*_`]', '', c)
                    c = re.sub(r'<[^>]+>', '', c)  # Strip HTML tags
                    if c.strip():
                        cleaned_list.append(c.strip())
            return cleaned_list if cleaned_list else ["Résumé non disponible"]
        return v

    @field_validator('category', mode='before')
    @classmethod
    def normalize_category(cls, v):
        """Map any LLM category value to a known category."""
        if not isinstance(v, str):
            return "Passion"
        known = {"impact", "passion"}
        if v.strip().lower() in known:
            return v.strip().capitalize()
        # Map common LLM outputs to our categories
        impact_keywords = {"politique", "économie", "economy", "politics", "security", "sécurité", "crisis", "crise", "war", "guerre"}
        if v.strip().lower() in impact_keywords:
            return "Impact"
        return "Passion"

# Backward compat alias
AnalyzedArticle = ArticleVerdict

class DailyBrief(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

    date: StrictStr = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    generated_at: StrictStr = Field(default="")
    total_collected: Annotated[int, Field(ge=0)] = 0
    total_kept: Annotated[int, Field(ge=0)] = 0
    duration_seconds: Annotated[float, Field(ge=0.0)] = 0.0
    global_digest: StrictStr = Field(default="", max_length=2000)
    
    # We enforce that the content is exactly a list of verified verdicts
    content: List[ArticleVerdict] = Field(default_factory=list)
