"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Check, 
  ChevronRight, 
  Search, 
  X, 
  Loader2, 
  Youtube, 
  MessageSquare, 
  Link as LinkIcon, 
  Sparkles,
  BookOpen,
  Layers,
  Globe
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../utils/api";
import { useToast } from "../context/ToastContext";
import { wizardLabels, commonLabels } from "../config/translations";
import { TRANSITIONS } from "../config/constants";
import { ImpactStyle } from "@capacitor/haptics";
import { triggerHaptic as triggerHapticUtil } from "../utils/haptics";

interface OnboardingWizardProps {
    onClose?: () => void;
    onSuccess: () => void;
}

const AGE_RANGES = ["- de 18", "18-25", "26-35", "36-50", "50+"];

const COUNTRIES = [
  "France", "Belgique", "Suisse", "Canada", "Luxembourg", "Maroc", "Algérie", "Tunisie", 
  "Sénégal", "Côte d'Ivoire", "Cameroun", "Royaume-Uni", "États-Unis", "Allemagne", 
  "Espagne", "Italie", "Portugal", "---", "Afghanistan", "Afrique du Sud", "Albanie", "Andorre", "Angola", "Antigua-et-Barbuda", 
  "Arabie Saoudite", "Argentine", "Arménie", "Australie", "Autriche", "Azerbaïdjan", 
  "Bahamas", "Bahreïn", "Bangladesh", "Barbade", "Bénin", "Bhoutan", "Biélorussie", 
  "Birmanie", "Bolivie", "Bosnie-Herzégovine", "Botswana", "Brésil", "Brunei", 
  "Bulgarie", "Burkina Faso", "Burundi", "Cambodge", "Cap-Vert", "Chili", "Chine", 
  "Chypre", "Colombie", "Comores", "Congo", "Corée du Nord", "Corée du Sud", "Costa Rica", 
  "Croatie", "Cuba", "Danemark", "Djibouti", "Dominique", "Égypte", "Émirats Arabes Unis", 
  "Équateur", "Érythrée", "Estonie", "Eswatini", "Éthiopie", "Fidji", "Finlande", "Gabon", 
  "Gambie", "Géorgie", "Ghana", "Grèce", "Grenade", "Guatemala", "Guinée", "Guinée équatoriale", 
  "Guinée-Bissau", "Guyana", "Haïti", "Honduras", "Hongrie", "Inde", "Indonésie", "Irak", 
  "Iran", "Irlande", "Islande", "Israël", "Jamaïque", "Japon", "Jordanie", "Kazakhstan", 
  "Kenya", "Kirghizistan", "Kiribati", "Koweït", "Laos", "Lesotho", "Lettonie", "Liban", 
  "Libéria", "Libye", "Liechtenstein", "Lituanie", "Macédoine du Nord", "Madagascar", "Malaisie", 
  "Malawi", "Maldives", "Mali", "Malte", "Maurice", "Mauritanie", "Mexique", "Micronésie", 
  "Moldavie", "Monaco", "Mongolie", "Monténégro", "Mozambique", "Namibie", "Nauru", "Népal", 
  "Nicaragua", "Niger", "Nigeria", "Norvège", "Nouvelle-Zélande", "Oman", "Ouganda", "Ouzbékistan", 
  "Pakistan", "Palaos", "Palestine", "Panama", "Papouasie-Nouvelle-Guinée", "Paraguay", "Pays-Bas", 
  "Pérou", "Philippines", "Pologne", "Qatar", "République Centrafricaine", "République Dominicaine", 
  "République Tchèque", "Roumanie", "Russie", "Rwanda", "Saint-Christophe-et-Niévès", "Sainte-Lucie", 
  "Saint-Marin", "Saint-Vincent-et-les-Grenadines", "Salomon", "Salvador", "Samoa", "Sao Tomé-et-Principe", 
  "Serbie", "Seychelles", "Sierra Leone", "Singapour", "Slovaquie", "Slovénie", "Somalie", "Soudan", 
  "Soudan du Sud", "Sri Lanka", "Suède", "Suriname", "Syrie", "Tadjikistan", "Taïwan", "Tanzanie", 
  "Tchad", "Thaïlande", "Timor oriental", "Togo", "Tonga", "Trinité-et-Tobago", "Turkménistan", 
  "Turquie", "Tuvalu", "Ukraine", "Uruguay", "Vanuatu", "Vatican", "Venezuela", "Viêt Nam", 
  "Yémen", "Zambie", "Zimbabwe"
];

