"""
🧠 Advanced Reliability Analysis Engine for NewsAI
===================================================
Implements a multi-layered information verification system:
- SourceReputationDB: Domain reputation scoring
- FactCheckingEngine: Factual traceability via LLM
- CognitiveAnalysisEngine: Rhetorical & bias detection via LLM
- InformationAnalyzerAgent: Orchestrator with Decision Matrix
"""

import asyncio
import re
from dataclasses import dataclass, field, asdict
from enum import Enum
from urllib.parse import urlparse
from typing import Optional
from loguru import logger


# ============================================================================
# 1. ENUMS & DATA STRUCTURES
# ============================================================================

class ReliabilityStatus(str, Enum):
    FAIT_OBJECTIF_FIABLE = "FAIT_OBJECTIF_FIABLE"
    INFORMATION_PARTIELLE = "INFORMATION_PARTIELLE"  
    FAIT_MILITARISE = "FAIT_MILITARISÉ"
    DESINFORMATION_TOXIQUE = "DÉSINFORMATION_TOXIQUE"
    RUMEUR_EN_BOUCLE = "RUMEUR_EN_BOUCLE"
    NON_VERIFIABLE = "NON_VÉRIFIABLE"
    PARODIE = "PARODIE"


class RootEvidenceQuality(str, Enum):
    STRONG_CONSENSUS = "STRONG_CONSENSUS"
    EMERGING_DATA = "EMERGING_DATA"
    CONTROVERSIAL = "CONTROVERSIAL"
    NO_ROOT_EVIDENCE = "NO_ROOT_EVIDENCE"
    DEBUNKED = "DEBUNKED_OR_RETRACTED"


class CognitiveBiasType(str, Enum):
    APPEAL_TO_OUTRAGE = "APPEAL_TO_OUTRAGE"
    APPEAL_TO_FEAR = "APPEAL_TO_FEAR"
    FALSE_DILEMMA = "FALSE_DILEMMA"
    STRAWMAN_FALLACY = "STRAWMAN_FALLACY"
    HASTY_GENERALIZATION = "HASTY_GENERALIZATION"
    CHERRY_PICKING = "CHERRY_PICKING"


# Human-readable labels for frontend display
BIAS_LABELS = {
    "APPEAL_TO_OUTRAGE": {"label": "Appel à l'indignation", "icon": "😡", "desc": "Utilise la colère pour court-circuiter la réflexion"},
    "APPEAL_TO_FEAR": {"label": "Appel à la peur", "icon": "😨", "desc": "Exploite l'anxiété pour pousser à l'action"},
    "FALSE_DILEMMA": {"label": "Faux dilemme", "icon": "⚖️", "desc": "Présente seulement 2 options alors qu'il en existe d'autres"},
    "STRAWMAN_FALLACY": {"label": "Homme de paille", "icon": "🤡", "desc": "Déforme l'argument adverse pour le réfuter facilement"},
    "HASTY_GENERALIZATION": {"label": "Généralisation hâtive", "icon": "🎯", "desc": "Tire une conclusion générale d'un cas isolé"},
    "CHERRY_PICKING": {"label": "Picorage de données", "icon": "🍒", "desc": "Sélectionne uniquement les données qui confirment la thèse"},
}

EVIDENCE_LABELS = {
    "STRONG_CONSENSUS": {"label": "Consensus solide", "color": "green", "desc": "Sources primaires vérifiables et corroborées"},
    "EMERGING_DATA": {"label": "Données émergentes", "color": "blue", "desc": "Informations récentes, pas encore pleinement confirmées"},
    "CONTROVERSIAL": {"label": "Controversé", "color": "orange", "desc": "Les experts sont divisés sur le sujet"},
    "NO_ROOT_EVIDENCE": {"label": "Aucune preuve racine", "color": "red", "desc": "Impossible de remonter à une source primaire fiable"},
    "DEBUNKED_OR_RETRACTED": {"label": "Réfuté ou rétracté", "color": "red", "desc": "Des sources officielles ont démenti cette information"},
}

