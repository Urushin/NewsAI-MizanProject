"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../utils/api";
import { useToast } from "../context/ToastContext";
import { wizardLabels, commonLabels } from "../config/translations";
import { TRANSITIONS } from "../config/constants";

// Step Components
import StepTopics from "./onboarding/StepTopics";
import StepSubtopics from "./onboarding/StepSubtopics";
import StepIdentity from "./onboarding/StepIdentity";
import StepCustom from "./onboarding/StepCustom";

interface OnboardingWizardProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function OnboardingWizard({ onClose, onSuccess }: OnboardingWizardProps) {
    const { user } = useAuth();
    const api = useApi();
    const { showToast } = useToast();
    const [step, setStep] = useState(1);
    const [taxonomy, setTaxonomy] = useState<Record<string, string[]>>({});
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);

    // Identity / Radar
    const [ageRange, setAgeRange] = useState("");
    const [exactAge, setExactAge] = useState("");
    const [location, setLocation] = useState("");
    const [exactLocation, setExactLocation] = useState("");
    const [occupation, setOccupation] = useState("");
    const [exactOccupation, setExactOccupation] = useState("");

    // Custom / YouTube
    const [youtubeChannels, setYoutubeChannels] = useState("");
    const [custom, setCustom] = useState("");
    
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    const lang = user?.language || "fr";
    const w = wizardLabels[lang] || wizardLabels.en;
    const c = commonLabels[lang] || commonLabels.en;

    useEffect(() => {
        api.get("/api/taxonomy")
            .then((data: Record<string, string[]>) => {
                setTaxonomy(data || {});
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [api]);

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

    const handleFinish = async () => {
        if (generating) return;
        setGenerating(true);
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
                youtube_channels: youtubeChannels
            });
            onSuccess();
        } catch (e: any) {
            showToast(e.message || "Erreur de sauvegarde", "error");
            setGenerating(false);
        }
    };

    if (loading) return null;

    const renderStep = () => {
        switch(step) {
            case 1: return <StepTopics taxonomy={taxonomy} selectedTopics={selectedTopics} toggleTopic={toggleTopic} />;
            case 2: return <StepSubtopics selectedTopics={selectedTopics} taxonomy={taxonomy} selectedSubtopics={selectedSubtopics} toggleSub={toggleSub} />;
            case 3: return <StepIdentity ageRange={ageRange} setAgeRange={setAgeRange} exactAge={exactAge} setExactAge={setExactAge} location={location} setLocation={setLocation} exactLocation={exactLocation} setExactLocation={setExactLocation} occupation={occupation} setOccupation={setOccupation} exactOccupation={exactOccupation} setExactOccupation={setExactOccupation} />;
            case 4: return <StepCustom youtubeChannels={youtubeChannels} setYoutubeChannels={setYoutubeChannels} custom={custom} setCustom={setCustom} />;
            default: return null;
        }
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-zinc-950/40 backdrop-blur-md p-4" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 10 }}
                transition={TRANSITIONS.spring}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-2xl bg-[#FDFCF8] rounded-none shadow-2xl flex flex-col overflow-hidden h-[90vh] sm:h-auto sm:max-h-[85vh] border border-zinc-200"
            >
                {/* Header */}
                <div className="px-10 py-10 border-b-2 border-zinc-900 flex justify-between items-center bg-[#FDFCF8]">
                     <div>
                        <h2 className="text-3xl font-[900] tracking-tighter text-zinc-900 font-serif lowercase italic">Config.</h2>
                        <div className="flex items-center gap-3 mt-4">
                          <span className="text-[10px] font-black bg-zinc-900 text-white px-3 py-1 uppercase tracking-widest">{w.step} {step}/4</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-colors">
                        <X size={28} strokeWidth={1.5} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-10 py-10 custom-scrollbar bg-white/50">
                    <AnimatePresence mode="wait">
                        {renderStep()}
                    </AnimatePresence>
                </div>

                 <div className="px-10 py-8 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between">
                    {step > 1 ? (
                        <button onClick={() => setStep(step - 1)} className="text-[11px] font-black text-zinc-400 hover:text-zinc-900 uppercase tracking-widest transition-colors">{c.back}</button>
                    ) : <div />}

                    {step < 4 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            disabled={step === 1 && selectedTopics.length === 0}
                             className="flex items-center gap-3 px-8 py-4 bg-zinc-900 text-white text-[11px] font-black uppercase tracking-widest disabled:opacity-30 hover:bg-black transition-all active:scale-95 shadow-xl"
                        >
                            {c.next} <ChevronRight size={16} />
                        </button>
                    ) : (
                        <button
                            onClick={handleFinish}
                            disabled={generating}
                             className="flex items-center gap-3 px-8 py-4 bg-zinc-900 text-white text-[11px] font-black uppercase tracking-widest disabled:opacity-50 hover:bg-black transition-all active:scale-95 shadow-xl"
                        >
                            {generating ? "Finalisation..." : "Enregistrer et Terminer"}
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
