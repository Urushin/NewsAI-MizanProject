"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth, API } from "../context/AuthContext";
import OnboardingWizard from "./OnboardingWizard";

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
    onPreview?: (data: any) => void;
}

export default function ProfilePopup({ onPreview }: ProfilePopupProps) {
    const { user, token, logout, updateProfile, triggerRefresh } = useAuth();
    const [open, setOpen] = useState(false);
    const [manifesto, setManifesto] = useState("");
    const [language, setLanguage] = useState(user?.language || "fr");
    const [threshold, setThreshold] = useState(user?.score_threshold || 70);
    const [summaryLength, setSummaryLength] = useState(2);
    const [newPassword, setNewPassword] = useState("");
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");
    const [wizardOpen, setWizardOpen] = useState(false);

    // Generation state with progress
    const [genState, setGenState] = useState({
        loading: false,
        success: false,
        error: "",
        step: "",
        percent: 0,
    });
    const ref = useRef<HTMLDivElement>(null);

    // Use current user language for labels
    const t = labels[user?.language || "fr"] || labels.en;

    // Sync when user changes
    useEffect(() => {
        if (user) {
            setLanguage(user.language);
            setThreshold(user.score_threshold);
        }
    }, [user]);

    // Load manifesto and preferences when popup opens
    useEffect(() => {
        if (open && token) {
            fetch(`${API}/api/me/manifesto`, {
                headers: { Authorization: `Bearer ${token}` },
            })
                .then((r) => r.json())
                .then((d) => setManifesto(d.content || ""))
                .catch(() => { });

            fetch(`${API}/api/me/profile`, {
                headers: { Authorization: `Bearer ${token}` },
            })
                .then((r) => r.json())
                .then((d) => {
                    if (d.preferences && d.preferences.summary_length) {
                        setSummaryLength(d.preferences.summary_length);
                    }
                })
                .catch(() => { });
        }
    }, [open, token]);

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

    if (!user) return null;

    const initials = user.username.slice(0, 2).toUpperCase();

    const handleSave = async () => {
        setSaving(true);
        setMsg("");
        try {
            // Update profile settings (language + threshold)
            await updateProfile({ language, score_threshold: threshold });

            // Update manifesto
            await fetch(`${API}/api/me/manifesto`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ content: manifesto }),
            });

            // Update summary length preferences
            await fetch(`${API}/api/me/profile/preferences`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ summary_length: summaryLength }),
            });

            // Update password if provided
            if (newPassword.trim()) {
                await fetch(`${API}/api/me/password`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ new_password: newPassword }),
                });
                setNewPassword("");
            }

            // Trigger brief refresh so page.tsx re-fetches with updated prefs
            triggerRefresh();

            setMsg(t.saved);
            setTimeout(() => setMsg(""), 2000);
        } catch {
            setMsg(t.error);
        } finally {
            setSaving(false);
        }
    };

    const handleGenerate = async (mode: "test" | "prod") => {
        // Reset state
        setGenState({ loading: true, success: false, error: "", step: mode === "test" ? "Démarrage Test..." : "Démarrage Production...", percent: 0 });

        // Start polling for progress
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API}/api/brief/status`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const status = await res.json();

                if (status.status === "done") {
                    clearInterval(interval);
                    setGenState({ loading: false, success: true, error: "", step: "Terminé !", percent: 100 });

                    if (mode === "prod") {
                        triggerRefresh(); // Reload main page
                        setTimeout(() => setOpen(false), 1500);
                    }
                } else if (status.status === "error") {
                    clearInterval(interval);
                    setGenState({ loading: false, success: false, error: "Erreur (" + status.step + ")", step: "", percent: 0 });
                } else {
                    setGenState((prev) => ({
                        ...prev,
                        step: status.step || "En cours...",
                        percent: status.percent || prev.percent
                    }));
                }
            } catch (e) { }
        }, 1000);

        try {
            // Trigger Generation
            const res = await fetch(`${API}/api/brief/generate?mode=${mode}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || `Erreur lancement HTTP ${res.status}`);
            }

            if (mode === "test") {
                // Synchronous return
                const data = await res.json();
                clearInterval(interval); // Stop polling (already handled by sync return)

                if (data.status === "empty") {
                    setGenState({ loading: false, success: false, error: "Aucun article trouvé", step: "", percent: 0 });
                    return;
                }

                // Success Preview
                setGenState({ loading: false, success: true, error: "", step: "Terminé !", percent: 100 });
                if (onPreview) {
                    onPreview(data);
                    setTimeout(() => setOpen(false), 800);
                }
            } else {
                // Async return (queued)
                // Polling loop above handles completion
            }

        } catch (e: any) {
            clearInterval(interval);
            setGenState({ loading: false, success: false, error: e.message || "Erreur connexion", step: "", percent: 0 });
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
                {initials}
            </button>

            {/* Overlay */}
            {open && (
                <div className="profile-overlay">
                    <div className="profile-panel" ref={ref}>
                        {/* Header */}
                        <div className="profile-header">
                            <div className="profile-avatar-large">{initials}</div>
                            <div>
                                <p className="profile-username">{user.username}</p>
                                <p className="profile-meta">
                                    {language === "fr" ? "Français" : language === "en" ? "English" : "日本語"}
                                </p>
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
                                onChange={(e) => setSummaryLength(parseInt(e.target.value))}
                            />
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-light)", marginTop: "4px" }}>
                                <span>Puces</span>
                                <span>Phrase</span>
                                <span>1 Para</span>
                                <span>Analyse</span>
                            </div>
                        </div>

                        {/* Manifesto */}
                        <div className="profile-field">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <label style={{ marginBottom: 0 }}>{t.manifesto}</label>
                                <button
                                    style={{
                                        fontSize: "12px",
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        color: "var(--text-light)",
                                        textDecoration: "underline"
                                    }}
                                    onClick={() => setWizardOpen(true)}
                                >
                                    🎯 Assistant
                                </button>
                            </div>
                            <textarea
                                value={manifesto}
                                onChange={(e) => setManifesto(e.target.value)}
                                rows={8}
                                placeholder={t.manifestoPlaceholder}
                            />
                        </div>

                        {/* Generate Button */}

                        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                            {/* TEST Button */}
                            <button
                                className="profile-generate"
                                style={{ flex: 1, background: "var(--bg-secondary)", color: "var(--text)", border: "1px solid var(--separator)" }}
                                onClick={() => handleGenerate("test")}
                                disabled={genState.loading}
                                title={t.generate}
                            >
                                {genState.loading ? (
                                    <span className="gen-loading">⏳</span>
                                ) : (
                                    <span>🧪 Test (Preview)</span>
                                )}
                            </button>

                            {/* PROD Button */}
                            <button
                                className="profile-generate"
                                style={{ flex: 1 }}
                                onClick={() => handleGenerate("prod")}
                                disabled={genState.loading}
                                title="Sauvegarder dans l'historique"
                            >
                                {genState.loading ? (
                                    <span className="gen-loading">
                                        <span className="gen-text">{genState.step} ({genState.percent}%)</span>
                                    </span>
                                ) : genState.success ? (
                                    <span className="gen-success">{t.generated}</span>
                                ) : genState.error ? (
                                    <span className="gen-error">⚠ {genState.error}</span>
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
                    </div>
                </div>
            )}
            {/* Wizard */}
            {wizardOpen && (
                <OnboardingWizard
                    onClose={() => setWizardOpen(false)}
                    onSuccess={() => {
                        setWizardOpen(false);
                        // Refresh manifesto
                        if (token) {
                            fetch(`${API}/api/me/manifesto`, {
                                headers: { Authorization: `Bearer ${token}` },
                            })
                                .then((r) => r.json())
                                .then((d) => setManifesto(d.content || ""))
                                .catch(() => { });
                        }
                    }}
                />
            )}
        </>
    );
}