STATUS_LABELS = {
    "FAIT_OBJECTIF_FIABLE": {"label": "Fait objectif fiable", "color": "emerald", "icon": "✅", "desc": "Information factuelle corroborée, présentation neutre"},
    "INFORMATION_PARTIELLE": {"label": "Information partielle", "color": "blue", "icon": "ℹ️", "desc": "Faits partiellement vérifiés, contexte incomplet"},
    "FAIT_MILITARISÉ": {"label": "Fait militarisé / Cadrage biaisé", "color": "amber", "icon": "⚠️", "desc": "Les faits sont vrais mais présentés de manière manipulatrice"},
    "DÉSINFORMATION_TOXIQUE": {"label": "Désinformation toxique", "color": "red", "icon": "🚨", "desc": "Faits non vérifiés combinés à des techniques de manipulation"},
    "RUMEUR_EN_BOUCLE": {"label": "Rumeur en boucle", "color": "purple", "icon": "🔄", "desc": "Les sources se citent mutuellement sans preuve originale"},
    "NON_VÉRIFIABLE": {"label": "Non vérifiable", "color": "zinc", "icon": "❓", "desc": "Impossible de confirmer ou d'infirmer cette information"},
    "PARODIE": {"label": "Parodie / Satire", "color": "pink", "icon": "🎭", "desc": "Contenu humoristique à ne pas prendre au premier degré"},
}


@dataclass
class ReliabilityVerdict:
    """Final output of the analysis engine."""
    status: str
    factual_score: int  # 0-100
    manipulation_score: int  # 0-100
    source_reputation_score: int  # 0-100
    root_evidence_quality: str
    detected_biases: list = field(default_factory=list)
    explanation: str = ""
    is_circular: bool = False
    is_synthesis: bool = False
    sources_count: int = 1
    
    def to_dict(self) -> dict:
        return asdict(self)


# ============================================================================
# 2. SOURCE REPUTATION DATABASE
# ============================================================================

# Tier 1: Major wire services & established broadsheets
_TIER1_DOMAINS = {
    "afp.com": 95, "reuters.com": 95, "apnews.com": 95,
    "lemonde.fr": 92, "liberation.fr": 88, "lefigaro.fr": 88,
    "bbc.com": 93, "bbc.co.uk": 93, "nytimes.com": 92,
    "theguardian.com": 90, "washingtonpost.com": 90,
    "france24.com": 90, "rfi.fr": 88, "lobs.com": 85,
    "lepoint.fr": 85, "lexpress.fr": 85, "mediapart.fr": 87,
    "latribune.fr": 83, "lesechos.fr": 87, "lavoixdunord.fr": 82,
    "ouest-france.fr": 83, "sudouest.fr": 82,
    "elpais.com": 88, "dw.com": 88, "aljazeera.com": 85,
    "nature.com": 97, "sciencedirect.com": 96, "thelancet.com": 97,
    "who.int": 95, "europa.eu": 92, "gouvernement.fr": 90,
}

# Tier 2: Reliable but opinion-heavy or niche
_TIER2_DOMAINS = {
    "huffingtonpost.fr": 72, "slate.fr": 75, "rue89.nouvelobs.com": 73,
    "marianne.net": 70, "courrierinternational.com": 80,
    "numerama.com": 78, "01net.com": 75, "lesnumeriques.com": 77,
    "nextinpact.com": 80, "clubic.com": 73,
    "techcrunch.com": 80, "theverge.com": 78, "arstechnica.com": 82,
    "wired.com": 80, "bloomberg.com": 88, "ft.com": 90,
    "cnn.com": 78, "foxnews.com": 60, "nbcnews.com": 78,
}

# Satire domains
_SATIRE_DOMAINS = {"legorafi.fr", "theonion.com", "babylonbee.com", "nordpresse.be"}

# Known low-trust / conspiracy
_LOW_TRUST_DOMAINS = {
    "infowars.com": 5, "breitbart.com": 15, "rt.com": 25, "sputniknews.com": 20,
}


class SourceReputationDB:
    """Evaluates source domain reputation."""
    
    @staticmethod
    def get_domain(url: str) -> str:
        try:
            host = urlparse(url).hostname or ""
            return host.replace("www.", "")
        except:
            return ""
    
    @staticmethod
    def is_satire(url: str) -> bool:
        domain = SourceReputationDB.get_domain(url)
        return domain in _SATIRE_DOMAINS
    
    @staticmethod
    def get_reputation_score(url: str) -> int:
        domain = SourceReputationDB.get_domain(url)
        
        if domain in _SATIRE_DOMAINS:
            return 0
        if domain in _LOW_TRUST_DOMAINS:
            return _LOW_TRUST_DOMAINS[domain]
        if domain in _TIER1_DOMAINS:
            return _TIER1_DOMAINS[domain]
        if domain in _TIER2_DOMAINS:
            return _TIER2_DOMAINS[domain]
        
        # Check partial matches (subdomains)
        for known_domain, score in {**_TIER1_DOMAINS, **_TIER2_DOMAINS}.items():
            if domain.endswith(known_domain):
                return score
        
        # Unknown domain: neutral baseline
        return 45


