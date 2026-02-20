"use client";

import { useEffect, useState } from "react";
import { useAuth, API } from "../context/AuthContext";

interface HistoryEntry {
    date: string;
    total_kept: number;
    total_collected: number;
}

interface Props {
    onSelectDate: (date: string | null) => void;
    selectedDate: string | null;
    lang: string;
}

const i18n: Record<string, Record<string, string>> = {
    fr: {
        title: "Historique",
        empty: "Aucun historique disponible",
        today: "Aujourd'hui",
        articles: "articles",
        back: "← Retour à aujourd'hui",
    },
    en: {
        title: "History",
        empty: "No history available",
        today: "Today",
        articles: "articles",
        back: "← Back to today",
    },
    ja: {
        title: "履歴",
        empty: "履歴はまだありません",
        today: "今日",
        articles: "件",
        back: "← 今日に戻る",
    },
};

function formatHistoryDate(dateStr: string, lang: string): string {
    // Handle timestamp format: YYYY-MM-DD_HH-MM-SS
    const parts = dateStr.split("_");
    const datePart = parts[0];
    const timePart = parts[1];

    const [y, m, d] = datePart.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const locale = lang === "fr" ? "fr-FR" : lang === "ja" ? "ja-JP" : "en-US";

    const formattedDate = date.toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    if (timePart) {
        const [h, min] = timePart.split("-");
        const timeSep = lang === 'fr' ? 'h' : ':';
        return `${formattedDate} (${h}${timeSep}${min})`;
    }
    return formattedDate;
}

export default function HistoryPanel({ onSelectDate, selectedDate, lang }: Props) {
    const { token } = useAuth();
    const [open, setOpen] = useState(false);
    const [dates, setDates] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(false);

    const t = i18n[lang] || i18n.en;

    useEffect(() => {
        if (!open || !token) return;
        setLoading(true);
        fetch(`${API}/api/brief/history`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => {
                setDates(data.dates || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [open, token]);

    const todayStr = new Date().toISOString().slice(0, 10);

    return (
        <div className="history-wrapper">
            <button
                className="history-toggle"
                onClick={() => setOpen((o) => !o)}
                aria-label={t.title}
                title={t.title}
            >
                <span className="history-icon">📰</span>
            </button>

            {open && (
                <div className="history-panel">
                    {selectedDate && (
                        <button
                            className="history-back"
                            onClick={() => {
                                onSelectDate(null);
                                setOpen(false);
                            }}
                        >
                            {t.back}
                        </button>
                    )}

                    {loading ? (
                        <p className="history-loading">…</p>
                    ) : dates.length === 0 ? (
                        <p className="history-empty">{t.empty}</p>
                    ) : (
                        <ul className="history-list">
                            {dates.map((entry) => {
                                const isToday = entry.date.startsWith(todayStr); // Check if starts with today's date (ignoring time)
                                const isSelected = entry.date === selectedDate;

                                // For list, just show the formatted date/time
                                const label = formatHistoryDate(entry.date, lang);

                                return (
                                    <li key={entry.date}>
                                        <button
                                            className={`history-date-btn${isSelected ? " selected" : ""}`}
                                            onClick={() => {
                                                // If today (no time in filename), unselect goes to "current". 
                                                // If timestamped, goes to that specific version.
                                                const isPlainToday = entry.date === todayStr;
                                                onSelectDate(isPlainToday ? null : entry.date);
                                                setOpen(false);
                                            }}
                                        >
                                            <span className="history-date-label">{label}</span>
                                            <span className="history-date-count">
                                                {entry.total_kept} {t.articles}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