const SECTORS = [
  "Tech & Numérique", "Finance & Économie", "Santé & Médical", "Enseignement & Recherche", 
  "Commerce & Vente", "Artisanat & Industrie", "Art, Culture & Médias", "Étudiant", 
  "Droit & Juridique", "Immobilier", "Restauration & Tourisme", "Transport & Logistique", "Autre"
];

const FORMATS = [
  { id: "bullet", title: "Bullet points", desc: "Rapide et direct sous forme d'énumérations." },
  { id: "detailed", title: "Analytique", desc: "Plus de détails, structuré par points clés d'impact." },
  { id: "editorial", title: "Chronique", desc: "Narratif, rédigé comme un article de journal." }
];

const THEMES = [
  { id: "light", title: "Papier (Clair)", desc: "Aesthetic minimaliste journalier ivoire." },
  { id: "dark", title: "Sombre", desc: "Contrasté, reposant pour la lecture de nuit." },
  { id: "glass", title: "Glass (Moderne)", desc: "Effets de flou et transparence contemporains." }
];

interface YTChannel {
    id: string;
    title: string;
    thumbnail: string;
    handle?: string;
}

interface RedditSub {
    id: string;
    title: string;
    thumbnail?: string;
    subscribers?: number;
}

export default function OnboardingWizard({ onClose, onSuccess }: OnboardingWizardProps) {
    const { user } = useAuth();
    const api = useApi();
    const { showToast } = useToast();
    
    const [step, setStep] = useState(1);
    const [taxonomy, setTaxonomy] = useState<Record<string, string[]>>({});
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);

    // Core States
    const [language, setLanguage] = useState(user?.language || "fr");
    const [theme, setTheme] = useState("light");
    const [ageRange, setAgeRange] = useState("");
    const [exactAge, setExactAge] = useState("");
    const [location, setLocation] = useState("");
    const [exactLocation, setExactLocation] = useState("");
    const [occupation, setOccupation] = useState("");
    const [exactOccupation, setExactOccupation] = useState("");

    // Custom Sources States
    const [youtubeChannels, setYoutubeChannels] = useState("");
    const [rssFeeds, setRssFeeds] = useState("");
    const [subreddits, setSubreddits] = useState("");
    const [custom, setCustom] = useState("");
    const [summaryFormat, setSummaryFormat] = useState("bullet");
    
    // UI Local States
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [customTopicInput, setCustomTopicInput] = useState("");

    // Search query states
    const [ytQuery, setYtQuery] = useState("");
    const [ytResults, setYtResults] = useState<YTChannel[]>([]);
    const [searchingYt, setSearchingYt] = useState(false);
    const [selectedYt, setSelectedYt] = useState<YTChannel[]>([]);

    const [redditQuery, setRedditQuery] = useState("");
    const [redditResults, setRedditResults] = useState<RedditSub[]>([]);
    const [searchingReddit, setSearchingReddit] = useState(false);
    const [selectedReddit, setSelectedReddit] = useState<RedditSub[]>([]);

    const [rssUrl, setRssUrl] = useState("");
    const [selectedRss, setSelectedRss] = useState<string[]>([]);

    const lang = user?.language || "fr";
    const w = wizardLabels[lang] || wizardLabels.en;
    const c = commonLabels[lang] || commonLabels.en;

    const triggerHaptic = useCallback(async (style = ImpactStyle.Light) => {
        if (style === ImpactStyle.Heavy) {
            await triggerHapticUtil.success();
        } else if (style === ImpactStyle.Medium) {
            await triggerHapticUtil.medium();
        } else {
            await triggerHapticUtil.light();
        }
    }, []);

    // Load Taxonomy
    useEffect(() => {
        api.get("/api/taxonomy")
            .then((data: Record<string, string[]>) => {
                setTaxonomy(data || {});
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [api]);

    // YouTube Debounce Search
    useEffect(() => {
        const trimmed = ytQuery.trim();
        if (!trimmed) { setYtResults([]); return; }
        const delay = setTimeout(() => {
            setSearchingYt(true);
            api.get(`/api/youtube/search?q=${encodeURIComponent(trimmed)}`)
               .then((data: YTChannel[]) => setYtResults(data || []))
               .catch(() => setYtResults([]))
               .finally(() => setSearchingYt(false));
        }, 500);
        return () => clearTimeout(delay);
    }, [ytQuery, api]);

    // Reddit Debounce Search
    useEffect(() => {
        const trimmed = redditQuery.trim();
        if (!trimmed) { setRedditResults([]); return; }
        const delay = setTimeout(() => {
            setSearchingReddit(true);
            api.get(`/api/reddit/search?q=${encodeURIComponent(trimmed)}`)
               .then((data: RedditSub[]) => setRedditResults(data || []))
               .catch(() => setRedditResults([]))
               .finally(() => setSearchingReddit(false));
        }, 500);
        return () => clearTimeout(delay);
    }, [redditQuery, api]);

    // Sync search selections back to API strings
    useEffect(() => {
        setYoutubeChannels(selectedYt.map(c => c.title).join("\n"));
    }, [selectedYt]);

    useEffect(() => {
        setRssFeeds(selectedRss.join("\n"));
    }, [selectedRss]);

    useEffect(() => {
        setSubreddits(selectedReddit.map(r => r.title.replace("r/", "")).join("\n"));
    }, [selectedReddit]);

    const toggleTopic = useCallback((t: string) => {
        setSelectedTopics(prev => {
            if (prev.includes(t)) {
                const updatedTopics = prev.filter(x => x !== t);
                const subsToRemove = taxonomy[t] || [];
                setSelectedSubtopics(sPrev => sPrev.filter(s => !subsToRemove.includes(s)));
                return updatedTopics;
            }
            return [...prev, t];
        });
    }, [taxonomy]);

    const toggleSub = useCallback((s: string) => {
        setSelectedSubtopics(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    }, []);

    const handleAddCustomTopic = () => {
        const trimmed = customTopicInput.trim();
        if (trimmed && !selectedTopics.includes(trimmed)) {
            toggleTopic(trimmed);
            setCustomTopicInput("");
        }
    };

    const handleAddRss = () => {
        const trimmed = rssUrl.trim();
        if (trimmed && !selectedRss.includes(trimmed)) {
            setSelectedRss(prev => [...prev, trimmed]);
            setRssUrl("");
        }
    };

    const handleFinish = async () => {
        if (generating) return;
        setGenerating(true);
        triggerHaptic(ImpactStyle.Heavy);
        try {
            await api.post("/api/onboarding/manifesto", {
                topics: selectedTopics,
                subtopics: selectedSubtopics,
                custom,
                age_range: ageRange,
                exact_age: exactAge,
                location: location,
                exact_location: exactLocation,
                occupation: occupation,
                exact_occupation: exactOccupation,
                youtube_channels: youtubeChannels,
                rss_feeds: rssFeeds,
                subreddits: subreddits,
                summary_format: summaryFormat,
                theme: theme
            });
            onSuccess();
        } catch (e: any) {
            showToast(e.message || "Erreur de sauvegarde", "error");
            setGenerating(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-[300] bg-[#FDFCF8] flex flex-col items-center justify-center p-6">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-zinc-900" size={28} />
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400">Initialisation de la Matrice...</span>
                </div>
            </div>
        );
    }

    const stepTransition: any = {
        initial: { opacity: 0, x: 25 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -25 },
        transition: { duration: 0.4, ease: "easeOut" }
    };

    const addedCustoms = selectedTopics.filter(t => !Object.keys(taxonomy).includes(t));

    return (
        <div className="fixed inset-0 z-[300] bg-[#FDFCF8] flex flex-col justify-between w-full h-full overflow-hidden pt-[max(env(safe-area-inset-top),20px)] pb-[max(env(safe-area-inset-bottom),20px)] select-none">
            
            {/* Elegant Top Progress Bar */}
            <div className="w-full h-1 bg-zinc-100/50 sticky top-0 left-0 right-0 z-50">
                <motion.div 
                    className="h-full bg-zinc-950" 
                    animate={{ width: `${(step / 7) * 100}%` }} 
                    transition={{ ease: "easeOut", duration: 0.4 }} 
                />
            </div>

            {/* Immersive Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 sm:px-12 py-10 max-w-2xl mx-auto w-full custom-scrollbar">
                <AnimatePresence mode="wait">
                    
                    {/* STEP 1: Language & Theme */}
                    {step === 1 && (
                        <motion.div key="step1" {...stepTransition} className="space-y-10">
                            <div className="space-y-2">
                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Étape 01 — Configuration générale</span>
                                <h2 className="text-3xl font-[900] tracking-tight font-serif italic text-zinc-900 lowercase">
                                    Vos préférences de base
                                </h2>
                                <p className="text-zinc-500 font-serif italic text-sm leading-relaxed">
                                    Définissez la langue de vos revues de presse ainsi que l'esthétique générale de votre Kiosque.
                                </p>
                            </div>

                            {/* Language selection */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block border-b border-zinc-100 pb-2">
                                    Langue de lecture
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { id: "fr", label: "Français" },
                                        { id: "en", label: "English" }
                                    ].map(l => {
                                        const isSelected = language === l.id;
                                        return (
                                            <button
                                                key={l.id}
                                                type="button"
                                                onClick={() => { triggerHaptic(); setLanguage(l.id); }}
                                                className={`p-5 border text-center transition-all flex flex-col justify-center items-center ${
                                                    isSelected ? "border-zinc-950 bg-zinc-950 text-white shadow-xl scale-102" : "border-zinc-200 hover:border-zinc-400 text-zinc-800 bg-white"
                                                }`}
                                            >
                                                <span className="text-sm font-bold uppercase tracking-widest">{l.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Theme selection */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block border-b border-zinc-100 pb-2">
                                    Thème Visuel
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {THEMES.map(t => {
                                        const isSelected = theme === t.id;
                                        return (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => { triggerHaptic(); setTheme(t.id); }}
                                                className={`p-5 border text-left flex flex-col justify-between transition-all relative ${
                                                    isSelected ? "border-zinc-950 bg-zinc-950 text-white shadow-xl scale-102" : "border-zinc-200 hover:border-zinc-400 text-zinc-800 bg-white"
                                                }`}
                                            >
                                                {isSelected && <div className="absolute right-3 top-3"><Check size={14} className="text-white" /></div>}
                                                <div>
                                                    <span className="text-[12px] font-black uppercase tracking-wider block mb-1">{t.title}</span>
                                                    <p className={`text-[10px] font-serif italic ${isSelected ? "text-zinc-300" : "text-zinc-400"}`}>{t.desc}</p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 2: Core Topics */}
                    {step === 2 && (
                        <motion.div key="step2" {...stepTransition} className="space-y-8">
                            <div className="space-y-2">
                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Étape 02 — Thématiques clés</span>
                                <h2 className="text-3xl font-[900] tracking-tight font-serif italic text-zinc-900 lowercase">
                                    Vos centres d'intérêt majeurs
                                </h2>
                                <p className="text-zinc-500 font-serif italic text-sm leading-relaxed">
                                    Sélectionnez les piliers fondamentaux qui structureront vos synthèses d'actualité quotidiennes.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3">
                                {Object.keys(taxonomy).map(topic => {
                                    const isSelected = selectedTopics.includes(topic);
                                    return (
                                        <button
                                            key={topic}
                                            type="button"
                                            onClick={() => { triggerHaptic(); toggleTopic(topic); }}
                                            className={`p-6 border text-left flex justify-between items-center transition-all ${
                                                isSelected ? "border-zinc-950 bg-zinc-950 text-white shadow-xl" : "border-zinc-200 hover:border-zinc-400 text-zinc-800 bg-white"
                                            }`}
                                        >
                                            <span className="text-sm font-black uppercase tracking-widest">{topic}</span>
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                                                isSelected ? "border-white/40 text-white" : "border-zinc-200 text-zinc-400"
                                            }`}>
                                                {isSelected && <Check size={12} />}
                                            </div>
                                        </button>
                                    );
                                })}

                                {/* Custom topic search */}
                                <div className="mt-4 pt-6 border-t border-zinc-100 space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block">Autre sujet d'intérêt ?</label>
                                    
                                    {addedCustoms.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {addedCustoms.map(t => (
                                                <div key={t} className="flex items-center gap-2 bg-zinc-950 text-white pl-3 pr-2.5 py-1.5 shadow-md">
                                                    <span className="text-[11px] font-bold uppercase tracking-wider">{t}</span>
                                                    <button type="button" onClick={() => toggleTopic(t)} className="text-white/50 hover:text-white"><X size={12} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            placeholder="Ex: Énergies renouvelables..."
                                            value={customTopicInput}
                                            onChange={(e) => setCustomTopicInput(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleAddCustomTopic()}
                                            className="w-full bg-white border border-zinc-200 px-4 py-3 text-[14px] font-serif italic focus:outline-none focus:border-zinc-950 h-11"
                                        />
                                        <button type="button" onClick={handleAddCustomTopic} className="bg-zinc-950 text-white px-5 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors h-11">Ajouter</button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 3: Subtopics Selection */}
                    {step === 3 && (
                        <motion.div key="step3" {...stepTransition} className="space-y-8">
                            <div className="space-y-2">
                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Étape 03 — Curation chirurgicale</span>
                                <h2 className="text-3xl font-[900] tracking-tight font-serif italic text-zinc-900 lowercase">
                                    Affinement des sous-thèmes
                                </h2>
                                <p className="text-zinc-500 font-serif italic text-sm leading-relaxed">
                                    Filtrez précisément ce qui vous intéresse au sein des grandes catégories sélectionnées.
                                </p>
                            </div>

                            {selectedTopics.length === 0 ? (
                                <div className="p-8 border border-zinc-200 bg-white text-center font-serif italic text-zinc-400">
                                    Veuillez retourner à l'étape précédente pour sélectionner au moins un thème majeur.
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {selectedTopics.map(topic => {
                                        const subtopics = taxonomy[topic] || [];
                                        if (subtopics.length === 0) return null;
                                        return (
                                            <div key={topic} className="space-y-3">
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 border-b border-zinc-100 pb-2">{topic}</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {subtopics.map(sub => {
                                                        const isSelected = selectedSubtopics.includes(sub);
                                                        return (
                                                            <button
                                                                key={sub}
                                                                type="button"
                                                                onClick={() => { triggerHaptic(); toggleSub(sub); }}
                                                                className={`px-4 py-2 text-xs font-black uppercase tracking-wider border transition-all ${
                                                                    isSelected 
                                                                        ? "bg-zinc-950 border-zinc-950 text-white shadow-md scale-102" 
                                                                        : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400"
                                                                }`}
                                                            >
                                                                {isSelected ? "— " : ""}{sub}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* STEP 4: Occupation */}
                    {step === 4 && (
                        <motion.div key="step4" {...stepTransition} className="space-y-8">
                            <div className="space-y-2">
                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Étape 04 — Prisme professionnel</span>
                                <h2 className="text-3xl font-[900] tracking-tight font-serif italic text-zinc-900 lowercase">
                                    Votre univers métier
                                </h2>
                                <p className="text-zinc-500 font-serif italic text-sm leading-relaxed">
                                    L'IA utilisera votre profession pour faire ressortir les actualités ayant un impact stratégique direct sur votre activité.
                                </p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block border-b border-zinc-100 pb-2">Secteur d'activité</label>
                                    <select
                                        value={occupation}
                                        onChange={(e) => { triggerHaptic(); setOccupation(e.target.value); }}
                                        className="w-full px-4 py-3 text-sm border border-zinc-200 bg-white focus:outline-none focus:border-zinc-950 font-serif italic h-12 appearance-none cursor-pointer"
                                    >
                                        <option value="">Sélectionner un secteur...</option>
                                        {SECTORS.map(occ => (
                                            <option key={occ} value={occ}>{occ}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block border-b border-zinc-100 pb-2">Profession précise</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Développeur IA, Architecte, Étudiant..."
                                        value={exactOccupation}
                                        onChange={(e) => setExactOccupation(e.target.value)}
                                        className="w-full bg-white border border-zinc-200 px-4 py-3 text-[14px] font-serif italic focus:outline-none focus:border-zinc-950 h-12"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 5: Geographic Location */}
                    {step === 5 && (
                        <motion.div key="step5" {...stepTransition} className="space-y-8">
                            <div className="space-y-2">
                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Étape 05 — Ancrage géographique</span>
                                <h2 className="text-3xl font-[900] tracking-tight font-serif italic text-zinc-900 lowercase">
                                    Votre zone géographique
                                </h2>
                                <p className="text-zinc-500 font-serif italic text-sm leading-relaxed">
                                    Sélectionnez votre pays et votre ville pour prioriser les actualités nationales et régionales importantes.
                                </p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block border-b border-zinc-100 pb-2">Pays de résidence</label>
                                    <select
                                        value={location}
                                        onChange={(e) => { triggerHaptic(); setLocation(e.target.value); }}
                                        className="w-full px-4 py-3 text-sm border border-zinc-200 bg-white focus:outline-none focus:border-zinc-950 font-serif italic h-12 appearance-none cursor-pointer"
                                    >
                                        <option value="">Sélectionner un pays...</option>
                                        {COUNTRIES.map(loc => (
                                            <option key={loc} value={loc} disabled={loc === "---"}>{loc}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block border-b border-zinc-100 pb-2">Ville ou Région</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Paris, Lyon, Montréal..."
                                        value={exactLocation}
                                        onChange={(e) => setExactLocation(e.target.value)}
                                        className="w-full bg-white border border-zinc-200 px-4 py-3 text-[14px] font-serif italic focus:outline-none focus:border-zinc-950 h-12"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 6: Custom Feeds & veille */}
                    {step === 6 && (
                        <motion.div key="step6" {...stepTransition} className="space-y-8">
                            <div className="space-y-2">
                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Étape 06 — Sources personnalisées</span>
                                <h2 className="text-3xl font-[900] tracking-tight font-serif italic text-zinc-900 lowercase">
                                    Vos canaux de veille
                                </h2>
                                <p className="text-zinc-500 font-serif italic text-sm leading-relaxed">
                                    Intégrez vos propres chaînes YouTube, flux RSS ou subreddits pour un Kiosque totalement unique.
                                </p>
                            </div>

                            <div className="space-y-6 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                                
                                {/* YouTube Stream */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 pb-1 border-b border-zinc-100">
                                        <Youtube size={14} className="text-zinc-500" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-800">Chaînes YouTube</span>
                                    </div>

                                    {selectedYt.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {selectedYt.map(c => (
                                                <div key={c.id} className="flex items-center gap-2 bg-zinc-950 text-white pl-2 pr-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider">
                                                    {c.thumbnail && <img src={c.thumbnail} className="w-4 h-4 rounded-full object-cover" />}
                                                    <span>{c.title}</span>
                                                    <button type="button" onClick={() => setSelectedYt(prev => prev.filter(x => x.id !== c.id))} className="text-white/50 hover:text-white"><X size={12} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="relative">
                                        <div className="absolute left-4 top-3.5 text-zinc-400">
                                            {searchingYt ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                                        </div>
                                        <input 
                                            type="text" 
                                            className="w-full bg-white border border-zinc-200 pl-11 pr-4 py-3 text-[13px] font-serif italic focus:outline-none focus:border-zinc-950 h-11" 
                                            placeholder="Rechercher une chaîne..." 
                                            value={ytQuery} 
                                            onChange={(e) => setYtQuery(e.target.value)} 
                                        />
                                        {ytResults.length > 0 && (
                                            <div className="absolute top-[110%] left-0 right-0 bg-white border border-zinc-200 shadow-2xl z-50 max-h-[180px] overflow-y-auto divide-y divide-zinc-100">
                                                {ytResults.map(c => (
                                                    <button 
                                                        key={c.id} 
                                                        type="button" 
                                                        onClick={() => { triggerHaptic(); if (!selectedYt.some(x => x.id === c.id)) setSelectedYt(p => [...p, c]); setYtQuery(""); setYtResults([]); }} 
                                                        className="w-full flex items-center gap-3 p-3 hover:bg-zinc-50 text-left"
                                                    >
                                                        <img src={c.thumbnail} className="w-6 h-6 rounded-full border border-zinc-100 object-cover" />
                                                        <div className="flex flex-col"><span className="text-xs font-bold text-zinc-900">{c.title}</span><span className="text-[9px] text-zinc-400">{c.handle}</span></div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Reddit Stream */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 pb-1 border-b border-zinc-100">
                                        <MessageSquare size={14} className="text-zinc-500" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-800">Forums Reddit</span>
                                    </div>

                                    {selectedReddit.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {selectedReddit.map(r => (
                                                <div key={r.id} className="flex items-center gap-2 bg-orange-600 text-white pl-2 pr-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider">
                                                    <span>{r.title}</span>
                                                    <button type="button" onClick={() => setSelectedReddit(prev => prev.filter(x => x.id !== r.id))} className="text-white/50 hover:text-white"><X size={12} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="relative">
                                        <div className="absolute left-4 top-3.5 text-zinc-400">
                                            {searchingReddit ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                                        </div>
                                        <input 
                                            type="text" 
                                            className="w-full bg-white border border-zinc-200 pl-11 pr-4 py-3 text-[13px] font-serif italic focus:outline-none focus:border-zinc-950 h-11" 
                                            placeholder="Ex: technology, worldnews..." 
                                            value={redditQuery} 
                                            onChange={(e) => setRedditQuery(e.target.value)} 
                                        />
                                        {redditResults.length > 0 && (
                                            <div className="absolute top-[110%] left-0 right-0 bg-white border border-zinc-200 shadow-2xl z-50 max-h-[180px] overflow-y-auto divide-y divide-zinc-100">
                                                {redditResults.map(r => (
                                                    <button 
                                                        key={r.id} 
                                                        type="button" 
                                                        onClick={() => { triggerHaptic(); if (!selectedReddit.some(x => x.id === r.id)) setSelectedReddit(p => [...p, r]); setRedditQuery(""); setRedditResults([]); }} 
                                                        className="w-full flex items-center gap-3 p-3 hover:bg-zinc-50 text-left"
                                                    >
                                                        <div className="flex flex-col"><span className="text-xs font-bold text-zinc-900">{r.title}</span><span className="text-[9px] text-zinc-400">{r.subscribers?.toLocaleString()} inscrits</span></div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* RSS Stream */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 pb-1 border-b border-zinc-100">
                                        <LinkIcon size={14} className="text-zinc-500" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-800">Flux RSS / Sites Web</span>
                                    </div>

                                    {selectedRss.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {selectedRss.map((url, i) => (
                                                <div key={i} className="flex items-center gap-2 bg-zinc-100 border border-zinc-200 text-zinc-800 px-3 py-1.5 text-[11px] font-bold truncate max-w-[220px]">
                                                    <span className="truncate">{url}</span>
                                                    <button type="button" onClick={() => setSelectedRss(prev => prev.filter(x => x !== url))} className="text-zinc-400 hover:text-zinc-900"><X size={12} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            className="w-full bg-white border border-zinc-200 px-4 py-3 text-[13px] font-serif italic focus:outline-none focus:border-zinc-950 h-11" 
                                            placeholder="URL du flux (ex: https://site.com/rss)" 
                                            value={rssUrl} 
                                            onChange={(e) => setRssUrl(e.target.value)} 
                                            onKeyDown={(e) => e.key === "Enter" && handleAddRss()} 
                                        />
                                        <button type="button" onClick={handleAddRss} className="bg-zinc-950 text-white px-5 text-[10px] font-black uppercase tracking-widest hover:bg-black h-11">Ajouter</button>
                                    </div>
                                </div>

                            </div>
                        </motion.div>
                    )}

                    {/* STEP 7: Format preferences & Custom Manifesto */}
                    {step === 7 && (
                        <motion.div key="step7" {...stepTransition} className="space-y-8">
                            <div className="space-y-2">
                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">Étape 07 — Profil de rédaction</span>
                                <h2 className="text-3xl font-[900] tracking-tight font-serif italic text-zinc-900 lowercase">
                                    Gabarit & Notes Personnalisées
                                </h2>
                                <p className="text-zinc-500 font-serif italic text-sm leading-relaxed">
                                    Déterminez la structure de lecture souhaitée et donnez vos consignes éditoriales secrètes à votre IA.
                                </p>
                            </div>

                            {/* Summary formats selection */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block border-b border-zinc-100 pb-2">Format de synthèse</label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {FORMATS.map(f => {
                                        const isSelected = summaryFormat === f.id;
                                        return (
                                            <button
                                                key={f.id}
                                                type="button"
                                                onClick={() => { triggerHaptic(); setSummaryFormat(f.id); }}
                                                className={`p-5 border text-left flex flex-col justify-between transition-all relative ${
                                                    isSelected ? "border-zinc-950 bg-zinc-950 text-white shadow-xl scale-102" : "border-zinc-200 hover:border-zinc-400 text-zinc-800 bg-white"
                                                }`}
                                            >
                                                {isSelected && <div className="absolute right-3 top-3"><Check size={14} className="text-white" /></div>}
                                                <div>
                                                    <span className="text-[12px] font-black uppercase tracking-wider block mb-1">{f.title}</span>
                                                    <p className={`text-[10px] font-serif italic ${isSelected ? "text-zinc-300" : "text-zinc-400"}`}>{f.desc}</p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Custom Guidelines Textarea */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 pb-1 border-b border-zinc-100">
                                    <Sparkles size={14} className="text-zinc-400" />
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Consignes Éditoriales Personnelles</label>
                                </div>
                                <textarea
                                    className="w-full bg-white border border-zinc-200 p-5 text-sm text-zinc-800 focus:outline-none focus:border-zinc-950 transition-all resize-none font-serif italic"
                                    placeholder="Ex: Évite le sensationnalisme, mets l'accent sur les enjeux européens, n'inclus pas de potins de célébrités..."
                                    value={custom}
                                    onChange={(e) => setCustom(e.target.value)}
                                    rows={5}
                                />
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>

            {/* Bottom Actions Panel */}
            <div className="px-6 sm:px-12 py-6 border-t border-zinc-100 flex items-center justify-between max-w-2xl mx-auto w-full shrink-0">
                {step > 1 ? (
                    <button 
                        onClick={() => { triggerHaptic(); setStep(step - 1); }} 
                        className="text-xs font-serif italic text-zinc-400 hover:text-zinc-900 transition-colors uppercase tracking-widest"
                    >
                        ← {c.back}
                    </button>
                ) : <div />}

                {step < 7 ? (
                    <button
                        onClick={() => { triggerHaptic(); setStep(step + 1); }}
                        disabled={step === 2 && selectedTopics.length === 0}
                        className="flex items-center gap-2 px-8 py-4 bg-zinc-950 text-white text-[10px] font-black uppercase tracking-[0.2em] disabled:opacity-20 hover:bg-black transition-all shadow-md shrink-0"
                    >
                        {c.next} <ChevronRight size={14} />
                    </button>
                ) : (
                    <button
                        onClick={handleFinish}
                        disabled={generating}
                        className="flex items-center gap-2 px-8 py-4 bg-zinc-950 text-white text-[10px] font-black uppercase tracking-[0.2em] disabled:opacity-50 hover:bg-black transition-all shadow-md shrink-0"
                    >
                        {generating ? (
                            <>
                                <Loader2 size={12} className="animate-spin" />
                                <span>Génération...</span>
                            </>
                        ) : (
                            "Enregistrer et Terminer"
                        )}
                    </button>
                )}
            </div>

        </div>
    );
}