# ============================================================================
# 3. FACT-CHECKING ENGINE (LLM-Powered)
# ============================================================================

_FACT_CHECK_SYSTEM_PROMPT = """Tu es un vérificateur de faits expert (fact-checker).

Analyse le texte fourni et évalue :
1. La TRAÇABILITÉ des sources : les affirmations sont-elles attribuées à des sources identifiables ?
2. La QUALITÉ des preuves : s'agit-il de données brutes, d'études, de déclarations officielles, ou de ouï-dire ?  
3. La CIRCULARITÉ : les sources se citent-elles mutuellement sans preuve originale ?

Tu DOIS répondre UNIQUEMENT avec ce format JSON exact (pas de markdown, pas de texte autour) :
{
  "factual_score": <int 0-100>,
  "root_evidence_quality": "<STRONG_CONSENSUS|EMERGING_DATA|CONTROVERSIAL|NO_ROOT_EVIDENCE|DEBUNKED_OR_RETRACTED>",
  "is_circular": <true|false>,
  "key_claims_verified": <int 0-5, nombre d'affirmations vérifiables trouvées>,
  "justification": "<Explication concise en 2 phrases max>"
}

Règles de scoring :
- 90-100 : Sources primaires multiples, données vérifiables, consensus expert
- 70-89 : Sources identifiées mais pas toutes primaires, données partielles
- 50-69 : Sources floues ("selon des experts"), peu de données concrètes
- 30-49 : Aucune source citée, affirmations sans preuves 
- 0-29 : Informations contredites par des sources officielles"""


class FactCheckingEngine:
    """Evaluates factual accuracy and source traceability."""
    
    async def evaluate_facts(self, text: str, url: str, sources_count: int, llm) -> dict:
        """Returns factual_score, root_evidence_quality, is_circular."""
        
        source_rep = SourceReputationDB.get_reputation_score(url)
        
        prompt = f"""URL source: {url}
Réputation du domaine: {source_rep}/100
Nombre de sources fusionnées dans cette synthèse: {sources_count}

Texte à analyser:
{text[:3000]}"""

        try:
            raw = await llm.generate(prompt, _FACT_CHECK_SYSTEM_PROMPT, max_tokens=400)
            result = self._parse_json(raw)
            
            # Apply source reputation as modifier
            base_score = result.get("factual_score", 50)
            # Weighted blend: 60% LLM assessment + 25% source reputation + 15% multi-source bonus
            multi_source_bonus = min(15, sources_count * 5) if sources_count > 1 else 0
            final_score = int(base_score * 0.60 + source_rep * 0.25 + multi_source_bonus)
            final_score = max(0, min(100, final_score))
            
            return {
                "factual_score": final_score,
                "root_evidence_quality": result.get("root_evidence_quality", "NO_ROOT_EVIDENCE"),
                "is_circular": result.get("is_circular", False),
                "key_claims_verified": result.get("key_claims_verified", 0),
                "justification": result.get("justification", ""),
                "source_reputation_score": source_rep,
            }
        except Exception as e:
            logger.warning(f"FactCheckingEngine error: {e}")
            return {
                "factual_score": 50,
                "root_evidence_quality": "NO_ROOT_EVIDENCE",
                "is_circular": False,
                "key_claims_verified": 0,
                "justification": "Analyse factuelle indisponible",
                "source_reputation_score": source_rep,
            }
    
    def _parse_json(self, raw: str) -> dict:
        import json
        # Strip markdown fences if present
        cleaned = re.sub(r'^```(?:json)?\s*', '', raw.strip())
        cleaned = re.sub(r'\s*```$', '', cleaned)
        return json.loads(cleaned)


# ============================================================================
# 4. COGNITIVE ANALYSIS ENGINE (LLM-Powered)
# ============================================================================

_COGNITIVE_SYSTEM_PROMPT = """Tu es un expert en analyse rhétorique et en biais cognitifs.

Analyse le texte fourni et détecte :
1. Le niveau d'EXCITATION ÉMOTIONNELLE (vocabulaire alarmiste, superlatifs, ponctuation excessive)
2. Les BIAIS COGNITIFS présents (sophismes, manipulations logiques)
3. Les techniques de MANIPULATION (cadrage biaisé, omission sélective, faux dilemme)

Tu DOIS répondre UNIQUEMENT avec ce format JSON exact (pas de markdown, pas de texte autour) :
{
  "manipulation_score": <int 0-100>,
  "emotional_arousal": <int 0-10>,
  "detected_biases": ["<APPEAL_TO_OUTRAGE|APPEAL_TO_FEAR|FALSE_DILEMMA|STRAWMAN_FALLACY|HASTY_GENERALIZATION|CHERRY_PICKING>"],
  "sensationalism_markers": <int, nombre de marqueurs sensationnalistes détectés>,
  "justification": "<Explication concise en 2 phrases max>"
}

Règles de scoring manipulation :
- 0-20 : Ton neutre, informatif, aucun biais détecté
- 21-40 : Léger cadrage éditorial, 1 biais mineur possible
- 41-60 : Cadrage partial, vocabulaire orienté, 2+ biais détectés
- 61-80 : Manipulation claire, multiple sophismes, appels émotionnels
- 81-100 : Propagande pure, désinformation intentionnelle manifeste"""


