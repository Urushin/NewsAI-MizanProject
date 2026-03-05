"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    Zap,
    Sparkles,
    ArrowLeft,
    ExternalLink,
} from "lucide-react";
import { useState, useCallback } from "react";
import { API } from "../context/AuthContext";

interface NewsItem {
    title: string;
    category: string;
    summary: string | string[];
    score: number;
    link: string;
    keep: boolean;
    gate_passed?: string;
    reason?: string;
    credibility_score?: number;
    localized_title?: string;
    sources_count?: number;
    source_urls?: string[];
}

/* ── Summary parser ────────────────────────────────── */

function digestToBullets(summary: string | string[]): string[] {
    if (Array.isArray(summary)) {
        return summary.map((s) => s.trim()).filter((s) => s.length > 5);
    }
    return summary
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);
}

/* ── Feedback ──────────────────────────────────────── */

function sendFeedback(
    token: string | null,
    title: string,
    summary: string | string[],
    action: "read" | "rejected"
) {
    if (!token) return;
    const text = Array.isArray(summary) ? summary.join(" ") : summary;
    fetch(`${API}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ article_title: title, article_summary: text, action }),
    }).catch(console.error);
}


/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */

export default function NewsCard({
    item,
    index,
    token,
    onDismiss,
}: {
    item: NewsItem;
    index: number;
    token: string | null;
    onDismiss: (title: string) => void;
}) {
    const displayTitle = item.localized_title || item.title;
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    const isImpact = item.gate_passed === "impact" || item.category === "Impact";
    const bullets = digestToBullets(item.summary);
    const displayPoints = bullets.length > 0 ? bullets : [typeof item.summary === "string" ? item.summary : ""];

    const handleReject = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            setIsDismissed(true);
            sendFeedback(token, item.title, item.summary, "rejected");
            onDismiss(item.title);
            setIsExpanded(false);
        },
        [token, item.title, item.summary, onDismiss]
    );

    // Extract source domain
    const sourceDomain = (() => {
        try { return new URL(item.link).hostname.replace("www.", ""); } catch { return ""; }
    })();

    if (isDismissed) return null;

    return (
        <>
            {/* ── CARD ──────────────────────────────────────── */}
            <motion.article
                onClick={() => {
                    sendFeedback(token, item.title, item.summary, "read");
                    setIsExpanded(true);
                }}
                className="group flex gap-4 py-5 sm:py-6 cursor-pointer transition-all duration-200 relative"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
            >

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col gap-3 sm:gap-4">
                    {/* Title */}
                    <h3 className="text-[17px] sm:text-[19px] font-bold leading-snug text-gray-900 tracking-tight group-hover:text-indigo-600 transition-colors duration-200">
                        {displayTitle}
                    </h3>

                    {/* Summary bullets */}
                    <ul className="flex flex-col gap-2.5">
                        {displayPoints.slice(0, 3).map((point, i) => (
                            <li key={i} className="flex items-start gap-3">
                                <span className="mt-[10px] w-2 h-[1.5px] bg-gray-300 shrink-0 rounded-sm" />
                                <span className="text-[14px] sm:text-[15px] leading-[1.8] text-gray-500 font-[440]">
                                    {point}
                                </span>
                            </li>
                        ))}
                    </ul>

                    {/* Multi-source badge */}
                    {item.sources_count && item.sources_count > 1 && (
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[11px] font-semibold rounded-full">
                                🔗 Synthèse de {item.sources_count} sources
                            </span>
                        </div>
                    )}

                </div>
            </motion.article>

            {/* ── MODAL ─────────────────────────────────────── */}
            <AnimatePresence>
                {isExpanded && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6 md:p-10">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsExpanded(false)}
                            className="absolute inset-0 bg-gray-900/40"
                        />

                        {/* Panel */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 30 }}
                            transition={{ ease: "easeOut", duration: 0.25 }}
                            style={{ willChange: "transform, opacity" }}
                            className="relative w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-2xl overflow-hidden sm:rounded-2xl bg-white shadow-2xl flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.04] bg-white/95 shrink-0">
                                <button
                                    onClick={() => setIsExpanded(false)}
                                    className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-all"
                                >
                                    <ArrowLeft size={20} />
                                </button>
                                <div className="flex gap-1">
                                    <a
                                        href={item.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-indigo-600 transition-all no-underline"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <ExternalLink size={18} />
                                    </a>
                                    <button
                                        onClick={handleReject}
                                        className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-1 overflow-y-auto p-6 sm:p-10 custom-scrollbar flex flex-col gap-6 sm:gap-8">
                                {/* Category + Trust */}
                                <div className="flex items-center justify-between">
                                    <span className={`text-[11px] font-bold uppercase tracking-wide ${isImpact ? "text-red-500" : "text-indigo-500"}`}>
                                        {isImpact ? "Impact Direct" : item.category || "Passion"}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-1.5 h-1.5 rounded-full ${(item.credibility_score || 5) >= 7 ? "bg-emerald-400" : "bg-amber-400"}`} />
                                        <span className="text-[10px] font-semibold text-gray-400 tracking-wide">
                                            Trust {item.credibility_score || 5}/10
                                        </span>
                                    </div>
                                </div>

                                {/* Title */}
                                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-snug text-gray-900">
                                    {displayTitle}
                                </h1>

                                {/* Source */}
                                {sourceDomain && (
                                    <p className="text-[13px] text-gray-400">
                                        Source : <span className="text-gray-500 font-medium">{sourceDomain}</span>
                                    </p>
                                )}

                                {/* Key Points */}
                                <div className="p-5 sm:p-6 bg-[#FAFAFA] rounded-2xl border border-black/[0.04]">
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-4">
                                        Points clés de l&apos;analyse
                                    </p>
                                    <ul className="flex flex-col gap-4">
                                        {displayPoints.map((p, i) => (
                                            <li key={i} className="flex items-start gap-3.5">
                                                <span className="mt-[11px] w-3 h-[2px] bg-indigo-300 opacity-60 shrink-0 rounded-sm" />
                                                <span className="text-[14px] sm:text-[15px] leading-relaxed text-gray-600 font-[450]">{p}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Reason */}
                                {item.reason && (
                                    <div className="flex gap-4 p-5 bg-violet-50/60 rounded-2xl border border-violet-100/50">
                                        <Sparkles size={18} className="text-indigo-500 shrink-0 mt-0.5" />
                                        <p className="text-[14px] text-gray-600 font-medium leading-relaxed">{item.reason}</p>
                                    </div>
                                )}

                                {/* Sources list (Chimera fusion) */}
                                {item.sources_count && item.sources_count > 1 && item.source_urls && (
                                    <div className="p-4 sm:p-5 bg-gray-50 rounded-2xl border border-black/[0.04]">
                                        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-3">
                                            Sources ({item.sources_count})
                                        </p>
                                        <ul className="flex flex-col gap-2">
                                            {item.source_urls.map((url, i) => {
                                                let domain = "";
                                                try { domain = new URL(url).hostname.replace("www.", ""); } catch { }
                                                return (
                                                    <li key={i}>
                                                        <a
                                                            href={url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-[13px] text-indigo-500 hover:text-indigo-700 font-medium no-underline hover:underline transition-colors"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {domain || url}
                                                        </a>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}

                                {/* CTA */}
                                <a
                                    href={item.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 self-start px-5 py-3 bg-gray-900 text-white rounded-xl text-[14px] font-semibold no-underline hover:opacity-90 active:scale-[0.98] transition-all"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    Lire l&apos;article original
                                    <ExternalLink size={14} />
                                </a>

                                {/* Footer */}
                                <div className="flex items-center justify-center gap-2 pt-6 border-t border-black/[0.04] mt-2 opacity-40">
                                    <Zap size={14} className="text-indigo-500" />
                                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">
                                        Mizan Intelligence
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
