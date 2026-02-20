"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Zap, X } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

const API = "http://localhost:8000";

interface NewsItem {
    title: string;
    category: string;
    summary: string;
    score: number;
    link: string;
    gate_passed?: string;
    reason?: string;
}

const categoryConfig: Record<string, { color: string; icon: string }> = {
    "Tech & Science": { color: "var(--cat-tech, #007AFF)", icon: "⚡" },
    "Finance & Business": { color: "var(--cat-crypto, #FF9500)", icon: "₿" },
    "Politique & Monde": { color: "var(--cat-politique, #FF3B30)", icon: "🌍" },
    "Culture & Divertissement": { color: "var(--cat-manga, #AF52DE)", icon: "🎮" },
    "Lifestyle & Sport": { color: "var(--cat-sport, #34C759)", icon: "🥊" },
    "Société & Environnement": { color: "var(--cat-niche, #5AC8FA)", icon: "🌿" },
};

function getScoreColor(score: number): string {
    if (score >= 90) return "#34C759";
    if (score >= 80) return "#007AFF";
    if (score >= 70) return "#FF9500";
    return "#8E8E93";
}

function sendFeedback(token: string | null, title: string, summary: string, action: "read" | "rejected") {
    if (!token) return;
    fetch(`${API}/api/feedback`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ article_title: title, article_summary: summary, action }),
    }).catch(() => { }); // Fire-and-forget
}

export default function NewsCard({
    item,
    index,
    token,
    onDismiss,
}: {
    item: NewsItem;
    index: number;
    token?: string | null;
    onDismiss?: (title: string) => void;
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const readTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasSentReadRef = useRef(false);
    const catConfig = categoryConfig[item.category] || { color: "var(--cat-niche, #8E8E93)", icon: "◆" };
    const scoreColor = getScoreColor(item.score);
    const isImpact = item.gate_passed === "impact";

    // ── Read Timer: 8s while expanded ──
    useEffect(() => {
        if (isExpanded && !hasSentReadRef.current) {
            readTimerRef.current = setTimeout(() => {
                sendFeedback(token || null, item.title, item.summary, "read");
                hasSentReadRef.current = true;
            }, 8000);
        } else if (!isExpanded && readTimerRef.current) {
            clearTimeout(readTimerRef.current);
            readTimerRef.current = null;
        }
        return () => {
            if (readTimerRef.current) clearTimeout(readTimerRef.current);
        };
    }, [isExpanded, token, item.title, item.summary]);

    const handleReject = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            sendFeedback(token || null, item.title, item.summary, "rejected");
            setIsDismissed(true);
            onDismiss?.(item.title);
        },
        [token, item.title, item.summary, onDismiss]
    );

    if (isDismissed) return null;

    return (
        <motion.article
            layout
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -80, scale: 0.95 }}
            transition={{
                duration: 0.5,
                delay: index * 0.08,
                ease: [0.25, 0.46, 0.45, 0.94],
            }}
            whileTap={{ scale: 0.98 }}
            className="rounded-2xl p-5 mb-3 cursor-pointer select-none relative"
            style={{
                backgroundColor: "var(--card)",
                boxShadow: "var(--shadow-card)",
                minHeight: "44px",
                WebkitTapHighlightColor: "transparent",
                borderLeft: isImpact ? "3px solid #FF3B30" : "none",
            }}
            onClick={() => setIsExpanded(!isExpanded)}
        >
            {/* Category + Score Badge */}
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-1.5">
                    <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: catConfig.color }}
                    />
                    <span
                        className="text-[10px] uppercase tracking-[0.12em] font-semibold"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        {item.category}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {isImpact && (
                        <motion.span
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "#FF3B3020", color: "#FF3B30" }}
                        >
                            ⚠️ IMPACT
                        </motion.span>
                    )}
                    {item.score >= 90 && !isImpact && (
                        <motion.span
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 15, delay: index * 0.08 + 0.3 }}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                            style={{
                                backgroundColor: "var(--accent-soft)",
                                color: "var(--accent)",
                            }}
                        >
                            <Zap size={9} /> ESSENTIEL
                        </motion.span>
                    )}
                </div>
            </div>

            {/* Title */}
            <h3
                className="text-[17px] font-semibold leading-snug mb-2 tracking-[-0.01em]"
                style={{ color: "var(--text-primary)" }}
            >
                {item.title}
            </h3>

            {/* Summary */}
            <p
                className="text-[15px] leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
            >
                {item.summary}
            </p>

            {/* Score Bar */}
            <div className="mt-3">
                <div className="score-bar">
                    <motion.div
                        className="score-bar-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${item.score}%` }}
                        transition={{ duration: 0.8, delay: index * 0.08 + 0.2, ease: [0.16, 1, 0.3, 1] }}
                        style={{ backgroundColor: scoreColor }}
                    />
                </div>
            </div>

            {/* Expanded Footer */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="overflow-hidden"
                    >
                        <div
                            className="pt-3 mt-3 flex justify-between items-center"
                            style={{ borderTop: "1px solid var(--separator)" }}
                        >
                            {/* Reject Button */}
                            <button
                                onClick={handleReject}
                                className="text-xs font-medium flex items-center gap-1 px-3 py-1.5 rounded-full transition-colors"
                                style={{
                                    backgroundColor: "var(--bg-secondary, #f5f5f5)",
                                    color: "var(--text-secondary)",
                                    border: "none",
                                    cursor: "pointer",
                                    minHeight: "32px",
                                }}
                            >
                                <X size={12} /> Pas intéressé
                            </button>

                            <div className="flex items-center gap-3">
                                <span
                                    className="text-xs font-medium tabular-nums"
                                    style={{ color: scoreColor }}
                                >
                                    Score {item.score}/100
                                </span>
                                <a
                                    href={item.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium flex items-center gap-1 no-underline"
                                    style={{
                                        color: "var(--accent)",
                                        minHeight: "44px",
                                        display: "flex",
                                        alignItems: "center",
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    Source <ChevronRight size={14} />
                                </a>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.article>
    );
}