class CognitiveAnalysisEngine:
    """Evaluates rhetorical manipulation and cognitive biases."""
    
    async def analyze_rhetoric(self, text: str, llm) -> dict:
        """Returns manipulation_score, detected_biases[], emotional_arousal."""
        
        prompt = f"""Texte à analyser pour manipulation rhétorique :
{text[:3000]}"""
        
        try:
            raw = await llm.generate(prompt, _COGNITIVE_SYSTEM_PROMPT, max_tokens=400)
            result = self._parse_json(raw)
            
            # Validate biases against known enum
            valid_biases = [b.value for b in CognitiveBiasType]
            detected = [b for b in result.get("detected_biases", []) if b in valid_biases]
            
            # Surface-level heuristic boosters (complement LLM analysis)
            heuristic_boost = self._surface_heuristics(text)
            
            raw_score = result.get("manipulation_score", 20)
            final_score = min(100, raw_score + heuristic_boost)
            
            return {
                "manipulation_score": final_score,
                "emotional_arousal": result.get("emotional_arousal", 0),
                "detected_biases": detected,
                "sensationalism_markers": result.get("sensationalism_markers", 0),
                "justification": result.get("justification", ""),
            }
        except Exception as e:
            logger.warning(f"CognitiveAnalysisEngine error: {e}")
            return {
                "manipulation_score": 20,
                "emotional_arousal": 0,
                "detected_biases": [],
                "sensationalism_markers": 0,
                "justification": "Analyse rhétorique indisponible",
            }
    
    def _surface_heuristics(self, text: str) -> int:
        """Quick regex-driven heuristics to complement LLM analysis."""
        boost = 0
        
        # Excessive exclamation marks
        exclamation_count = text.count("!")
        if exclamation_count > 5:
            boost += min(10, exclamation_count * 2)
        
        # ALL CAPS words (3+ chars)
        caps_words = re.findall(r'\b[A-ZÀÂÉÈÊËÏÎÔÙÛÜŸÇ]{3,}\b', text)
        if len(caps_words) > 3:
            boost += min(10, len(caps_words) * 2)
        
        # Clickbait patterns (French)
        clickbait_patterns = [
            r'(?i)vous ne (?:devinerez|croirez) jamais',
            r'(?i)incroyable',
            r'(?i)choquant',
            r'(?i)scandaleux',
            r'(?i)urgent\s*[!:]',
            r'(?i)breaking',
            r'(?i)exclusif\s*[!:]',
        ]
        for pattern in clickbait_patterns:
            if re.search(pattern, text):
                boost += 5
        
        return min(20, boost)  # Cap heuristic boost at 20
    
    def _parse_json(self, raw: str) -> dict:
        import json
        cleaned = re.sub(r'^```(?:json)?\s*', '', raw.strip())
        cleaned = re.sub(r'\s*```$', '', cleaned)
        return json.loads(cleaned)


# ============================================================================
# 5. INFORMATION ANALYZER AGENT (Orchestrator)
# ============================================================================

