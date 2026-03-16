"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import OnboardingWizard from "./OnboardingWizard";
import { motion, AnimatePresence } from "framer-motion";
import { useApi } from "../utils/api";
import { useToast } from "../context/ToastContext";
import { BriefData } from "../types/news";
import { getInitials } from "../utils/newsUtils";
import { profileLabels } from "../config/translations";
import { TRANSITIONS } from "../config/constants";
import { 
  LogOut, 
  Sparkles, 
  Activity, 
  BookMarked,
  LayoutGrid,
  Shield,
  X
} from "lucide-react";

interface ProfilePopupProps {
    onPreview?: (data: BriefData) => void;
    customTrigger?: React.ReactNode;
    className?: string;
}

export default function ProfilePopup({ onPreview, customTrigger, className }: ProfilePopupProps) {
    const { user, logout, updateProfile, triggerRefresh, genStatus, setGenStatus } = useAuth();
    const api = useApi();
    const router = useRouter();
    const toast = useToast();

    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [manifesto, setManifesto] = useState("");
    const [language, setLanguage] = useState(user?.language || "fr");
    const [threshold, setThreshold] = useState(user?.score_threshold ?? 70);
    const [summaryLength, setSummaryLength] = useState(2);
    const [newPassword, setNewPassword] = useState("");
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");
    const [wizardOpen, setWizardOpen] = useState(false);

    const ref = useRef<HTMLDivElement>(null);
    const t = profileLabels[user?.language || "fr"] || profileLabels.en;

    useEffect(() => {
        setMounted(true);
    }, []);

    // Sync state
    useEffect(() => {
        if (open && user) {
            setLanguage(user.language || "fr");
            setThreshold(user.score_threshold ?? 70);
            
            api.get("/api/me/manifesto").then(d => setManifesto(d.content || ""));
            api.get("/api/me/profile").then(d => {
                if (d.preferences?.summary_length) setSummaryLength(d.preferences.summary_length);
            });
        }
    }, [open, user, api]);

    // Outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateProfile({ language, score_threshold: threshold });
            await api.put("/api/me/manifesto", { content: manifesto });
            await api.put("/api/me/profile/preferences", { summary_length: summaryLength });
            if (newPassword.trim()) {
                await api.put("/api/me/password", { new_password: newPassword });
                setNewPassword("");
            }
            triggerRefresh();
            setMsg(t.saved);
            setTimeout(() => setMsg(""), 2000);
        } catch {
            toast.showToast(t.error, "error");
        } finally {
            setSaving(false);
        }
    };

    const handleGenerate = async (mode: "test" | "prod") => {
        setOpen(false);
        setGenStatus({ active: true, step: "Initialisation de l'Imprimerie...", percent: 5, isDone: false });
        try {
            await api.post(`/api/brief/generate?mode=${mode}`);
            // Le backend tourne en asynchrone. Le long polling (briefing/page.tsx) prend le relais.
        } catch (e: any) {
            setGenStatus({ active: false, step: "", percent: 0, isDone: false });
            toast.showToast(e.message || t.genErrorMsg, "error");
        }
    };

    if (!user) return null;

    const modalContent = (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-950/50 backdrop-blur-md p-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 5 }}
                        transition={TRANSITIONS.spring}
                        className="bg-[#FDFCF8] rounded-none sm:rounded-sm shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col relative border border-zinc-200"
                        ref={ref}
                    >
                        {/* Close button */}
                        <button 
                            onClick={() => setOpen(false)}
                            className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-colors z-[210]"
                        >
                            <X size={24} strokeWidth={1.5} />
                        </button>

                        {/* Minimalist Header */}
                        <div className="px-10 pt-12 pb-8 flex flex-col gap-6 border-b-2 border-zinc-900">
                            <div className="w-16 h-16 rounded-full bg-zinc-900 text-white flex items-center justify-center text-2xl font-[900] shadow-sm font-serif">
                                {getInitials(user.username)}
                            </div>
                            <div>
                                <h3 className="text-4xl font-[900] text-zinc-900 leading-none mb-3 font-serif truncate">{user.username}</h3>
                                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Lecteur Abonné</p>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto px-10 py-10 custom-scrollbar space-y-12">
                            
                            {/* Section Preferences */}
                            <div className="space-y-6">
                              <div className="flex items-center gap-3 mb-2 pb-2 border-b border-zinc-200">
                                <LayoutGrid size={16} className="text-zinc-400" />
                                <span className="text-[11px] font-black uppercase tracking-[0.1em] text-zinc-900">Préférences de lecture</span>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                <div className="flex flex-col gap-3">
                                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t.language}</label>
                                  <select 
                                    value={language} 
                                    onChange={(e) => setLanguage(e.target.value)}
                                    className="w-full bg-transparent border-b border-zinc-300 pb-2 text-sm font-medium text-zinc-900 focus:border-zinc-900 focus:outline-none appearance-none font-serif"
                                  >
                                    <option value="fr">Français (FR)</option>
                                    <option value="en">English (EN)</option>
                                  </select>
                                </div>

                                <div className="flex flex-col gap-3">
                                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Exigence: {threshold}%</label>
                                  <input 
                                    type="range" min={0} max={100} value={threshold} 
                                    onChange={(e) => setThreshold(parseInt(e.target.value))}
                                    className="flex-1 mt-2 h-0.5 bg-zinc-200 appearance-none cursor-pointer accent-zinc-900"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Ligne éditoriale (Manifesto) */}
                            <div className="space-y-6">
                              <div className="flex justify-between items-center pb-2 border-b border-zinc-200">
                                <div className="flex items-center gap-3">
                                  <BookMarked size={16} className="text-zinc-400" />
                                  <span className="text-[11px] font-black uppercase tracking-[0.1em] text-zinc-900">Ligne Éditoriale IA</span>
                                </div>
                                <button 
                                  onClick={() => setWizardOpen(true)}
                                  className="text-[10px] font-black text-zinc-500 hover:text-zinc-900 uppercase underline decoration-zinc-300 underline-offset-4"
                                >
                                  Assistant Configuration
                                </button>
                              </div>
                            </div>

                            {/* Security */}
                            <div className="space-y-6">
                              <div className="flex items-center gap-3 pb-2 border-b border-zinc-200">
                                <Shield size={16} className="text-zinc-400" />
                                <span className="text-[11px] font-black uppercase tracking-[0.1em] text-zinc-900">{t.safety}</span>
                              </div>
                              <input 
                                type="password" 
                                placeholder={t.passwordPlaceholder}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full bg-transparent border-b border-zinc-300 pb-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none font-serif placeholder:italic placeholder:font-sans"
                              />
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="px-10 py-8 bg-zinc-50 border-t border-zinc-200 flex flex-col gap-4">
                            <div className="flex gap-4">
                              <button 
                                className="flex-[4] bg-zinc-900 text-white py-4 text-[13px] font-black shadow-lg hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50 tracking-widest uppercase font-sans"
                                onClick={handleSave} 
                                disabled={saving}
                              >
                                {saving ? t.saving : msg || "Enregistrer Profil"}
                              </button>
                              <button 
                                className="flex-1 bg-transparent border border-zinc-300 text-zinc-400 py-4 flex items-center justify-center hover:bg-white hover:border-red-500 hover:text-red-500 transition-all"
                                title="Déconnexion"
                                onClick={() => { logout(); setOpen(false); }}
                              >
                                <LogOut size={16} />
                              </button>
                            </div>
                            
                            <button 
                              className="w-full bg-white border border-zinc-300 text-zinc-900 py-4 text-[11px] font-black flex items-center justify-center gap-3 hover:bg-zinc-100 transition-all disabled:opacity-50 uppercase tracking-[0.2em]"
                              onClick={() => handleGenerate("prod")}
                              disabled={genStatus.active}
                            >
                              {genStatus.active ? (
                                <Activity size={16} className="animate-spin text-zinc-400" />
                              ) : (
                                <>
                                  <Sparkles size={16} />
                                  Générer Nouvelle Édition
                                </>
                              )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    return (
        <>
            <div onClick={() => setOpen(!open)} className={className || "cursor-pointer"}>
                {customTrigger || (
                    <div className="w-10 h-10 rounded-full bg-zinc-900 text-white flex items-center justify-center font-black text-sm hover:scale-105 transition-transform shadow-lg">
                        {getInitials(user.username || "??")}
                    </div>
                )}
            </div>

            {mounted && createPortal(modalContent, document.body)}

            {wizardOpen && mounted && createPortal(
                <OnboardingWizard
                    onClose={() => setWizardOpen(false)}
                    onSuccess={() => {
                        setWizardOpen(false);
                        triggerRefresh();
                    }}
                />,
                document.body
            )}
        </>
    );
}