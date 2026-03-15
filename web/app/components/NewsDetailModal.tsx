"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Sparkles, Lock, Share2, ThumbsDown, Info } from "lucide-react";
import Image from "next/image";
import { NewsItem } from "../types/news";
import { extractDomain, formatSourceName } from "../utils/newsUtils";
import { modalLabels, shareLabels } from "../config/translations";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { TRANSITIONS } from "../config/constants";
import { useState } from "react";

/**
 * A simple lightweight markdown-like parser for the synthesis.
 * Handles: **bold**, *italic*, and line breaks.
 */
function MarkdownText({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <span key={i} className="font-bold text-zinc-900">{part.slice(2, -2)}</span>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <span key={i} className="italic text-zinc-800 font-medium">{part.slice(1, -1)}</span>;
        }
        return part;
      })}
    </>
  );
}

interface NewsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: NewsItem;
  finalTitle: string;
  finalSourceName: string;
  sourceDomain: string;
  isImpact: boolean;
  detailedAnalysis: string | null;
  isPremium: boolean | null;
  handleReject: (e: React.MouseEvent) => void;
}

export default function NewsDetailModal({
  isOpen,
  onClose,
  item,
  finalTitle,
  finalSourceName,
  sourceDomain,
  isImpact,
  detailedAnalysis,
  isPremium,
  handleReject
}: NewsDetailModalProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [isRejecting, setIsRejecting] = useState(false);

  const m = modalLabels[user?.language || "fr"] || modalLabels.en;
  const s = shareLabels[user?.language || "fr"] || shareLabels.en;

  const handleShare = async () => {
    const shareData = {
      title: finalTitle,
      text: `${finalTitle}\n\n${detailedAnalysis || item.summary || ""}`,
      url: item.link
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareData.title}\n\n${shareData.text}\n\n${shareData.url}`);
        toast.showToast(s.copied, "success");
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const onDismissRequested = (e: React.MouseEvent) => {
    setIsRejecting(true);
    // Give time for the animation before calling the actual logic
    setTimeout(() => {
      handleReject(e);
      setIsRejecting(false);
    }, 450);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6 md:p-10 pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-950/40 backdrop-blur-md pointer-events-auto"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 12 }}
            animate={{
              opacity: isRejecting ? 0 : 1,
              scale: isRejecting ? 0.9 : 1,
              x: isRejecting ? 400 : 0,
              y: isRejecting ? 50 : 0,
              rotate: isRejecting ? 8 : 0
            }}
            exit={{ opacity: 0, scale: 0.98, y: 12 }}
            transition={isRejecting ? { type: "spring", damping: 25, stiffness: 200 } : TRANSITIONS.spring}
            className="relative w-full h-full sm:h-auto sm:max-h-[86vh] sm:max-w-3xl overflow-hidden sm:rounded-none bg-[#FDFCF8] border border-zinc-200 shadow-2xl flex flex-col pointer-events-auto"
          >
            {/* Header Actions */}
            <div className="absolute top-5 right-5 sm:top-6 sm:right-7 flex items-center gap-3 z-[110]">
              <button
                onClick={handleShare}
                className="w-10 h-10 flex items-center justify-center bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all"
              >
                <Share2 size={16} aria-hidden="true" />
              </button>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center bg-zinc-900 text-white hover:bg-black transition-all"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pt-12 pb-10 sm:px-16 sm:pt-20 sm:pb-16 flex flex-col custom-scrollbar">
              {/* Category & Score */}
              <div className="flex items-center gap-6 mb-10 pb-4 border-b border-zinc-100">
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isImpact ? "text-red-500" : "text-zinc-400"}`}>
                  {isImpact ? m.impact : item.category || "Passion"}
                </span>
                <div className="flex items-center gap-3 border-l border-zinc-200 pl-6">
                  <div className={`w-1.5 h-1.5 rounded-full ${(item.credibility_score || 5) >= 7 ? "bg-emerald-500" : "bg-orange-500"}`} aria-hidden="true" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Source : {(item.credibility_score || 5)}/10
                  </span>
                </div>
              </div>

              <h1 className="text-3xl sm:text-5xl font-[900] tracking-tighter leading-[0.95] text-zinc-900 mb-12 pr-12 font-serif italic lowercase">
                {finalTitle}
              </h1>

              {/* AI Analysis Section */}
              <div className="relative mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <Sparkles size={14} className="text-zinc-900" aria-hidden="true" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-900">Analyse de la Rédaction IA</h3>
                </div>

                <div className="relative p-8 sm:p-12 bg-white border border-zinc-100 shadow-sm overflow-hidden">
                  {!detailedAnalysis ? (
                    <div className="space-y-6 animate-pulse relative">
                      <div className="h-4 bg-zinc-50 rounded-sm w-full"></div>
                      <div className="h-4 bg-zinc-50 rounded-sm w-[94%]"></div>
                      <div className="h-4 bg-zinc-50 rounded-sm w-[88%]"></div>
                      <div className="h-4 bg-zinc-50 rounded-sm w-[60%]"></div>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className={`text-[16px] sm:text-[18px] leading-[1.8] text-zinc-700 font-serif italic transition-all duration-700 ${isPremium === false ? "blur-[7px] select-none opacity-40 max-h-[160px] overflow-hidden" : ""}`}>
                        <MarkdownText text={detailedAnalysis} />
                      </div>

                      {isPremium === false && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-[#FDFCF8]/40 backdrop-blur-sm -mx-8 -my-8 sm:-mx-12 sm:-my-12">
                          <div className="p-10 bg-white border border-zinc-200 max-w-sm shadow-2xl">
                            <div className="w-14 h-14 bg-zinc-900 flex items-center justify-center mx-auto text-white mb-8">
                              <Lock size={24} aria-hidden="true" />
                            </div>
                            <h4 className="text-[18px] font-[900] text-zinc-900 mb-4 font-serif italic lowercase">{m.proReserved}</h4>
                            <p className="text-[13px] text-zinc-500 font-medium mb-10 font-serif italic">
                              {m.proSub}
                            </p>
                            <button className="w-full py-4 bg-zinc-900 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-3">
                              S'abonner au Pro
                              <Zap size={14} className="fill-white" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Multi-source footer */}
              {item.source_urls && item.source_urls.length > 0 && (
                <div className="mt-8 pt-8 border-t border-zinc-100 flex flex-col gap-6">
                  <div className="flex items-center gap-3">
                    <Info size={14} className="text-zinc-400" aria-hidden="true" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                      Sources Indexées ({(item.sources_count || item.source_urls.length)})
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {item.source_urls.slice(0, 5).map((url, i) => {
                      const d = extractDomain(url);
                      const sName = formatSourceName(d, item.source_names?.[i]);
                      return (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-5 py-2 bg-zinc-50 border border-zinc-200 text-[11px] font-bold text-zinc-500 hover:text-zinc-900 hover:border-zinc-400 transition-all flex items-center gap-2 active:scale-95"
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
            </div>

            {/* Sticky Bottom Bar */}
            <div className="px-8 py-5 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between mt-auto">
              <button
                onClick={onDismissRequested}
                className="group flex items-center gap-3 px-5 py-2.5 bg-white border border-zinc-200 text-zinc-400 hover:text-zinc-900 hover:border-zinc-900 transition-all active:scale-95"
                title="Pas intéressé par ce sujet"
              >
                <ThumbsDown size={14} className="group-hover:-translate-y-0.5 transition-transform" />
                <span className="text-[11px] font-black uppercase tracking-widest leading-none">Not Interested</span>
              </button>

              <div className="flex items-center gap-3">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-300">
                  NewsAI Archive System
                </span>
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-200" aria-hidden="true" />
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