class InformationAnalyzerAgent:
    """Orchestrates both engines and produces the final verdict."""
    
    def __init__(self):
        self.fact_checker = FactCheckingEngine()
        self.cognitive_analyzer = CognitiveAnalysisEngine()
    
    async def process(
        self,
        text: str,
        url: str,
        title: str,
        sources_count: int = 1,
        llm=None,
    ) -> ReliabilityVerdict:
        """
        Main entry point. Runs both engines in parallel and resolves verdict.
        
        Args:
            text: Article or synthesis text content
            url: Source URL of the article
            title: Article title
            sources_count: Number of sources merged (for syntheses)
            llm: LLM provider instance
        """
        
        # ── 1. Immediate Satire Filter ──
        if SourceReputationDB.is_satire(url):
            return ReliabilityVerdict(
                status=ReliabilityStatus.PARODIE.value,
                factual_score=0,
                manipulation_score=0,
                source_reputation_score=0,
                root_evidence_quality="NO_ROOT_EVIDENCE",
                detected_biases=[],
                explanation="Ce contenu provient d'un site satirique/parodique connu. Il est à vocation humoristique et ne doit pas être pris au premier degré.",
                is_synthesis=sources_count > 1,
                sources_count=sources_count,
            )
        
        # ── 2. Parallel Analysis ──
        combined_text = f"TITRE: {title}\n\n{text}"
        
        if llm:
            fact_result, cognitive_result = await asyncio.gather(
                self.fact_checker.evaluate_facts(combined_text, url, sources_count, llm),
                self.cognitive_analyzer.analyze_rhetoric(combined_text, llm),
            )
        else:
            # Fallback when no LLM available — use heuristics only
            source_rep = SourceReputationDB.get_reputation_score(url)
            heuristic_boost = self.cognitive_analyzer._surface_heuristics(combined_text)
            fact_result = {
                "factual_score": source_rep,
                "root_evidence_quality": "NO_ROOT_EVIDENCE",
                "is_circular": False,
                "key_claims_verified": 0,
                "justification": "Analyse LLM indisponible, score basé sur la réputation du domaine",
                "source_reputation_score": source_rep,
            }
            cognitive_result = {
                "manipulation_score": heuristic_boost,
                "emotional_arousal": 0,
                "detected_biases": [],
                "sensationalism_markers": 0,
                "justification": "Analyse LLM indisponible, score basé sur les heuristiques de surface",
            }
        
        factual_score = fact_result["factual_score"]
        manipulation_score = cognitive_result["manipulation_score"]
        is_circular = fact_result.get("is_circular", False)
        
        # ── 3. Decision Matrix ──
        status = self._resolve_verdict(factual_score, manipulation_score, is_circular)
        
        # ── 4. Generate Explanation ──
        explanation = self._generate_explanation(
            status, fact_result, cognitive_result, sources_count
        )
        
        return ReliabilityVerdict(
            status=status,
            factual_score=factual_score,
            manipulation_score=manipulation_score,
            source_reputation_score=fact_result.get("source_reputation_score", 45),
            root_evidence_quality=fact_result.get("root_evidence_quality", "NO_ROOT_EVIDENCE"),
            detected_biases=cognitive_result.get("detected_biases", []),
            explanation=explanation,
            is_circular=is_circular,
            is_synthesis=sources_count > 1,
            sources_count=sources_count,
        )
    
    def _resolve_verdict(self, factual_score: int, manip_score: int, is_circular: bool) -> str:
        """Cross-reference factual and manipulation scores for final verdict."""
        if is_circular:
            return ReliabilityStatus.RUMEUR_EN_BOUCLE.value
        if factual_score > 80 and manip_score < 30:
            return ReliabilityStatus.FAIT_OBJECTIF_FIABLE.value
        if factual_score > 80 and manip_score >= 70:
            return ReliabilityStatus.FAIT_MILITARISE.value
        if factual_score > 40 and factual_score <= 80 and manip_score < 50:
            return ReliabilityStatus.INFORMATION_PARTIELLE.value
        if factual_score < 40 and manip_score > 60:
            return ReliabilityStatus.DESINFORMATION_TOXIQUE.value
        return ReliabilityStatus.NON_VERIFIABLE.value
    
    def _generate_explanation(
        self, status: str, fact_result: dict, cognitive_result: dict, sources_count: int
    ) -> str:
        """Generate a clear, human-readable explanation of the verdict."""
        
        fact_just = fact_result.get("justification", "")
        cog_just = cognitive_result.get("justification", "")
        biases = cognitive_result.get("detected_biases", [])
        root_q = fact_result.get("root_evidence_quality", "NO_ROOT_EVIDENCE")
        
        parts = []
        
        status_info = STATUS_LABELS.get(status, {})
        parts.append(f"Verdict : {status_info.get('icon', '❓')} {status_info.get('label', status)}.")
        
        if sources_count > 1:
            parts.append(f"Cette synthèse regroupe {sources_count} sources fusionnées.")
        
        if fact_just:
            parts.append(f"Factualité : {fact_just}")
        
        evidence_info = EVIDENCE_LABELS.get(root_q, {})
        if evidence_info:
            parts.append(f"Qualité de preuve : {evidence_info.get('label', root_q)} — {evidence_info.get('desc', '')}.")
        
        if cog_just:
            parts.append(f"Analyse rhétorique : {cog_just}")
        
        if biases:
            bias_names = [BIAS_LABELS.get(b, {}).get("label", b) for b in biases]
            parts.append(f"Biais détectés : {', '.join(bias_names)}.")
        
        return " ".join(parts)
