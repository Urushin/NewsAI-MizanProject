"use client";

import { motion } from "framer-motion";
import { useState, useCallback, useEffect, useMemo } from "react";

import { NewsItem } from "../types/news";
import { parseTitleAndSource, digestToBullets } from "../utils/newsUtils";
import { useApi } from "../utils/api";
import NewsDetailModal from "./NewsDetailModal";
import SafeImage from "./SafeImage";
import { TIER_KEYS } from "../config/categories";
import { ImpactStyle } from "@capacitor/haptics";
import { triggerHaptic as triggerHapticUtil } from "../utils/haptics";

const TIER_VALUES = Object.values(TIER_KEYS);

interface NewsCardProps {
    item: NewsItem;
    index: number;
    variant?: "default" | "hero" | "compact";
    onDismiss: (title: string) => void;
}

export default function NewsCard({
    item,
    index,
    variant = "default",
    onDismiss,
}: NewsCardProps) {
    const api = useApi();

    const [isExpanded, setIsExpanded] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const [detailedAnalysis, setDetailedAnalysis] = useState<string | null>(null);
    const [highlights, setHighlights] = useState<string[]>([]);
    const [citations, setCitations] = useState<Record<string, string>>({});
    const [isPremium, setIsPremium] = useState<boolean | null>(null);
    const [auditScores, setAuditScores] = useState<Record<string, { score: number; reason: string }>>({});
    const [auditReasons, setAuditReasons] = useState<string[]>([]);
    const [reliabilityVerdict, setReliabilityVerdict] = useState<Record<string, unknown> | null>(null);

    const triggerHaptic = async (style = ImpactStyle.Light) => {
        if (style === ImpactStyle.Heavy) {
            await triggerHapticUtil.success();
        } else if (style === ImpactStyle.Medium) {
            await triggerHapticUtil.medium();
        } else {
            await triggerHapticUtil.light();
        }
    };

    // Fetch deep analysis when expanded
    useEffect(() => {
        if (isExpanded && !detailedAnalysis) {
            const controller = new AbortController();
            
            // Recompute bullets safely for the prompt
            const bullets = item.summary ? (Array.isArray(item.summary) ? item.summary : [item.summary]) : [];
            
            api.post("/api/brief/analyze",
                { 
                    link: item.link, 
                    title: item.title, 
                    summary: bullets, 
                    language: "fr" 
                },
                { signal: controller.signal }
            )
                .then(data => {
                    setIsPremium(data.status === "success");
                    
                    setDetailedAnalysis(data.analysis);
                    if (data.highlights) {
                        setHighlights(data.highlights);
                    }
                    if (data.citations) {
                        setCitations(data.citations);
                    }
                    if (data.audit_scores) {
                        setAuditScores(data.audit_scores);
                    }
                    if (data.audit_reasons) {
                        setAuditReasons(data.audit_reasons);
                    }
                    if (data.reliability_verdict) {
                        setReliabilityVerdict(data.reliability_verdict);
                    }
                })
                .catch(err => {
                    if (err.name !== 'AbortError') console.error("Analyze error:", err);
                });
            return () => controller.abort();
        }
    }, [isExpanded, detailedAnalysis, item.link, item.title, api]);

    const bullets = useMemo(() => digestToBullets(item.summary), [item.summary]);
    // Ensure we handle plain text properly instead of crashing if no bullets
    const displayPoints = bullets.length > 0 ? bullets : [typeof item.summary === "string" ? item.summary : ""];

    const { title: finalTitle, sourceName: finalSourceName, domain: sourceDomain } = useMemo(() => {
        return parseTitleAndSource(item.localized_title || item.title, item.link, item.source_name);
    }, [item]);

    const handleAction = useCallback(async (action: "read" | "rejected") => {
        const text = Array.isArray(item.summary) ? item.summary.join(" ") : item.summary;
        try {
            await api.post("/api/feedback", { article_title: item.title, article_summary: text, action });
        } catch (e) {
            console.error("Feedback failed", e);
        }
    }, [api, item.title, item.summary]);

    const handleReject = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        triggerHaptic(ImpactStyle.Medium);
        setIsDismissed(true);
        handleAction("rejected");
        onDismiss(item.title);
        setIsExpanded(false);
    }, [handleAction, item.title, onDismiss]);

    if (isDismissed) return null;

    const isHero = variant === "hero";
    const isImpact = item.gate_passed === "impact" || item.category === "Impact";

    // Deduplicate and gather source urls properly
    const sourcesIcons = Array.from(new Set([item.link, ...(item.source_urls || [])])).slice(0, 5);

    return (
        <>
            <motion.article
                onClick={() => {
                    triggerHaptic(ImpactStyle.Light);
                    handleAction("read");
                    setIsExpanded(true);
                }}
                className={`
                    group transition-all duration-300 relative cursor-pointer
                    flex flex-col md:flex-row gap-6 lg:gap-14 py-8 mb-4 lg:mb-8
                    after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1px]
                    after:bg-black/[0.03] last:after:hidden
                `}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
            >
                {/* Text Content */}
                <div className="flex-1 min-w-0 flex flex-col justify-start">
                    
                    {/* Header line for Hero / Impact */}
                    {(isHero || isImpact) && (
                        <div className="flex items-center gap-3 mb-4">
                            {isImpact ? (
                                <span className="bg-red-50 text-red-600 text-[9px] font-black px-2 py-0.5 uppercase tracking-widest shadow-sm">
                                    Flash/Impact
                                </span>
                            ) : (
                                <span className="bg-zinc-900 text-white text-[9px] font-black px-2 py-0.5 uppercase tracking-widest shadow-sm">
                                    Éditorial
                                </span>
                            )}
                        </div>
                    )}

                    <h3 className={`
                        font-[850] leading-[1.15] tracking-tight text-zinc-900 mb-5 
                        group-hover:text-zinc-600 transition-colors duration-300
                        ${isHero ? "text-[26px] sm:text-[34px] xl:text-[40px]" : "text-[20px] sm:text-[24px] xl:text-[28px]"}
                    `}>
                        {finalTitle}
                    </h3>

                    <div className="flex flex-col gap-3 group-hover:pl-2 transition-all duration-500 ease-out">
                        {displayPoints.slice(0, isHero ? 4 : 3).map((point, i) => (
                            <p key={i} className={`
                                leading-[1.7] text-zinc-600 font-[450]
                                ${isHero ? "text-[16px] xl:text-[18px]" : "text-[15px] xl:text-[16px]"}
                                opacity-80 group-hover:opacity-100 transition-opacity duration-300
                            `}>
                                <span className="mr-2 opacity-40 font-serif">■</span>{point}
                            </p>
                        ))}
                    </div>

                    {/* Footer Row */}
                    <div className="flex flex-wrap items-center gap-4 mt-8 pt-2">
                        
                        {/* Domain Tags */}
                        {(item.category || item.sub_category) && (
                            <div className="flex flex-wrap gap-2">
                                {item.category && !TIER_VALUES.includes(item.category as any) && item.category !== "Actualité" && (
                                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest">
                                        {item.category}
                                    </span>
                                )}
                                {item.sub_category && (
                                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-widest before:content-['/'] before:mx-1 before:opacity-30">
                                        {item.sub_category}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Spacer if tags exist */}
                        {(item.category || item.sub_category) && <div className="w-px h-3 bg-zinc-200" />}

                        {/* Stacked Sources Icons */}
                        <div className="flex items-center">
                            <div className="flex items-center -space-x-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                                {sourcesIcons.map((url, i) => {
                                    const domain = new URL(url).hostname;
                                    return (
                                        <div key={i} className="relative w-5 h-5 rounded-full bg-white border border-zinc-200 shadow-sm overflow-hidden flex items-center justify-center shrink-0 z-10 transition-transform hover:z-20 hover:scale-125">
                                            <img 
                                                src={`https://www.google.com/s2/favicons?sz=32&domain=${domain}`} 
                                                className="w-3 h-3 object-contain" 
                                                alt="source" 
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                            
                            {/* Score indicator discreet */}
                            <div className="ml-3 flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${(item.credibility_score || 50) >= 70 ? "bg-emerald-500" : "bg-orange-500"}`} />
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                   NEWSAI {(item.credibility_score || 50)}/100
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Hero / Big Image Display */}
                {isHero && item.image_url && (
                    <div className="w-full md:w-2/5 xl:w-[480px] shrink-0 xl:mb-0 mb-6 md:-order-none order-first">
                        <div className="relative w-full aspect-[4/3] sm:aspect-[16/9] md:aspect-[3/4] xl:aspect-square bg-zinc-100 overflow-hidden group/img">
                            <SafeImage
                                src={item.image_url}
                                alt={finalTitle}
                                className="w-full h-full object-cover transition-transform duration-[2s] group-hover/img:scale-105"
                                fallbackType="screenshot"
                                domain={item.link}
                            />
                            {/* Inner subtle shadow overlay instead of loud rounded borders */}
                            <div className="absolute inset-0 border border-black/5 pointer-events-none" />
                        </div>
                        {/* Optional small credit text underneath */}
                        <p className="text-[10px] text-zinc-400 mt-2 text-right uppercase tracking-widest font-semibold">{finalSourceName}</p>
                    </div>
                )}
            </motion.article>

            <NewsDetailModal
                isOpen={isExpanded}
                onClose={() => setIsExpanded(false)}
                item={item}
                finalTitle={finalTitle}
                finalSourceName={finalSourceName}
                sourceDomain={sourceDomain}
                isImpact={isImpact}
                detailedAnalysis={detailedAnalysis}
                detailedHighlights={highlights}
                detailedCitations={citations}
                detailedAuditScores={auditScores}
                detailedAuditReasons={auditReasons}
                reliabilityVerdict={reliabilityVerdict}
                isPremium={isPremium}
                handleReject={handleReject}
            />
        </>
    );
}
