"use client";

import { useState } from "react";
import { useAuth, API } from "../context/AuthContext";

interface Props {
    articleTitle: string;
    onDismissed: () => void;
    lang?: string;
}

const dismissLabels: Record<string, { label: string; tooltip: string }> = {
    fr: { label: "pas intéressé", tooltip: "Pas intéressé — sera noté dans vos préférences" },
    en: { label: "not interested", tooltip: "Not interested — this will be noted in your preferences" },
    ja: { label: "興味なし", tooltip: "興味なし — あなたの設定に記録されます" },
};

export default function NotInterested({ articleTitle, onDismissed, lang = "fr" }: Props) {
    const { token } = useAuth();
    const [dismissed, setDismissed] = useState(false);
    const [loading, setLoading] = useState(false);

    const t = dismissLabels[lang] || dismissLabels.en;

    const handleDismiss = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!token || loading) return;

        setLoading(true);
        try {
            await fetch(`${API}/api/articles/dismiss`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ article_title: articleTitle }),
            });
            setDismissed(true);
            setTimeout(() => onDismissed(), 300);
        } catch {
            setLoading(false);
        }
    };

    if (dismissed) return null;

    return (
        <button
            className="not-interested-btn"
            onClick={handleDismiss}
            disabled={loading}
            title={t.tooltip}
        >
            {loading ? "…" : t.label}
        </button>
    );
}
