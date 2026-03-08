"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useAuth, API } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { History, Calendar, ChevronRight, X, Clock } from "lucide-react";

import { useApi } from "../utils/api";

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
    const api = useApi();
    const [open, setOpen] = useState(false);
    const [dates, setDates] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const t = i18n[lang] || i18n.en;

    useEffect(() => {
        if (!open || !token) return;
        setLoading(true);
        api.get("/api/brief/history")
            .then((data: { dates: HistoryEntry[] }) => {
                setDates(data.dates || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));

        if (panelRef.current) {
            panelRef.current.focus();
        }
    }, [open, token, api]);

    const todayStr = new Date().toISOString().slice(0, 10);

    const formattedEntries = useMemo(() => {
        return dates.map(entry => ({
            ...entry,
            label: formatHistoryDate(entry.date, lang),
            isSelected: entry.date === selectedDate,
            isMainToday: entry.date === todayStr
        }));
    }, [dates, lang, selectedDate, todayStr]);

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
                <History size={18} aria-hidden="true" />
            </motion.button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-[2px] pointer-events-auto"
                        onClick={() => setOpen(false)}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="history-panel-premium z-[110]"
                        ref={panelRef}
                        tabIndex={-1}
                    >
                        <div className="flex items-center justify-between mb-4 px-1">
                            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <Clock size={14} className="text-indigo-500" aria-hidden="true" />
                                {t.title}
                            </h3>
                            <button
                                onClick={() => setOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={16} aria-hidden="true" />
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
                                <ChevronRight size={14} className="rotate-180" aria-hidden="true" />
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
                                    <Calendar size={24} className="mx-auto text-gray-200 mb-2" aria-hidden="true" />
                                    <p className="text-xs text-gray-400 font-medium">{t.empty}</p>
                                </div>
                            ) : (
                                <ul className="history-list-premium">
                                    {formattedEntries.map((entry) => {
                                        return (
                                            <li key={entry.date}>
                                                <button
                                                    className={`history-item-btn ${entry.isSelected ? "selected" : ""}`}
                                                    onClick={() => {
                                                        onSelectDate(entry.isMainToday ? null : entry.date);
                                                        setOpen(false);
                                                    }}
                                                >
                                                    <div className="history-item-left">
                                                        <span className="history-item-date">{entry.label}</span>
                                                        <span className="history-item-meta">
                                                            {entry.total_kept} {t.articles} • {entry.total_collected} sources
                                                        </span>
                                                    </div>
                                                    <ChevronRight size={14} className={`history-item-arrow ${entry.isSelected ? 'opacity-100' : 'opacity-0'} transition-opacity`} aria-hidden="true" />
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
