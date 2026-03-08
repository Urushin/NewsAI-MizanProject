"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import OnboardingWizard from "./OnboardingWizard";
import { motion, AnimatePresence } from "framer-motion";
import { useApi } from "../utils/api";
import { useToast } from "../context/ToastContext";
import { BriefData } from "../types/news";
import { getInitials } from "../utils/newsUtils";

// i18n for the profile popup
const labels: Record<string, Record<string, string>> = {
    fr: {
        language: "Langue",
        threshold: "Seuil de pertinence",
        manifesto: "Manifesto",
        manifestoPlaceholder: "Décrivez vos centres d'intérêt…",
        newPassword: "Nouveau mot de passe",
        passwordPlaceholder: "Laisser vide pour ne pas changer",
        save: "Enregistrer",
        saving: "Sauvegarde…",
        saved: "✓ Enregistré",
        error: "Erreur",
        logout: "Se déconnecter",
        langNote: "Le changement de langue sera appliqué au prochain briefing généré.",
        generate: "🔄 Test Rapide (Preview)",
        generating: "⏳ Mode Test…",
        generated: "✓ Chargé dans la page !",
        generateError: "❌ Erreur Test",
    },
    en: {
        language: "Language",
        threshold: "Relevance threshold",
        manifesto: "Manifesto",
        manifestoPlaceholder: "Describe your interests…",
        newPassword: "New password",
        passwordPlaceholder: "Leave empty to keep current",
        save: "Save",
        saving: "Saving…",
        saved: "✓ Saved",
        error: "Error",
        logout: "Log out",
        langNote: "Language change will apply to the next generated briefing.",
        generate: "🔄 Quick Test (Preview)",
        generating: "⏳ Testing…",
        generated: "✓ Loaded in page!",
        generateError: "❌ Test Error",
    },
    ja: {
        language: "言語",
        threshold: "関連性しきい値",
        manifesto: "マニフェスト",
        manifestoPlaceholder: "興味のある分野を記述してください…",
        newPassword: "新しいパスワード",
        passwordPlaceholder: "変更しない場合は空のまま",
        save: "保存",
        saving: "保存中…",
        saved: "✓ 保存しました",
        error: "エラー",
        logout: "ログアウト",
        langNote: "言語の変更は次回生成されたブリーフィングに適用されます。",
        generate: "🔄 テスト (プレビュー)",
        generating: "⏳ テスト中…",
        generated: "✓ ページに読み込みました",
        generateError: "❌ エラー",
    },
};

interface ProfilePopupProps {
    onPreview?: (data: BriefData) => void;
}

