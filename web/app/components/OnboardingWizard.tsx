"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, Check, Target, Sparkles, SlidersHorizontal, Radar, Youtube } from "lucide-react";
import { API, useAuth } from "../context/AuthContext";

interface OnboardingWizardProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function OnboardingWizard({ onClose, onSuccess }: OnboardingWizardProps) {
    const { token } = useAuth();
    const [step, setStep] = useState(1);
    const [taxonomy, setTaxonomy] = useState<Record<string, string[]>>({});
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);

    // Contexte de vie (Demographics)
    const [ageRange, setAgeRange] = useState("");
    const [exactAge, setExactAge] = useState("");
    const [location, setLocation] = useState("");
    const [exactLocation, setExactLocation] = useState("");
    const [occupation, setOccupation] = useState("");
    const [exactOccupation, setExactOccupation] = useState("");

    // YouTube subscriptions
    const [youtubeChannels, setYoutubeChannels] = useState("");

    const [custom, setCustom] = useState("");
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        fetch(`${API}/api/taxonomy`)
            .then((r) => r.json())
            .then((data) => {
                const safeTaxonomy: Record<string, string[]> = {};
                for (const [key, value] of Object.entries(data)) {
                    safeTaxonomy[key] = Array.isArray(value) ? value : [];
                }
                setTaxonomy(safeTaxonomy);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const toggleTopic = (t: string) => {
        if (selectedTopics.includes(t)) {
            setSelectedTopics((prev) => prev.filter((x) => x !== t));
            const subsToRemove = taxonomy[t] || [];
            setSelectedSubtopics((prev) => prev.filter((s) => !subsToRemove.includes(s)));
        } else {
            setSelectedTopics((prev) => [...prev, t]);
        }
    };

    const toggleSub = (s: string) => {
        if (selectedSubtopics.includes(s)) {
            setSelectedSubtopics((prev) => prev.filter((x) => x !== s));
        } else {
            setSelectedSubtopics((prev) => [...prev, s]);
        }
    };

    const handleFinish = async () => {
        setGenerating(true);
        try {
            await fetch(`${API}/api/onboarding/manifesto`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    topics: selectedTopics,
                    subtopics: selectedSubtopics,
                    custom,
                    age_range: ageRange,
                    exact_age: exactAge,
                    location: location,
                    exact_location: exactLocation,
                    occupation: occupation,
                    exact_occupation: exactOccupation,
                    youtube_channels: youtubeChannels
                }),
            });
            onSuccess();
        } catch (e) {
            console.error(e);
            setGenerating(false);
        }
    };

    if (loading) return null;

    const currentPercent = ((step - 1) / 3) * 100;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/40 p-4 sm:p-6" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ ease: "easeOut", duration: 0.25 }}
                style={{ willChange: "transform, opacity" }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-2xl bg-white rounded-2xl sm:rounded-[24px] shadow-2xl flex flex-col overflow-hidden h-[90vh] sm:h-auto sm:max-h-[85vh]"
            >
                {/* ── HEADER ────────────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-black/[0.04] shrink-0">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900">
                            Personnalisez votre Brief
                        </h2>
                        <p className="text-[13px] text-gray-400 font-medium mt-1">
                            Configurez l&apos;IA pour qu&apos;elle vous suive à la trace
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* ── PROGRESS BAR ─────────────────────────────────────────── */}
                <div className="w-full h-1.5 bg-gray-100 shrink-0">
                    <motion.div
                        className="h-full bg-indigo-500 rounded-r-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${currentPercent}%` }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                </div>

                {/* ── CONTENT (SCROLLABLE) ─────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-8 custom-scrollbar">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
                                        <Target size={18} />
                                    </div>
                                    <h3 className="text-[17px] font-bold text-gray-900">1. Quels sont vos grands intérêts ?</h3>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                                    {Object.keys(taxonomy).map((topic) => {
                                        const isSelected = selectedTopics.includes(topic);
                                        return (
                                            <button
                                                key={topic}
                                                onClick={() => toggleTopic(topic)}
                                                className={`p-4 sm:p-5 text-left rounded-xl transition-all duration-200 border-2 ${isSelected ? "border-indigo-500 bg-indigo-50/50" : "border-gray-100 hover:border-gray-200 bg-white"}`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className={`text-[14px] sm:text-[15px] font-bold ${isSelected ? "text-indigo-700" : "text-gray-700"}`}>
                                                        {topic}
                                                    </span>
                                                    {isSelected && <Check size={16} className="text-indigo-500 shrink-0" />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-500">
                                        <SlidersHorizontal size={18} />
                                    </div>
                                    <h3 className="text-[17px] font-bold text-gray-900">2. Soyez plus précis</h3>
                                </div>
                                {selectedTopics.length === 0 ? (
                                    <p className="text-[14px] text-gray-500 bg-gray-50 p-6 rounded-xl text-center border border-gray-100 border-dashed">
                                        Veuillez retourner à l&apos;étape précédente pour sélectionner un thème.
                                    </p>
                                ) : (
                                    <div className="flex flex-col gap-8">
                                        {selectedTopics.map((topic) => (
                                            <div key={topic} className="flex flex-col gap-3">
                                                <h4 className="text-[13px] font-bold uppercase tracking-wide text-gray-400">{topic}</h4>
                                                <div className="flex flex-wrap gap-2.5">
                                                    {taxonomy[topic]?.map((sub) => {
                                                        const isSelected = selectedSubtopics.includes(sub);
                                                        return (
                                                            <button
                                                                key={sub}
                                                                onClick={() => toggleSub(sub)}
                                                                className={`px-4 py-2 text-[14px] font-medium rounded-full transition-all duration-200 border ${isSelected ? "bg-gray-900 border-gray-900 text-white shadow-md shadow-gray-900/10" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"}`}
                                                            >
                                                                {sub}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-500">
                                        <Radar size={18} />
                                    </div>
                                    <h3 className="text-[17px] font-bold text-gray-900">3. Votre Radar d&apos;Impact (Optionnel)</h3>
                                </div>
                                <div className="mb-6 p-4 bg-teal-50/50 rounded-xl border border-teal-100">
                                    <p className="text-[13px] text-teal-800 leading-relaxed">
                                        Même si vous n&apos;aimez pas l&apos;économie ou la politique, certaines actualités (réformes, lois, météo locale) peuvent avoir un <strong>impact direct sur vous</strong>. L&apos;IA filtrera intelligemment tout ce qui peut vous concerner. <em>Plus vous serez précis, plus le radar sera fin.</em>
                                    </p>
                                </div>

                                <div className="space-y-6">
                                    {/* AGE */}
                                    <div className="space-y-3">
                                        <label className="text-[14px] font-bold text-gray-800">Votre âge</label>
                                        <div className="flex flex-wrap gap-2">
                                            {["18-25", "26-35", "36-50", "50+"].map(range => (
                                                <button
                                                    key={range}
                                                    onClick={() => { setAgeRange(range); setExactAge(""); }}
                                                    className={`px-4 py-2 text-[13px] font-medium rounded-full transition-all border ${ageRange === range ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                                                >
                                                    {range} ans
                                                </button>
                                            ))}
                                            <input
                                                type="number"
                                                placeholder="Âge précis..."
                                                value={exactAge}
                                                onChange={(e) => {
                                                    setExactAge(e.target.value);
                                                    if (e.target.value) setAgeRange("");
                                                }}
                                                className="px-4 py-2 text-[13px] border border-gray-200 rounded-full focus:outline-none focus:border-teal-500 max-w-[120px]"
                                            />
                                        </div>
                                    </div>

                                    {/* LOCATION */}
                                    <div className="space-y-3">
                                        <label className="text-[14px] font-bold text-gray-800">Où vivez-vous ?</label>
                                        <div className="flex flex-wrap gap-2">
                                            {["France", "Belgique", "Suisse", "Québec"].map(loc => (
                                                <button
                                                    key={loc}
                                                    onClick={() => { setLocation(loc); setExactLocation(""); }}
                                                    className={`px-4 py-2 text-[13px] font-medium rounded-full transition-all border ${location === loc ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                                                >
                                                    {loc}
                                                </button>
                                            ))}
                                            <input
                                                type="text"
                                                placeholder="Ville ou Région..."
                                                value={exactLocation}
                                                onChange={(e) => {
                                                    setExactLocation(e.target.value);
                                                    if (e.target.value) setLocation("");
                                                }}
                                                className="px-4 py-2 text-[13px] border border-gray-200 rounded-full focus:outline-none focus:border-teal-500 flex-1 min-w-[150px]"
                                            />
                                        </div>
                                    </div>

                                    {/* OCCUPATION */}
                                    <div className="space-y-3">
                                        <label className="text-[14px] font-bold text-gray-800">Secteur ou Profession</label>
                                        <div className="flex flex-wrap gap-2">
                                            {["Santé", "Tech", "Étudiant", "Éducation", "Commerce"].map(occ => (
                                                <button
                                                    key={occ}
                                                    onClick={() => { setOccupation(occ); setExactOccupation(""); }}
                                                    className={`px-4 py-2 text-[13px] font-medium rounded-full transition-all border ${occupation === occ ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                                                >
                                                    {occ}
                                                </button>
                                            ))}
                                            <input
                                                type="text"
                                                placeholder="Titre exact (ex: Développeur)..."
                                                value={exactOccupation}
                                                onChange={(e) => {
                                                    setExactOccupation(e.target.value);
                                                    if (e.target.value) setOccupation("");
                                                }}
                                                className="px-4 py-2 text-[13px] border border-gray-200 rounded-full focus:outline-none focus:border-teal-500 flex-1 min-w-[200px]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 4 && (
                            <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>

                                {/* Section YouTube */}
                                <div className="mb-8">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500">
                                            <Youtube size={18} />
                                        </div>
                                        <h3 className="text-[17px] font-bold text-gray-900">Vos Chaînes YouTube Principales (Optionnel)</h3>
                                    </div>
                                    <p className="text-[14px] text-gray-500 mb-4 leading-relaxed">
                                        Surveillez les dernières vidéos de vos créateurs préférés directement depuis votre édition officielle. L&apos;IA récupèrera toutes les sorties des 24 dernières heures.
                                    </p>
                                    <textarea
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-[14px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none placeholder:text-gray-400"
                                        placeholder="Ex: HugoDécrypte, Squeezie, Marques Brownlee (Un par ligne)"
                                        value={youtubeChannels}
                                        onChange={(e) => setYoutubeChannels(e.target.value)}
                                        rows={3}
                                    />
                                </div>

                                {/* Section Custom Notes (Touche finale) */}
                                <div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
                                            <Sparkles size={18} />
                                        </div>
                                        <h3 className="text-[17px] font-bold text-gray-900">Touche finale (Optionnel)</h3>
                                    </div>
                                    <p className="text-[14px] text-gray-500 mb-4">
                                        Y a-t-il une entreprise, une équipe sportive, ou un sujet de niche très spécifique que vous suivez de près ? Vous pouvez écrire librement ici.
                                    </p>
                                    <textarea
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-5 text-[15px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none placeholder:text-gray-400"
                                        placeholder="Ex: Passion pour l'horlogerie, les lancements spatiaux, l'équipe de rugby de Toulouse..."
                                        value={custom}
                                        onChange={(e) => setCustom(e.target.value)}
                                        rows={4}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ── FOOTER ───────────────────────────────────────────────── */}
                <div className="px-6 sm:px-8 py-5 border-t border-black/[0.04] bg-[#FAFAFA] flex items-center justify-between shrink-0">
                    {step > 1 ? (
                        <button
                            onClick={() => setStep(step - 1)}
                            className="text-[14px] font-semibold text-gray-500 hover:text-gray-900 px-4 py-2 transition-colors"
                        >
                            Retour
                        </button>
                    ) : (
                        <div />
                    )}

                    {step < 4 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            disabled={step === 1 && selectedTopics.length === 0}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl text-[14px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all active:scale-95"
                        >
                            Continuer <ChevronRight size={16} />
                        </button>
                    ) : (
                        <button
                            onClick={handleFinish}
                            disabled={generating}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[14px] font-semibold disabled:opacity-50 hover:bg-indigo-700 transition-all active:scale-95"
                        >
                            {generating ? (
                                <>Génération <span className="animate-pulse">...</span></>
                            ) : (
                                "Créer mon assistant"
                            )}
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
