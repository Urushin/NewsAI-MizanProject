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
import { usePlatform } from "../../hooks/usePlatform";
import { ImpactStyle } from "@capacitor/haptics";
import { triggerHaptic as triggerHapticUtil } from "../utils/haptics";


interface ProfilePopupProps {
    onPreview?: (data: BriefData) => void;
    customTrigger?: React.ReactNode;
    className?: string;
    isOpen?: boolean;
    onClose?: () => void;
}

export default function ProfilePopup({ onPreview, customTrigger, className, isOpen, onClose }: ProfilePopupProps) {
    const { user, logout, updateProfile, triggerRefresh, genStatus, setGenStatus } = useAuth();
    const { isNative } = usePlatform();
    const api = useApi();
    const router = useRouter();
    const toast = useToast();

    const triggerHaptic = async (style = ImpactStyle.Light) => {
        if (style === ImpactStyle.Heavy) {
            await triggerHapticUtil.success();
        } else if (style === ImpactStyle.Medium) {
            await triggerHapticUtil.medium();
        } else {
            await triggerHapticUtil.light();
        }
    };

    const [internalOpen, setInternalOpen] = useState(false);
    const open = isOpen !== undefined ? isOpen : internalOpen;
    const setOpen = onClose !== undefined ? (val: boolean) => { if(!val) onClose(); } : setInternalOpen;
    
    const [mounted, setMounted] = useState(false);
    const [manifesto, setManifesto] = useState("");
    const [language, setLanguage] = useState(user?.language || "fr");
    const [threshold, setThreshold] = useState(user?.score_threshold ?? 70);
    const [summaryLength, setSummaryLength] = useState(2);
    const [newPassword, setNewPassword] = useState("");
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");
    const [wizardOpen, setWizardOpen] = useState(false);
    const [theme, setTheme] = useState<"light" | "dark">("light");
    const [visualStyle, setVisualStyle] = useState<string>("modern");

    const ref = useRef<HTMLDivElement>(null);
    const t = profileLabels[user?.language || "fr"] || profileLabels.en;

    useEffect(() => {
        setMounted(true);
        const savedTheme = localStorage.getItem("newsai_theme") === "dark" ? "dark" : "light";
        setTheme(savedTheme);
        if (savedTheme === "dark") document.documentElement.classList.add("dark");

        const savedStyle = localStorage.getItem("newsai_visual_style") || "modern";
        setVisualStyle(savedStyle);
    }, []);

    const toggleTheme = (newTheme: "light" | "dark") => {
        setTheme(newTheme);
        localStorage.setItem("newsai_theme", newTheme);
        if (newTheme === "dark") document.documentElement.classList.add("dark");
        else document.documentElement.classList.remove("dark");
    };

    const toggleVisualStyle = (style: string) => {
        setVisualStyle(style);
        localStorage.setItem("newsai_visual_style", style);
    };

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
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const timer = setTimeout(() => {
            document.addEventListener("click", handler);
        }, 50);
        return () => {
            clearTimeout(timer);
            document.removeEventListener("click", handler);
        };
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
                <div className="fixed inset-0 z-[200] bg-[#FDFCF8] overflow-hidden flex flex-col">
                    <motion.div
                        initial={isNative ? { y: "100%" } : { opacity: 0, scale: 0.98, y: 5 }}
                        animate={isNative ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                        exit={isNative ? { y: "100%" } : { opacity: 0, scale: 0.98, y: 5 }}
                        transition={isNative ? { type: "spring", damping: 30, stiffness: 220 } : TRANSITIONS.spring}
                        className={`bg-[#FDFCF8] overflow-hidden flex flex-col relative w-full h-full ${
                            !isNative ? "max-w-lg max-h-[90vh] rounded-none shadow-2xl border border-zinc-200 self-center justify-self-center my-auto mx-auto" : "safe-top safe-bottom"
                        }`}
                        ref={isNative ? null : ref}
                    >
                        {/* Header */}
                        <div className="px-8 pt-8 pb-4 flex justify-between items-center bg-[#FDFCF8]">
                            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 font-sans">
                              {t.profileTitle}
                            </h2>
                            <button 
                                onClick={() => {
                                    triggerHaptic();
                                    setOpen(false);
                                }}
                                className="w-10 h-10 rounded-none bg-zinc-100/80 flex items-center justify-center text-zinc-900 active:scale-90 transition-transform"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Scrollable Settings Panel */}
                        <div className="flex-1 overflow-y-auto px-8 py-4 custom-scrollbar space-y-6 pb-32">
                            
                            {/* Profile Info block */}
                            <div className="bg-white border border-zinc-100 p-6 rounded-none shadow-[0_8px_30px_rgb(0,0,0,0.01)] flex flex-col items-center justify-center text-center space-y-3">
                                <div className="w-16 h-16 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xl font-bold shadow-sm font-sans">
                                    {getInitials(user.username)}
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-lg font-bold text-zinc-900 font-sans leading-none">{user.username}</h3>
                                    <p className="text-xs text-zinc-400 font-medium tracking-wide">{user.email}</p>
                                </div>
                                <span className="inline-block bg-zinc-100 border border-zinc-200 px-3 py-1 rounded-none text-[9px] font-black text-zinc-500 uppercase tracking-wider">
                                    {t.planPro}
                                </span>
                            </div>

                            {/* Preferences card */}
                            <div className="bg-white border border-zinc-100 p-6 rounded-none shadow-[0_8px_30px_rgb(0,0,0,0.01)] space-y-6">
                                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">
                                    {t.readingSection}
                                </h3>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t.summaryFormat}</label>
                                    <div className="flex bg-zinc-50 border border-zinc-200 p-0.5 rounded-none w-full h-11">
                                        {[
                                            { value: 1, label: t.formatBullets },
                                            { value: 2, label: t.formatSentences },
                                            { value: 3, label: t.formatDetailed }
                                        ].map((opt) => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => {
                                                    triggerHaptic();
                                                    setSummaryLength(opt.value);
                                                }}
                                                className={`flex-1 flex items-center justify-center rounded-none py-1 text-[11px] font-black uppercase tracking-widest transition-all ${
                                                    summaryLength === opt.value
                                                        ? "bg-zinc-900 text-white shadow-sm"
                                                        : "text-zinc-400 hover:text-zinc-800"
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button 
                                    onClick={() => {
                                        triggerHaptic();
                                        setWizardOpen(true);
                                    }}
                                    className="w-full py-4 bg-zinc-900 text-white rounded-none text-[11px] font-black hover:bg-black transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                                >
                                    {t.wizardBtn}
                                </button>
                            </div>

                            {/* Appearance card */}
                            <div className="bg-white border border-zinc-100 p-6 rounded-none shadow-[0_8px_30px_rgb(0,0,0,0.01)] space-y-6">
                                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">
                                    {t.appearanceSection}
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t.langSelect}</label>
                                        <select 
                                            value={language} 
                                            onChange={(e) => setLanguage(e.target.value)}
                                            className="w-full bg-transparent border-b border-zinc-200 pb-2 text-sm font-bold text-zinc-900 focus:border-zinc-900 focus:outline-none appearance-none font-sans cursor-pointer"
                                        >
                                            <option value="fr">Français (FR)</option>
                                            <option value="en">English (EN)</option>
                                        </select>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                         <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t.themeSelect}</label>
                                         <div className="flex bg-zinc-50 border border-zinc-200 p-0.5 rounded-none w-full h-10">
                                             <button 
                                                 type="button" 
                                                 onClick={() => {
                                                     triggerHaptic();
                                                     toggleTheme("light");
                                                 }}
                                                 className={`flex-1 flex items-center justify-center gap-1.5 rounded-none py-1 text-[10px] uppercase tracking-widest transition-all ${
                                                     theme === "light" 
                                                         ? "font-black bg-zinc-900 text-white shadow-sm" 
                                                         : "font-bold text-zinc-400 hover:text-zinc-600"
                                                 }`}
                                             >
                                                 {t.themeLight}
                                             </button>
                                             <button 
                                                 type="button" 
                                                 onClick={() => {
                                                     triggerHaptic();
                                                     toggleTheme("dark");
                                                 }}
                                                 className={`flex-1 flex items-center justify-center gap-1.5 rounded-none py-1 text-[10px] uppercase tracking-widest transition-all ${
                                                     theme === "dark" 
                                                         ? "font-black bg-zinc-900 text-white shadow-sm" 
                                                         : "font-bold text-zinc-400 hover:text-zinc-600"
                                                 }`}
                                             >
                                                 {t.themeDark}
                                             </button>
                                         </div>
                                     </div>
                                 </div>

                                 <div className="flex flex-col gap-2">
                                     <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t.visualStyleSelect}</label>
                                     <div className="flex bg-zinc-50 border border-zinc-200 p-0.5 rounded-none w-full h-10">
                                         {[
                                             { id: "modern", label: t.styleModern },
                                             { id: "legacy", label: t.styleLegacy }
                                         ].map((style) => (
                                             <button
                                                 key={style.id}
                                                 type="button"
                                                 onClick={() => {
                                                     triggerHaptic();
                                                     toggleVisualStyle(style.id);
                                                 }}
                                                 className={`flex-1 flex items-center justify-center gap-1.5 rounded-none py-1 text-[10px] uppercase tracking-widest transition-all ${
                                                     visualStyle === style.id 
                                                         ? "font-black bg-zinc-900 text-white shadow-sm" 
                                                         : "font-semibold text-zinc-400 hover:text-zinc-600"
                                                 }`}
                                             >
                                                 {style.label}
                                             </button>
                                         ))}
                                     </div>
                                 </div>
                            </div>

                            {/* Security card */}
                            <div className="bg-white border border-zinc-100 p-6 rounded-none shadow-[0_8px_30px_rgb(0,0,0,0.01)] space-y-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">
                                    {t.securitySection}
                                </h3>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t.newPassword}</label>
                                    <input 
                                        type="password" 
                                        placeholder={t.passwordPlaceholder}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full bg-transparent border-b border-zinc-200 pb-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none font-sans placeholder:italic placeholder:font-sans placeholder:text-zinc-300"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Sticky Action Panel */}
                        <div className="p-8 bg-gradient-to-t from-[#FDFCF8] via-[#FDFCF8] to-[#FDFCF8]/0 sticky bottom-0 flex flex-col gap-4">
                            <div className="flex gap-4">
                              <button 
                                className="flex-[4] bg-zinc-900 text-white py-5 rounded-none text-[12px] font-black shadow-lg hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50 tracking-widest uppercase font-sans"
                                onClick={() => {
                                    triggerHaptic(ImpactStyle.Heavy);
                                    handleSave();
                                }} 
                                disabled={saving}
                              >
                                {saving ? t.saving : msg || t.saveBtn}
                              </button>
                              <button 
                                className="w-14 h-14 bg-white border border-zinc-200 rounded-none text-zinc-400 flex items-center justify-center hover:bg-white hover:border-red-500 hover:text-red-500 transition-all active:scale-95 shrink-0"
                                title={t.logoutBtn}
                                onClick={() => {
                                    triggerHaptic();
                                    logout();
                                    setOpen(false);
                                }}
                              >
                                <LogOut size={18} />
                              </button>
                            </div>
                            
                            <button 
                              className="w-full bg-white border border-zinc-200 text-zinc-900 py-4 rounded-none text-[11px] font-black flex items-center justify-center gap-3 hover:bg-zinc-50 transition-all disabled:opacity-50 uppercase tracking-[0.2em] active:scale-[0.98]"
                              onClick={() => {
                                  triggerHaptic(ImpactStyle.Heavy);
                                  handleGenerate("prod");
                              }}
                              disabled={genStatus.active}
                            >
                              {genStatus.active ? (
                                <Activity size={16} className="animate-spin text-zinc-400" />
                              ) : (
                                <>
                                  <Sparkles size={16} />
                                  {t.generateBtn}
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