export default function ProfilePopup({ onPreview }: ProfilePopupProps) {
    const { user, token, logout, updateProfile, refreshProfile, triggerRefresh, genStatus, setGenStatus } = useAuth();
    const api = useApi();
    const router = useRouter();

    /** * SÉCURITÉ CONTEXTE : 
     * Si useToast() est appelé hors d'un Provider, il lance une erreur.
     * On utilise un try/catch ou on vérifie si le hook retourne bien une valeur 
     * pour éviter que toute l'app ne crash.
     */
    let toast;
    try {
        toast = useToast();
    } catch (e) {
        console.warn("ToastContext non trouvé. Vérifiez que ToastProvider enveloppe l'application.");
    }

    // Fonction helper pour appeler le toast sans crasher
    const triggerToast = (message: string, type: string = "info") => {
        if (toast?.showToast) {
            toast.showToast(message, type);
        } else {
            console.log(`[Toast Fallback] ${type.toUpperCase()}: ${message}`);
        }
    };

    const [open, setOpen] = useState(false);
    const [manifesto, setManifesto] = useState("");
    const [language, setLanguage] = useState(user?.language || "fr");
    const [threshold, setThreshold] = useState(user?.score_threshold || 70);
    const [summaryLength, setSummaryLength] = useState(2);
    const [newPassword, setNewPassword] = useState("");
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");
    const [wizardOpen, setWizardOpen] = useState(false);

    const ref = useRef<HTMLDivElement>(null);

    // Use current user language for labels
    const t = labels[user?.language || "fr"] || labels.en;

    // Sync local state when the popup opens OR when user data (context) changes elsewhere
    useEffect(() => {
        if (open && user) {
            setLanguage(user.language);
            setThreshold(user.score_threshold);
        }
    }, [open, user]);

    // Load manifesto and preferences when popup opens
    useEffect(() => {
        if (open && token) {
            api.get("/api/me/manifesto")
                .then((d: { content?: string }) => setManifesto(d.content || ""))
                .catch(() => { });

            api.get("/api/me/profile")
                .then((d: { preferences?: { summary_length?: number } }) => {
                    if (d.preferences && d.preferences.summary_length) {
                        setSummaryLength(d.preferences.summary_length);
                    }
                })
                .catch(() => { });
        }
    }, [open, token, api]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    useEffect(() => {
        if (open && ref.current) {
            ref.current.focus();
        }
    }, [open]);

    if (!user) return null;

    const handleSave = async () => {
        setSaving(true);
        setMsg("");
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
            setMsg(t.error);
            triggerToast(t.error, "error");
        } finally {
            setSaving(false);
        }
    };

    const handleGenerate = async (mode: "test" | "prod") => {
        setGenStatus({ active: true, step: "Initialisation...", percent: 5, isDone: false });

        try {
            const data: BriefData = await api.post(`/api/brief/generate?mode=${mode}`);
            if (data.status === "done" || (data.content && data.content.length > 0)) {
                setGenStatus({ active: true, step: "Terminé !", percent: 100, isDone: true });
                setOpen(false);

                setTimeout(() => {
                    setGenStatus({ active: false, step: "", percent: 0, isDone: false });
                    if (mode === "test" && onPreview) {
                        onPreview(data);
                    } else {
                        triggerRefresh();
                    }
                }, 2000);
            }
        } catch (e: any) {
            setGenStatus({ active: false, step: "", percent: 0, isDone: false });
            triggerToast(e.message || "Erreur de connexion au serveur", "error");
        }
    };

    return (
        <>
            {/* Avatar Button */}
            <button
                className="profile-avatar"
                onClick={() => setOpen(!open)}
                aria-label="Profile"
            >
                {getInitials(user?.username || "??")}
            </button>

            {/* Overlay with Focus Trap effect */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="profile-overlay fixed inset-0 z-[100] bg-black/40 backdrop-blur-[2px] flex items-center justify-center sm:block sm:relative sm:z-auto"
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="profile-panel relative z-[110]"
                            ref={ref}
                            tabIndex={-1}
                        >
                            {/* Header */}
                            <div className="profile-header">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-indigo-100 ring-4 ring-white">
                                    {getInitials(user?.username || "??")}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-[22px] font-[850] text-gray-900 leading-tight">
                                        {user?.username}
                                    </h3>
                                    <p className="text-[13px] text-gray-400 font-medium">Membre Mizan depuis {new Date().getFullYear()}</p>
                                </div>
                            </div>

                            {/* Language */}
                            <div className="profile-field">
                                <label>{t.language}</label>
                                <select
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                >
                                    <option value="fr">🇫🇷 Français</option>
                                    <option value="en">🇬🇧 English</option>
                                    <option value="ja">🇯🇵 日本語</option>
                                </select>
                                {language !== user.language && (
                                    <p className="profile-note">{t.langNote}</p>
                                )}
                            </div>

                            {/* Score Threshold */}
                            <div className="profile-field">
                                <label>{t.threshold}: {threshold}</label>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={threshold}
                                    onChange={(e) => setThreshold(parseInt(e.target.value))}
                                />
                            </div>

                            {/* Summary Length Preference */}
                            <div className="profile-field">
                                <label>Taille des résumés ciblée (1-4)</label>
                                <input
                                    type="range"
                                    min={1}
                                    max={4}
                                    step={1}
                                    value={summaryLength}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        if (val === 4) {
                                            triggerToast("Premium ⭐ : Le niveau 4 (Analyse Profonde) sera bientôt disponible.", "premium");
                                            setSummaryLength(3);
                                        } else {
                                            setSummaryLength(val);
                                        }
                                    }}
                                />
                                <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                                    <span>Puces</span>
                                    <span>Phrase</span>
                                    <span>1 Para</span>
                                    <span className="text-gray-200">Analyse 🔒</span>
                                </div>
                            </div>

                            {/* Manifesto */}
                            <div className="profile-field">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="mb-0">{t.manifesto}</label>
                                    <div className="flex gap-3">
                                        <button
                                            className="text-[12px] bg-none border-none cursor-pointer text-gray-400 underline"
                                            onClick={() => setWizardOpen(true)}
                                        >
                                            🎯 Assistant
                                        </button>
                                        <button
                                            className="text-[12px] bg-none border-none cursor-pointer text-gray-400 underline"
                                            onClick={() => {
                                                setOpen(false);
                                                router.push("/sources");
                                            }}
                                        >
                                            📊 Sources
                                        </button>
                                    </div>
                                </div>
                                <textarea
                                    value={manifesto}
                                    onChange={(e) => setManifesto(e.target.value)}
                                    rows={8}
                                    placeholder={t.manifestoPlaceholder}
                                />
                            </div>

                            {/* Generate Buttons */}
                            <div className="flex gap-2.5 mt-4">
                                <button
                                    className="profile-generate flex-1 bg-gray-50 text-gray-900 border border-gray-100"
                                    onClick={() => handleGenerate("test")}
                                    disabled={genStatus.active}
                                    title={t.generate}
                                >
                                    {genStatus.active ? (
                                        <span className="gen-loading">⏳</span>
                                    ) : (
                                        <span>🧪 Test (Preview)</span>
                                    )}
                                </button>

                                <button
                                    className="profile-generate flex-1"
                                    onClick={() => handleGenerate("prod")}
                                    disabled={genStatus.active}
                                    title="Sauvegarder dans l'historique"
                                >
                                    {genStatus.active ? (
                                        <span className="gen-loading">
                                            <span className="gen-text">{genStatus.step} ({genStatus.percent}%)</span>
                                        </span>
                                    ) : genStatus.isDone ? (
                                        <span className="gen-success">{t.generated}</span>
                                    ) : (
                                        <span>📢 Édition Officielle</span>
                                    )}
                                </button>
                            </div>

                            {/* Password */}
                            <div className="profile-field">
                                <label>{t.newPassword}</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder={t.passwordPlaceholder}
                                />
                            </div>

                            {/* Actions */}
                            <div className="profile-actions">
                                <button className="profile-save" onClick={handleSave} disabled={saving}>
                                    {saving ? t.saving : msg || t.save}
                                </button>
                                <button
                                    className="profile-logout"
                                    onClick={() => {
                                        logout();
                                        setOpen(false);
                                    }}
                                >
                                    {t.logout}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Wizard */}
            {wizardOpen && (
                <OnboardingWizard
                    onClose={() => setWizardOpen(false)}
                    onSuccess={() => {
                        setWizardOpen(false);
                        if (token) {
                            refreshProfile();
                            api.get("/api/me/manifesto")
                                .then((d: { content?: string }) => setManifesto(d.content || ""))
                                .catch(() => { });
                        }
                    }}
                />
            )}
        </>
    );
}