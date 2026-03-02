"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, X, Shield, Flame, Zap, TrendingUp } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

import { API } from "../context/AuthContext";

export interface NewsItem {
    title: string;
    category: string;
    summary: string;
    score: number;
    link: string;
    gate_passed?: string;
    reason?: string;
    credibility_score?: number;
}

function getCredibilityColor(score: number): string {
    if (score >= 8) return "#22c55e";
    if (score >= 6) return "#fbbf24";
    if (score >= 4) return "#f97316";
    return "#ef4444";
}

function getCredibilityLabel(score: number): string {
    if (score >= 8) return "Très fiable";
    if (score >= 6) return "Fiable";
    if (score >= 4) return "Modéré";
    return "À vérifier";
}

function getScoreGradient(score: number): string {
    if (score >= 80) return "linear-gradient(90deg, #22c55e, #16a34a)";
    if (score >= 60) return "linear-gradient(90deg, #fbbf24, #f59e0b)";
    return "linear-gradient(90deg, #f97316, #ea580c)";
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

    const isImpact = item.category === "Impact" || item.gate_passed === "impact";

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

    const credScore = item.credibility_score ?? 0;
    const credColor = getCredibilityColor(credScore);
    const credLabel = getCredibilityLabel(credScore);
    const credPercent = (credScore / 10) * 100;

    return (
        <motion.article
            layout="position"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, overflow: "hidden" }}
            transition={{
                duration: 0.4,
                delay: index * 0.06,
                ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className="group block relative cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
                background: "var(--bg-card)",
                border: `1px solid ${isExpanded ? "var(--border-glow)" : "var(--border-subtle)"}`,
                borderRadius: "16px",
                padding: "24px",
                marginBottom: "16px",
                boxShadow: isExpanded ? "var(--shadow-card-hover)" : "var(--shadow-card)",
                transition: "border-color 0.3s, box-shadow 0.3s, transform 0.2s",
            }}
            whileHover={{
                y: -2,
                transition: { duration: 0.2 },
            }}
        >
            {/* ── Top: Category Pill + Credibility ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                {/* Category Pill */}
                <span
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 12px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: 600,
                        letterSpacing: "0.03em",
                        textTransform: "uppercase",
                        background: isImpact ? "var(--accent-red-muted)" : "var(--accent-blue-glow)",
                        color: isImpact ? "var(--accent-red)" : "var(--accent-blue)",
                        border: `1px solid ${isImpact ? "rgba(239,68,68,0.2)" : "rgba(59,130,246,0.2)"}`,
                    }}
                >
                    {isImpact ? <Zap size={12} /> : <TrendingUp size={12} />}
                    {isImpact ? "Impact Direct" : "Passion"}
                </span>

                {/* Credibility Badge */}
                {item.credibility_score !== undefined && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Shield size={14} style={{ color: credColor, opacity: 0.8 }} />
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px" }}>
                            <span style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: credColor,
                                letterSpacing: "0.02em",
                            }}>
                                {credLabel} {credScore}/10
                            </span>
                            {/* Progress bar */}
                            <div style={{
                                width: "80px",
                                height: "3px",
                                borderRadius: "2px",
                                background: "rgba(255,255,255,0.06)",
                                overflow: "hidden",
                            }}>
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${credPercent}%` }}
                                    transition={{ duration: 0.8, delay: index * 0.06 + 0.3, ease: "easeOut" }}
                                    style={{
                                        height: "100%",
                                        borderRadius: "2px",
                                        background: credColor,
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Title ── */}
            <h3
                style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "20px",
                    fontWeight: 600,
                    lineHeight: 1.35,
                    color: "var(--text-primary)",
                    marginBottom: "10px",
                    letterSpacing: "-0.01em",
                }}
            >
                {item.title}
            </h3>

            {/* ── Summary ── */}
            <p
                style={{
                    fontSize: "14.5px",
                    lineHeight: 1.7,
                    color: "var(--text-secondary)",
                    maxWidth: "600px",
                }}
            >
                {item.summary}
            </p>

            {/* ── Expanded Content ── */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        style={{ overflow: "hidden" }}
                    >
                        <div style={{
                            marginTop: "16px",
                            paddingTop: "16px",
                            borderTop: "1px solid var(--border-subtle)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}>
                            {/* Relevance score pill */}
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                            }}>
                                <Flame size={14} style={{ color: "var(--accent-amber)", opacity: 0.7 }} />
                                <span style={{
                                    fontSize: "12px",
                                    color: "var(--text-muted)",
                                    fontWeight: 500,
                                }}>
                                    Pertinence : {item.score}
                                </span>
                                <div style={{
                                    width: "60px",
                                    height: "3px",
                                    borderRadius: "2px",
                                    background: "rgba(255,255,255,0.06)",
                                    overflow: "hidden",
                                }}>
                                    <div style={{
                                        height: "100%",
                                        width: `${item.score}%`,
                                        borderRadius: "2px",
                                        background: getScoreGradient(item.score),
                                    }} />
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                                <a
                                    href={item.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                        fontSize: "13px",
                                        fontWeight: 500,
                                        color: "var(--accent-amber)",
                                        textDecoration: "none",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        transition: "opacity 0.2s",
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                                >
                                    Lire la source <ChevronRight size={14} />
                                </a>
                                <button
                                    onClick={handleReject}
                                    style={{
                                        fontSize: "13px",
                                        fontWeight: 500,
                                        color: "var(--text-muted)",
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        padding: 0,
                                        fontFamily: "var(--font-body)",
                                        transition: "color 0.2s",
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-red)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                                >
                                    <X size={14} /> Ignorer
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.article>
    );
}
