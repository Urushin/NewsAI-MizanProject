"use client";

import { useEffect, useState } from "react";
import { useAuth, API } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { History, Calendar, ChevronRight, X, Clock } from "lucide-react";

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
        <div className="history-wrapper relative">
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`history-toggle ${open ? 'active' : ''}`}
                onClick={() => setOpen((o) => !o)}
                aria-label={t.title}
                title={t.title}
            >
                <History size={18} />
            </motion.button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="history-panel-premium"
                    >
                        <div className="flex items-center justify-between mb-4 px-1">
                            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <Clock size={14} className="text-indigo-500" />
                                {t.title}
                            </h3>
                            <button
                                onClick={() => setOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {selectedDate && (
                            <button
                                className="history-back-premium mb-4"
                                onClick={() => {
                                    onSelectDate(null);
                                    setOpen(false);
                                }}
                            >
                                <ChevronRight size={14} className="rotate-180" />
                                {t.back}
                            </button>
                        )}

                        <div className="history-scroll-area custom-scrollbar max-h-[320px] overflow-y-auto">
                            {loading ? (
                                <div className="flex flex-col gap-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />
                                    ))}
                                </div>
                            ) : dates.length === 0 ? (
                                <div className="py-8 text-center">
                                    <Calendar size={24} className="mx-auto text-gray-200 mb-2" />
                                    <p className="text-xs text-gray-400 font-medium">{t.empty}</p>
                                </div>
                            ) : (
                                <ul className="history-list-premium">
                                    {dates.map((entry) => {
                                        const isSelected = entry.date === selectedDate;
                                        const label = formatHistoryDate(entry.date, lang);
                                        const isMainToday = entry.date === todayStr;

                                        return (
                                            <li key={entry.date}>
                                                <button
                                                    className={`history-item-btn ${isSelected ? "selected" : ""}`}
                                                    onClick={() => {
                                                        onSelectDate(isMainToday ? null : entry.date);
                                                        setOpen(false);
                                                    }}
                                                >
                                                    <div className="history-item-left">
                                                        <span className="history-item-date">{label}</span>
                                                        <span className="history-item-meta">
                                                            {entry.total_kept} {t.articles} • {entry.total_collected} sources
                                                        </span>
                                                    </div>
                                                    <ChevronRight size={14} className={`history-item-arrow ${isSelected ? 'opacity-100' : 'opacity-0'} transition-opacity`} />
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
