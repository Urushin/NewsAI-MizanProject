"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, X, ShieldCheck, Zap, TrendingUp, Sparkles, ArrowLeft, Bookmark, Share2 } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { API } from "../context/AuthContext";

interface NewsItem {
    title: string;
    category: string;
    summary: string;
    score: number;
    link: string;
    keep: boolean;
    gate_passed?: string;
    reason?: string;
    credibility_score?: number;
}

const THEME = {
    glass: 'bg-white/95 backdrop-blur-md ring-1 ring-black/5',
};

// Trust Badge pour le modal
const TrustBadge = ({ score }: { score: number }) => (
    <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${score >= 7 ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
        <span className="text-[10px] font-medium tracking-widest uppercase text-gray-400">
            Trust Score: {score}/10
        </span>
    </div>
);

function digestToBullets(digest: string): string[] {
    return digest
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);
}

function sendFeedback(token: string | null, title: string, summary: string, action: "read" | "rejected") {
    if (!token) return;
    fetch(`${API}/api/feedback`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            article_title: title,
            article_summary: summary,
            action: action,
        }),
    }).catch(console.error);
}

export default function NewsCard({ item, index, token, onDismiss }: { item: NewsItem, index: number, token: string | null, onDismiss: (title: string) => void }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    const isImpact = item.gate_passed === "impact" || item.category === "Impact";
    const tag = isImpact ? "Impact Direct" : "Passion";
    const tagColor = isImpact ? "#EF4444" : "#6366F1";

    const bullets = digestToBullets(item.summary);

    // Fallback if no bullets
    const displayPoints = bullets.length > 0 ? bullets : [item.summary];

    const handleReject = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDismissed(true);
        sendFeedback(token, item.title, item.summary, "rejected");
        onDismiss(item.title);
        setIsExpanded(false);
    }, [token, item.title, item.summary, onDismiss]);

    if (isDismissed) return null;

    return (
        <>
            <motion.div
                onClick={() => {
                    sendFeedback(token, item.title, item.summary, "read");
                    setIsExpanded(true);
                }}
                className="group cursor-pointer py-10 first:pt-4 outline-none relative"
                whileHover={{ scale: 1.01 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
                <div className="space-y-4">
                    {/* Catégories plus discrètes : texte gris, petite puce de couleur */}
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full opacity-60" style={{ backgroundColor: tagColor }} />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">
                            {tag}
                        </span>
                        <span className="text-[10px] text-gray-300 uppercase tracking-widest">• Pertinence {item.score}</span>
                    </div>

                    {/* Taille de titre réduite pour plus de sobriété */}
                    <h2 className="text-xl sm:text-2xl font-bold leading-snug text-gray-900 group-hover:text-indigo-600 transition-all duration-300 tracking-tight">
                        {item.title}
                    </h2>

                    <ul className="space-y-3 max-w-2xl">
                        {displayPoints.slice(0, 3).map((point, index) => (
                            <li key={index} className="flex items-start gap-4">
                                <span className="mt-3 w-1.5 h-[2px] bg-gray-300 flex-shrink-0" />
                                <span className="text-gray-600 text-[15px] leading-relaxed font-medium">
                                    {point}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </motion.div>

            {/* Modal (Floating Glass) */}
            <AnimatePresence>
                {isExpanded && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6 md:p-12">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsExpanded(false)}
                            className="absolute inset-0 bg-white/40 backdrop-blur-sm"
                        />

                        <motion.div
                            layoutId={`modal-${item.title}`}
                            initial={{ opacity: 0, scale: 0.98, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98, y: 10 }}
                            className={`relative w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-2xl overflow-hidden sm:rounded-2xl shadow-2xl flex flex-col ${THEME.glass}`}
                        >
                            <div className="flex items-center justify-between p-5 border-b border-black/5 bg-white/50">
                                <button onClick={() => setIsExpanded(false)} className="p-2 hover:bg-black/5 rounded-full transition-colors text-gray-400 hover:text-black">
                                    <ArrowLeft size={20} />
                                </button>
                                <div className="flex gap-2">
                                    <a href={item.link} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-black/5 rounded-full text-gray-400 hover:text-indigo-600 transition-colors">
                                        <Share2 size={18} />
                                    </a>
                                    <button onClick={handleReject} className="p-2 hover:bg-black/5 rounded-full text-gray-400 hover:text-red-500 transition-colors">
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 sm:p-10 custom-scrollbar bg-white">
                                <div className="flex items-center gap-3 mb-6">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{tag}</span>
                                    <div className="ml-auto">
                                        <TrustBadge score={item.credibility_score || 8} />
                                    </div>
                                </div>

                                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight mb-8 text-gray-900">
                                    {item.title}
                                </h1>

                                <div className="prose prose-lg max-w-none text-gray-800 leading-[1.7] space-y-8">
                                    <div className="text-lg italic border-l-2 border-indigo-200 pl-6 py-1 text-gray-600 bg-indigo-50/30 rounded-r-xl">
                                        Points clés de l'analyse :
                                        <ul className="mt-4 space-y-3 not-italic text-[15px] text-gray-700 font-medium">
                                            {displayPoints.map((p, i) => (
                                                <li key={i} className="flex items-start gap-4">
                                                    <span className="mt-2.5 w-1 h-[2px] bg-indigo-300 flex-shrink-0" />
                                                    <span>{p}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {item.reason && (
                                        <div className="p-6 bg-gray-50 rounded-xl flex gap-4 text-sm font-medium text-gray-600">
                                            <Sparkles size={20} className="text-indigo-500 shrink-0" />
                                            <p>{item.reason}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-12 pt-8 border-t border-black/5 flex flex-col items-center opacity-50">
                                    <Zap size={16} className="text-indigo-500 mb-2" />
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold">
                                        Mizan Intelligence
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
