"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Sparkles, TrendingUp, Zap } from "lucide-react";
import { useState } from "react";

interface NewsItem {
    title: string;
    category: string;
    summary: string;
    score: number;
    link: string;
}

// Couleurs par catégorie (Apple-style)
const categoryConfig: Record<string, { color: string; icon: string }> = {
    "Investissement & Crypto": { color: "var(--cat-crypto)", icon: "₿" },
    "Tech & IA": { color: "var(--cat-tech)", icon: "⚡" },
    "Culture & Manga": { color: "var(--cat-manga)", icon: "🎮" },
    "Sport & Combat": { color: "var(--cat-sport)", icon: "🥊" },
    "Politique & Monde": { color: "var(--cat-politique)", icon: "🌍" },
    "Niche": { color: "var(--cat-niche)", icon: "◆" },
};

function getScoreColor(score: number): string {
    if (score >= 90) return "#34C759";  // Green
    if (score >= 80) return "#007AFF";  // Blue
    if (score >= 70) return "#FF9500";  // Orange
    return "#8E8E93";                   // Gray
}

export default function NewsCard({ item, index }: { item: NewsItem; index: number }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const catConfig = categoryConfig[item.category] || categoryConfig["Niche"];
    const scoreColor = getScoreColor(item.score);

    return (
        <motion.article
            layout
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
                duration: 0.5,
                delay: index * 0.08,
                ease: [0.25, 0.46, 0.45, 0.94], // Apple ease-out
            }}
            whileTap={{ scale: 0.98 }}
            className="rounded-2xl p-5 mb-3 cursor-pointer select-none"
            style={{
                backgroundColor: "var(--card)",
                boxShadow: "var(--shadow-card)",
                minHeight: "44px",  // Apple HIG minimum touch target
                WebkitTapHighlightColor: "transparent",
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

                {item.score >= 90 && (
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

            {/* Score Bar (toujours visible) */}
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
                                    minHeight: "44px",     // Apple HIG touch target
                                    minWidth: "44px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "flex-end",
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                Source <ChevronRight size={14} />
                            </a>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.article>
    );
}
