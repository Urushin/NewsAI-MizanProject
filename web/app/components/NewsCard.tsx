"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    Zap,
    Sparkles,
    ExternalLink,
    Lock,
    Share2
} from "lucide-react";
import { useState, useCallback, useEffect, useMemo } from "react";
import Image from "next/image";
import { useAuth } from "../context/AuthContext";
import { NewsItem } from "../types/news";
import { parseTitleAndSource, digestToBullets, extractDomain, formatSourceName } from "../utils/newsUtils";
import { useApi } from "../utils/api";

/* ── Feedback moved to API ── */
async function sendFeedback(
    api: ReturnType<typeof useApi>,
    title: string,
    summary: string | string[],
    action: "read" | "rejected"
) {
    const text = Array.isArray(summary) ? summary.join(" ") : summary;
    try {
        await api.post("/api/feedback", { article_title: title, article_summary: text, action });
    } catch (e) {
        console.error("Feedback failed", e);
    }
}

export default function NewsCard({
    item,
    index,
    variant = "default",
    onDismiss,
}: {
    item: NewsItem;
    index: number;
    variant?: "default" | "hero" | "compact";
    onDismiss: (title: string) => void;
}) {
    const api = useApi();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const [detailedAnalysis, setDetailedAnalysis] = useState<string | null>(null);
    const [isPremium, setIsPremium] = useState<boolean | null>(null);

    useEffect(() => {
        if (isExpanded && !detailedAnalysis) {
            const controller = new AbortController();

            api.post("/api/brief/analyze", { link: item.link, title: item.title, language: "fr" }, { signal: controller.signal })
                .then(data => {
                    if (data.status === "upgrade_required") {
                        setIsPremium(false);
                        setDetailedAnalysis(data.analysis);
                    } else if (data.status === "success") {
                        setIsPremium(true);
                        setDetailedAnalysis(data.analysis);
                    } else {
                        console.error("Analysis failed", data);
                    }
                })
                .catch(err => {
                    if (err.name !== 'AbortError') {
                        console.error("Analyze error:", err);
                    }
                });

            return () => controller.abort();
        }
    }, [isExpanded, detailedAnalysis, item.link, item.title, api]);

    const isImpact = item.gate_passed === "impact" || item.category === "Impact";
    const bullets = useMemo(() => digestToBullets(item.summary), [item.summary]);
    const displayPoints = bullets.length > 0 ? bullets : [typeof item.summary === "string" ? item.summary : ""];

    const handleReject = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            setIsDismissed(true);
            sendFeedback(api, item.title, item.summary, "rejected");
            onDismiss(item.title);
            setIsExpanded(false);
        },
        [api, item.title, item.summary, onDismiss]
    );

    const { title: finalTitle, sourceName: finalSourceName, domain: sourceDomain } = useMemo(() => {
        return parseTitleAndSource(item.localized_title || item.title, item.link, item.source_name);
    }, [item]);

    if (isDismissed) return null;

    const isHero = variant === "hero";
    const isCompact = variant === "compact";

    return (
        <>
            <motion.article
                onClick={() => {
                    sendFeedback(api, item.title, item.summary, "read");
                    setIsExpanded(true);
                }}
                className={`
                    group transition-all duration-300 relative cursor-pointer
                    ${isHero
                        ? "col-span-full py-8 sm:py-10 mb-8"
                        : isCompact
                            ? "py-5 flex flex-col h-full"
                            : "flex gap-4 py-5 sm:py-6 mb-4"
                    }
                `}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
            >
                <div className={`flex ${isCompact ? "flex-col h-full" : "flex-row gap-6 items-start"}`}>
                    <div className="flex-1 min-w-0 flex flex-col">
                        {isHero && (
                            <div className="flex items-center gap-3 mb-4">
                                <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest shadow-lg shadow-indigo-100">UNE</span>
                                <div className="flex items-center gap-1.5 opacity-60">
                                    <div className={`w-1.5 h-1.5 rounded-full ${(item.credibility_score || 5) >= 7 ? "bg-emerald-500" : "bg-orange-500"}`} aria-hidden="true" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{finalSourceName}</span>
                                </div>
                            </div>
                        )}

                        <h3 className={`
                            font-bold leading-[1.25] text-gray-900 tracking-tight group-hover:text-indigo-600 transition-colors duration-300
                            ${isHero ? "text-[22px] sm:text-[28px] mb-4" : isCompact ? "text-[16px] mb-3 line-clamp-3" : "text-[17px] sm:text-[19px] mb-3"}
                        `}>
                            {finalTitle}
                        </h3>

                        <ul className="flex flex-col gap-2.5">
                            {displayPoints.slice(0, isHero ? 4 : isCompact ? 2 : 3).map((point, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <span className="mt-[10px] w-2 h-[1.5px] bg-indigo-200 shrink-0 rounded-sm" aria-hidden="true" />
                                    <span className={`
                                        leading-[1.7] text-gray-500 font-[450]
                                        ${isHero ? "text-[15px] sm:text-[16px]" : "text-[13px] sm:text-[14px]"}
                                        ${isCompact ? "line-clamp-2" : ""}
                                    `}>
                                        {point}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        <div className={`flex items-center gap-3 mt-auto pt-4 ${isCompact ? "justify-between" : ""}`}>
                            {item.source_names && item.source_names.length > 1 ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest whitespace-nowrap">Synthesis •</span>
                                    <span className="text-[11px] text-gray-400 font-medium line-clamp-1">
                                        Vu dans {item.source_names.slice(0, 3).join(", ")}{item.source_names.length > 3 ? "..." : ""}
                                    </span>
                                </div>
                            ) : (
                                <>
                                    {item.sources_count && item.sources_count > 1 && (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 text-gray-500 text-[10px] font-bold rounded-full border border-black/[0.03]">
                                            🔗 {item.sources_count} sources
                                        </span>
                                    )}
                                    {isCompact && (
                                        <div className="flex items-center gap-1.5 opacity-40 grayscale group-hover:grayscale-0 transition-all">
                                            <div className="relative w-3.5 h-3.5 shrink-0">
                                                <Image
                                                    src={`https://www.google.com/s2/favicons?sz=32&domain=${sourceDomain}`}
                                                    fill
                                                    className="object-contain rounded-sm"
                                                    alt={finalSourceName}
                                                />
                                            </div>
                                            <span className="text-[10px] font-bold truncate max-w-[80px]">{finalSourceName}</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {isHero && (
                        <div className="hidden md:flex items-start justify-end pr-0 pl-10 pt-2 min-w-[240px] max-w-[280px]">
                            <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden bg-gray-50/50 border border-gray-100/50 group/img shadow-sm md:-mr-8">
                                <Image
                                    src={item.image_url || `https://v1.screenshot.11ty.dev/${encodeURIComponent(item.link)}/large/`}
                                    fill
                                    className="object-cover transition-transform duration-700 group-hover/img:scale-110"
                                    alt={finalTitle}
                                    sizes="(max-width: 768px) 100vw, 280px"
                                    priority={index < 2}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" aria-hidden="true" />
                            </div>
                        </div>
                    )}
                </div>
            </motion.article>

            <AnimatePresence>
                {isExpanded && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6 md:p-10">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsExpanded(false)}
                            className="absolute inset-0 bg-gray-900/40"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98, y: 12 }}
                            transition={{ type: "spring", damping: 30, stiffness: 350 }}
                            className="relative w-full h-full sm:h-auto sm:max-h-[82vh] sm:max-w-2xl overflow-hidden sm:rounded-[32px] bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] flex flex-col"
                        >
                            <div className="absolute top-5 right-5 sm:top-6 sm:right-7 flex items-center gap-2 z-[110]">
                                <button
                                    onClick={() => {
                                        if (navigator.share) {
                                            navigator.share({ title: finalTitle, url: item.link });
                                        } else {
                                            navigator.clipboard.writeText(item.link);
                                        }
                                    }}
                                    className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-50/80 backdrop-blur-md text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-black/[0.03]"
                                >
                                    <Share2 size={18} aria-hidden="true" />
                                </button>
                                <button
                                    onClick={() => setIsExpanded(false)}
                                    className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-900 text-white hover:bg-black transition-all shadow-lg"
                                >
                                    <X size={20} aria-hidden="true" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 pt-12 pb-10 sm:px-12 sm:pt-16 sm:pb-14 custom-scrollbar flex flex-col">
                                <div className="flex items-center gap-4 mb-6">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.05em] shadow-sm ${isImpact ? "bg-red-50 text-red-500" : "bg-indigo-50 text-indigo-500"}`}>
                                        {isImpact ? "Impact Direct" : item.category || "Passion"}
                                    </span>
                                    <div className="flex items-center gap-2 px-2 py-0.5 border-l border-gray-100 pl-3">
                                        <div className={`w-2 h-2 rounded-full ${(item.credibility_score || 5) >= 7 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.3)]"}`} aria-hidden="true" />
                                        <span className="text-[11px] font-bold text-gray-400">
                                            Score Fiabilité : {(item.credibility_score || 5)}/10
                                        </span>
                                    </div>
                                </div>

                                <h1 className="text-2xl sm:text-3xl font-[850] tracking-tight leading-[1.15] text-gray-900 mb-4 pr-12">
                                    {finalTitle}
                                </h1>

                                <div className="flex items-center gap-3 mb-10">
                                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center border border-black/[0.04] relative">
                                        <Image
                                            src={`https://www.google.com/s2/favicons?sz=64&domain=${sourceDomain}`}
                                            fill
                                            className="object-contain p-1.5"
                                            alt={finalSourceName}
                                            unoptimized
                                        />
                                    </div>
                                    <p className="text-[14px] text-gray-500 font-medium tracking-tight">
                                        Publié par <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:text-indigo-600 transition-colors font-bold">{finalSourceName}</a>
                                    </p>
                                </div>

                                <div className="relative mb-8">
                                    <div className="flex items-center gap-2 mb-5">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-100">
                                            <Sparkles size={14} className="text-white" aria-hidden="true" />
                                        </div>
                                        <h3 className="text-[12px] font-[900] uppercase tracking-[0.1em] text-gray-900">Analyse Intelligence Mizan</h3>
                                    </div>

                                    {!detailedAnalysis ? (
                                        <div className="space-y-4 animate-pulse">
                                            <div className="h-4 bg-gray-50 rounded-full w-full"></div>
                                            <div className="h-4 bg-gray-50 rounded-full w-[94%]"></div>
                                            <div className="h-4 bg-gray-50 rounded-full w-[88%]"></div>
                                            <div className="h-4 bg-gray-50 rounded-full w-[30%]"></div>
                                        </div>
                                    ) : (
                                        <div className="relative group">
                                            <div className={`text-[16px] sm:text-[17px] leading-[1.7] text-gray-700 font-[450] whitespace-pre-wrap transition-all duration-700 ${isPremium === false ? "blur-[7px] select-none opacity-40 max-h-[160px] overflow-hidden" : ""}`}>
                                                {detailedAnalysis}
                                            </div>

                                            {isPremium === false && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-white/10">
                                                    <div className="p-8 bg-white/95 backdrop-blur-xl rounded-[28px] shadow-2xl border border-black/[0.03] max-w-sm hover:scale-[1.02] transition-transform duration-500">
                                                        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-200 mb-6 mx-auto text-white rotate-3">
                                                            <Lock size={24} aria-hidden="true" />
                                                        </div>
                                                        <h4 className="text-[19px] font-[850] text-gray-900 mb-2 leading-tight px-4">Analyse Réservée aux Membres Pro</h4>
                                                        <p className="text-[14px] text-gray-600 font-medium mb-7 leading-relaxed px-2">
                                                            Débloquez le décryptage complet de l&apos;IA, la synthèse multi-sources et les enjeux cachés.
                                                        </p>
                                                        <button className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[15px] font-[800] shadow-xl shadow-indigo-200/60 hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2 group">
                                                            Passer au Plan Pro
                                                            <Zap size={16} className="fill-white group-hover:scale-125 transition-transform" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {item.sources_count && item.sources_count > 1 && item.source_urls && (
                                    <div className="mt-6 flex flex-col gap-4">
                                        <div className="flex items-center gap-2">
                                            <Zap size={14} className="text-gray-400" aria-hidden="true" />
                                            <p className="text-[11px] font-[800] uppercase tracking-widest text-gray-400">
                                                Synthèse Multi-Sources ({item.sources_count})
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {item.source_urls.map((url, i) => {
                                                const d = extractDomain(url);
                                                const sName = formatSourceName(d, item.source_names?.[i]);
                                                return (
                                                    <a
                                                        key={i}
                                                        href={url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-4 py-2 bg-white border border-gray-100 rounded-full text-[12px] font-bold text-gray-600 hover:border-indigo-200 hover:bg-indigo-50/20 hover:text-indigo-600 transition-all flex items-center gap-2 active:scale-95"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <div className="relative w-3.5 h-3.5 shrink-0" aria-hidden="true">
                                                            <Image
                                                                src={`https://www.google.com/s2/favicons?size=32&domain=${d}`}
                                                                fill
                                                                className="object-contain"
                                                                alt={sName}
                                                                unoptimized
                                                            />
                                                        </div>
                                                        {sName}
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-12 flex flex-col sm:flex-row gap-3">
                                    <a
                                        href={item.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 flex items-center justify-center gap-2 py-4 px-6 bg-gray-900 border border-gray-900 text-white rounded-2xl text-[15px] font-bold hover:bg-black transition-all active:scale-[0.98]"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        Accéder à l&apos;Article Original
                                        <ExternalLink size={16} aria-hidden="true" />
                                    </a>
                                    <button
                                        onClick={handleReject}
                                        className="py-4 px-6 bg-white border border-red-100 text-red-500 rounded-2xl text-[15px] font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2 group"
                                    >
                                        <X size={20} className="group-hover:rotate-90 transition-transform" aria-hidden="true" />
                                        Rejeter
                                    </button>
                                </div>
                            </div>

                            <div className="px-10 py-5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between mt-auto">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" aria-hidden="true" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                        Mizan Intelligence • Signal 021-X
                                    </span>
                                </div>
                                <span className="text-[10px] font-medium text-gray-300">
                                    © {new Date().getFullYear()} Mizan.ai
                                </span>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
