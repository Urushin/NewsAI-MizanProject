"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { NewsItem, BriefData } from "../types/news";
import { parseTitleAndSource, digestToBullets } from "../utils/newsUtils";
import { formatDateTitle } from "../utils/briefUtils";
import { Share, Heart, X, Eye, Menu, ArrowDown, Newspaper, Layers, Globe, User } from "lucide-react";
import { useApi } from "../utils/api";
import { ImpactStyle } from "@capacitor/haptics";
import { triggerHaptic as triggerHapticUtil } from "../utils/haptics";
import ProfilePopup from "./ProfilePopup";
import BottomNavbar from "./BottomNavbar";

interface MobileFeedProps {
  items: NewsItem[];
  lang: string;
  date?: string;
  globalDigest?: string;
  onProfilePreview?: (data: BriefData) => void;
}

export default function MobileFeed({ items, lang, date, globalDigest, onProfilePreview }: MobileFeedProps) {
  const api = useApi();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());
  const [detailedAnalysis, setDetailedAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);


  // Trigger haptic feedback
  const triggerHaptic = useCallback(async (style = ImpactStyle.Light) => {
    if (style === ImpactStyle.Heavy) {
      await triggerHapticUtil.success();
    } else if (style === ImpactStyle.Medium) {
      await triggerHapticUtil.medium();
    } else {
      await triggerHapticUtil.light();
    }
  }, []);

  // Handle article view / read action
  const handleRead = useCallback(async (item: NewsItem) => {
    const text = Array.isArray(item.summary) ? item.summary.join(" ") : item.summary;
    try {
      await api.post("/api/feedback", {
        article_title: item.title,
        article_summary: text,
        action: "read",
      });
    } catch (e) {
      console.error("Feedback failed", e);
    }
  }, [api]);

  // Handle article like
  const handleLike = useCallback(async (item: NewsItem, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(ImpactStyle.Medium);
    
    setLikedItems(prev => {
      const next = new Set(prev);
      if (next.has(item.title)) {
        next.delete(item.title);
      } else {
        next.add(item.title);
      }
      return next;
    });

    const text = Array.isArray(item.summary) ? item.summary.join(" ") : item.summary;
    try {
      await api.post("/api/feedback", {
        article_title: item.title,
        article_summary: text,
        action: "like",
      });
    } catch (e) {
      console.error("Feedback failed", e);
    }
  }, [api, triggerHaptic]);

  // Handle article share
  const handleShare = useCallback(async (item: NewsItem, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic();

    if (navigator.share) {
      try {
        await navigator.share({
          title: item.localized_title || item.title,
          text: Array.isArray(item.summary) ? item.summary[0] : item.summary,
          url: item.link,
        });
      } catch (e) {
        console.error("Share failed", e);
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${item.localized_title || item.title} - ${item.link}`);
        alert("Lien copié dans le presse-papiers");
      } catch (e) {
        console.error("Clipboard copy failed", e);
      }
    }
  }, [triggerHaptic]);

  // Handle opening detailed view
  const handleOpenDetail = useCallback((item: NewsItem) => {
    triggerHaptic(ImpactStyle.Light);
    setSelectedItem(item);
    handleRead(item);
    setDetailedAnalysis(null);
  }, [triggerHaptic, handleRead]);

  // Fetch detailed analysis when detailed view is open
  useEffect(() => {
    if (!selectedItem) return;

    const controller = new AbortController();
    setIsAnalyzing(true);

    const bullets = selectedItem.summary ? (Array.isArray(selectedItem.summary) ? selectedItem.summary : [selectedItem.summary]) : [];

    api.post("/api/brief/analyze", 
      {
        link: selectedItem.link,
        title: selectedItem.title,
        summary: bullets,
        language: lang
      },
      { signal: controller.signal }
    )
      .then(data => {
        setDetailedAnalysis(data.analysis);
      })
      .catch(err => {
        if (err.name !== 'AbortError') console.error("Analyze error", err);
      })
      .finally(() => {
        setIsAnalyzing(false);
      });

    return () => controller.abort();
  }, [selectedItem, api, lang]);


  return (
    <div className="fixed inset-0 bg-[#FDFCF8] z-50 overflow-hidden select-none">
      {/* Immersive single-scroll feed */}
      <div className="h-full w-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar safe-top safe-bottom">
        
        {/* Welcome Slide (Date of the day + Global Digest + Arrow down) */}
        <div className="h-[100dvh] w-full snap-start snap-always flex flex-col justify-between items-center px-8 relative py-20 bg-[#FDFCF8]">
          <div className="w-full flex justify-between items-center text-zinc-400">
            <span className="text-[10px] font-black uppercase tracking-[0.25em]">NewsAI Briefing</span>
            <span className="text-[10px] font-bold tracking-widest font-sans">INDEX</span>
          </div>

          <div className="w-full max-w-sm flex-1 flex flex-col justify-center items-center text-center">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-4 block">
              ÉDITION DU JOUR
            </span>
            <h1 className="text-3xl sm:text-4xl font-[900] tracking-tight font-serif italic text-zinc-900 mb-8 lowercase">
              {formatDateTitle(date, lang)}
            </h1>
            
            {globalDigest && (
              <p className="text-zinc-600 text-sm sm:text-base leading-[1.8] font-sans font-[450] italic px-5 border-l-2 border-zinc-900 py-2 text-left">
                {globalDigest}
              </p>
            )}
          </div>

          {/* Pulsing Arrow down to encourage scrolling */}
          <motion.div 
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="flex flex-col items-center gap-2 pb-6 text-zinc-400 cursor-pointer"
          >
            <span className="text-[9px] font-black uppercase tracking-widest">Commencer la lecture</span>
            <ArrowDown size={16} />
          </motion.div>
        </div>

        {/* News Slides */}
        {items.map((item, idx) => {
          const { title: finalTitle } = parseTitleAndSource(
            item.localized_title || item.title,
            item.link,
            item.source_name
          );

          const bullets = digestToBullets(item.summary);
          const isLiked = likedItems.has(item.title);

          const sourcesIcons = Array.from(new Set([item.link, ...(item.source_urls || [])])).slice(0, 4);

          return (
            <div 
              key={idx} 
              className="h-[100dvh] w-full snap-start snap-always flex flex-col justify-between items-center px-8 relative py-20 bg-[#FDFCF8] border-b border-zinc-100"
            >
              {/* Header metadata */}
              <div className="w-full flex justify-between items-center text-zinc-400">
                <span className="text-[10px] font-black uppercase tracking-[0.25em]">
                  {item.category || "Actualité"}
                </span>
                
                {/* SVG Progress Circle */}
                <div className="relative w-9 h-9 flex items-center justify-center">
                  <svg className="w-9 h-9 transform -rotate-90 select-none">
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      className="stroke-zinc-100"
                      strokeWidth="2"
                      fill="transparent"
                    />
                    <motion.circle
                      cx="18"
                      cy="18"
                      r="14"
                      className="stroke-zinc-950 dark:stroke-zinc-50"
                      strokeWidth="2"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 14}
                      initial={{ strokeDashoffset: 2 * Math.PI * 14 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 14 * (1 - (idx + 1) / items.length) }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black font-sans text-zinc-900 dark:text-zinc-100">
                    {items.length}
                  </span>
                </div>
              </div>

              {/* Central Title (Modern & Neutre) + Preview */}
              <div 
                className="w-full max-w-sm flex-1 flex flex-col justify-center items-start text-left cursor-pointer select-none group"
                onClick={() => handleOpenDetail(item)}
              >
                {/* Modern Sans-Serif Typography */}
                <motion.h2 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 font-sans leading-[1.3] mb-4 w-full"
                >
                  {finalTitle}
                </motion.h2>

                {/* Bullet Points Preview */}
                {bullets.length > 0 && (
                  <div className="space-y-2 text-left w-full mt-4 mb-4">
                    {bullets.slice(0, 2).map((bullet, bIdx) => (
                      <p key={bIdx} className="text-zinc-500 text-xs sm:text-[13px] leading-relaxed font-sans font-[400] flex items-start gap-2">
                        <span className="text-zinc-400 mt-1 select-none text-[8px]">•</span>
                        <span>{bullet}</span>
                      </p>
                    ))}
                  </div>
                )}

                {/* Source Logo Favicons (Names Removed) */}
                {sourcesIcons.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 select-none w-full justify-start">
                    {sourcesIcons.map((url, i) => {
                      try {
                        const domain = new URL(url).hostname;
                        return (
                          <div key={i} className="relative w-5 h-5 rounded-full bg-white border border-zinc-200 shadow-sm overflow-hidden flex items-center justify-center shrink-0">
                            <img 
                              src={`https://www.google.com/s2/favicons?sz=32&domain=${domain}`} 
                              className="w-3.5 h-3.5 object-contain" 
                              alt="source favicon" 
                            />
                          </div>
                        );
                      } catch (e) {
                        return null;
                      }
                    })}
                  </div>
                )}

                <div className="mt-8 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-zinc-400">
                  <Eye size={12} />
                  <span className="text-[9px] font-black uppercase tracking-widest">Détails de l'article</span>
                </div>
              </div>

              {/* Action buttons panel */}
              <div className="absolute bottom-20 left-0 right-0 flex justify-center gap-8 pb-4">
                <button 
                  onClick={(e) => handleLike(item, e)}
                  className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all duration-300 active:scale-90 ${
                    isLiked 
                      ? "bg-zinc-900 border-zinc-900 text-white" 
                      : "bg-white border-zinc-200 text-zinc-950"
                  }`}
                >
                  <Heart size={18} fill={isLiked ? "white" : "none"} />
                </button>
                <button 
                  onClick={(e) => handleShare(item, e)}
                  className="w-12 h-12 rounded-full bg-white border border-zinc-200 text-zinc-950 flex items-center justify-center active:scale-90 transition-transform"
                >
                  <Share size={18} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Global Unified Mobile Menu & Bottom Navbar */}
      <BottomNavbar onProfilePreview={onProfilePreview} />


      {/* Modern, full screen, beautiful details sheet */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 220 }}
            className="fixed inset-0 bg-[#FDFCF8] z-[60] overflow-y-auto hide-scrollbar safe-top safe-bottom flex flex-col justify-between"
          >
            <div className="px-8 py-8 flex-1">
              <div className="flex justify-between items-center mb-12">
                <button 
                  onClick={() => {
                    triggerHaptic();
                    setSelectedItem(null);
                  }}
                  className="w-10 h-10 rounded-full bg-zinc-100/80 backdrop-blur flex items-center justify-center text-zinc-900 active:scale-90 transition-transform"
                >
                  <X size={18} />
                </button>

                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-400">
                  {selectedItem.category}
                </span>
              </div>

              {/* Modern Details Title */}
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 font-sans leading-[1.3] mb-8">
                {selectedItem.localized_title || selectedItem.title}
              </h2>

              {/* Summary paragraphs */}
              <div className="space-y-6 font-sans text-zinc-700 leading-[1.7] text-sm sm:text-base mb-16">
                {Array.isArray(selectedItem.summary) ? (
                  selectedItem.summary.map((para, i) => (
                    <p key={i} className="pl-4 border-l border-zinc-200">
                      {para}
                    </p>
                  ))
                ) : (
                  <p className="pl-4 border-l border-zinc-200">
                    {selectedItem.summary}
                  </p>
                )}
              </div>

              {/* Extra AI Insights & Reliability Analysis */}
              <div className="space-y-8 border-t border-zinc-100 pt-8 mb-20">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                    Reliability analysis
                  </span>
                  <span className="text-[10px] font-bold text-zinc-500 font-mono">
                    Score: {selectedItem.credibility_score || 70}/100
                  </span>
                </div>

                {isAnalyzing ? (
                  <div className="space-y-3 animate-pulse py-4">
                    <div className="h-4 bg-zinc-100 w-3/4 rounded-sm" />
                    <div className="h-4 bg-zinc-100 w-5/6 rounded-sm" />
                    <div className="h-4 bg-zinc-100 w-2/3 rounded-sm" />
                  </div>
                ) : (
                  detailedAnalysis && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm font-sans text-zinc-600 leading-relaxed space-y-4"
                    >
                      <p className="font-sans text-zinc-500">
                        {detailedAnalysis}
                      </p>
                    </motion.div>
                  )
                )}
              </div>
            </div>

            {/* Sticky Action Link */}
            {selectedItem.link && (
              <div className="p-8 bg-gradient-to-t from-[#FDFCF8] via-[#FDFCF8] to-[#FDFCF8]/0 sticky bottom-0">
                <a 
                  href={selectedItem.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={() => triggerHaptic()}
                  className="w-full py-5 flex items-center justify-center bg-zinc-900 hover:bg-black text-white text-[11px] font-black uppercase tracking-[0.2em] transition-all"
                >
                  Ouvrir la Source Originale
                </a>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
