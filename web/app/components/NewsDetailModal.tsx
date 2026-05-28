"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Sparkles, Lock, Share2, ThumbsDown, Info, ExternalLink, ChevronDown, ShieldCheck, ShieldAlert, AlertTriangle, HelpCircle } from "lucide-react";

import { NewsItem } from "../types/news";
import { extractDomain, formatSourceName } from "../utils/newsUtils";
import { modalLabels, shareLabels } from "../config/translations";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { TRANSITIONS } from "../config/constants";
import { useState } from "react";
import { ImpactStyle } from "@capacitor/haptics";
import { triggerHaptic as triggerHapticUtil } from "../utils/haptics";

/**
 * Component to display Wikipedia-style tooltips for quotes citations.
 */
function CitationItem({ id, quote, link }: { id: string, quote: string, link: string }) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <span 
      className="relative inline-block mx-0.5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <sup className="text-orange-600 font-black cursor-help bg-orange-50 px-1 rounded-sm text-[10px] select-none">[{id}]</sup>
      <AnimatePresence>
        {isHovered && (
          <motion.span 
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: -10 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 p-3 bg-zinc-900/95 text-white text-[12px] font-sans font-medium rounded shadow-xl w-64 z-[200] border border-zinc-800 backdrop-blur-md leading-relaxed text-center"
          >
            <a 
              href={link} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="block hover:text-orange-300 transition-colors pointer-events-auto"
            >
              &ldquo;{quote}&rdquo;
              <div className="mt-2 text-[10px] text-orange-400 font-black uppercase tracking-widest flex items-center justify-center gap-1">
                Voir l'article <ExternalLink size={10} />
              </div>
            </a>
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900/95" />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/**
 * A simple lightweight markdown-like parser for the synthesis.
 * Handles: **bold**, *italic*, line breaks and [N] citations.
 */
function MarkdownText({ text, citations = {}, link }: { text: string; citations?: Record<string, string>; link: string }) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|\[\d+\])/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <span key={i} className="font-bold text-zinc-900">{part.slice(2, -2)}</span>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <span key={i} className="italic text-zinc-800 font-medium">{part.slice(1, -1)}</span>;
        }
        if (part.startsWith('[') && part.endsWith(']')) {
          const id = part.slice(1, -1);
          if (citations[id]) {
            return <CitationItem key={i} id={id} quote={citations[id]} link={link} />;
          }
        }
        return part;
      })}
    </>
  );
}

// ── Verdict Color & Icon Mapping ──
const VERDICT_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
  "FAIT_OBJECTIF_FIABLE": { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-300", icon: <ShieldCheck size={16} />, label: "Fait objectif fiable" },
  "INFORMATION_PARTIELLE": { color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-300", icon: <Info size={16} />, label: "Information partielle" },
  "FAIT_MILITARISÉ": { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-400", icon: <AlertTriangle size={16} />, label: "Fait militarisé / cadrage biaisé" },
  "DÉSINFORMATION_TOXIQUE": { color: "text-red-700", bg: "bg-red-50", border: "border-red-400", icon: <ShieldAlert size={16} />, label: "Désinformation toxique" },
  "RUMEUR_EN_BOUCLE": { color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-300", icon: <Zap size={16} />, label: "Rumeur en boucle" },
  "NON_VÉRIFIABLE": { color: "text-zinc-600", bg: "bg-zinc-100", border: "border-zinc-300", icon: <HelpCircle size={16} />, label: "Non vérifiable" },
  "PARODIE": { color: "text-pink-600", bg: "bg-pink-50", border: "border-pink-300", icon: <Sparkles size={16} />, label: "Parodie / Satire" },
};

const BIAS_DISPLAY: Record<string, { icon: string; label: string }> = {
  "APPEAL_TO_OUTRAGE": { icon: "😡", label: "Appel à l'indignation" },
  "APPEAL_TO_FEAR": { icon: "😨", label: "Appel à la peur" },
  "FALSE_DILEMMA": { icon: "⚖️", label: "Faux dilemme" },
  "STRAWMAN_FALLACY": { icon: "🤡", label: "Homme de paille" },
  "HASTY_GENERALIZATION": { icon: "🎯", label: "Généralisation hâtive" },
  "CHERRY_PICKING": { icon: "🍒", label: "Picorage de données" },
};

const EVIDENCE_DISPLAY: Record<string, { label: string; color: string }> = {
  "STRONG_CONSENSUS": { label: "Consensus solide", color: "text-emerald-600" },
  "EMERGING_DATA": { label: "Données émergentes", color: "text-blue-600" },
  "CONTROVERSIAL": { label: "Controversé", color: "text-orange-600" },
  "NO_ROOT_EVIDENCE": { label: "Aucune preuve racine", color: "text-red-600" },
  "DEBUNKED_OR_RETRACTED": { label: "Réfuté / rétracté", color: "text-red-700" },
};

interface NewsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: NewsItem;
  finalTitle: string;
  finalSourceName: string;
  sourceDomain: string;
  isImpact: boolean;
  detailedAnalysis: string | null;
  detailedHighlights?: string[];
  detailedCitations?: Record<string, string>;
  detailedAuditScores?: Record<string, { score: number; reason: string }>;
  detailedAuditReasons?: string[];
  reliabilityVerdict?: Record<string, unknown> | null;
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
  detailedHighlights = [],
  detailedCitations = {},
  detailedAuditScores = { 
    "Source": { score: 4, reason: "Analyse en attente" }, 
    "Factualité": { score: 4, reason: "Analyse en attente" }, 
    "Manipulation": { score: 4, reason: "Analyse en attente" } 
  },
  detailedAuditReasons = [],
  reliabilityVerdict = null,
  isPremium,
  handleReject
}: NewsDetailModalProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [isRejecting, setIsRejecting] = useState(false);
  const [showVerbatim, setShowVerbatim] = useState(false);
  const [showAuditDetails, setShowAuditDetails] = useState(false);

  const triggerHaptic = async (style = ImpactStyle.Light) => {
    if (style === ImpactStyle.Heavy) {
      await triggerHapticUtil.success();
    } else if (style === ImpactStyle.Medium) {
      await triggerHapticUtil.medium();
    } else {
      await triggerHapticUtil.light();
    }
  };

  const m = modalLabels[user?.language || "fr"] || modalLabels.en;
  const s = shareLabels[user?.language || "fr"] || shareLabels.en;

  const handleShare = async () => {
    triggerHaptic(ImpactStyle.Light);
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
    triggerHaptic(ImpactStyle.Medium);
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
                onClick={() => {
                  triggerHaptic(ImpactStyle.Light);
                  onClose();
                }}
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
                  <div className={`w-1.5 h-1.5 rounded-full ${(item.credibility_score || 50) >= 70 ? "bg-emerald-500" : "bg-orange-500"}`} aria-hidden="true" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Source : {(item.credibility_score || 50)}/100
                  </span>
                </div>
              </div>

              <h1 className="text-3xl sm:text-5xl font-[900] tracking-tighter leading-[0.95] text-zinc-900 mb-8 pr-12 font-serif italic lowercase">
                {finalTitle}
              </h1>

              {/* 📊 Advanced Reliability Verdict Panel */}
              <div 
                className={`mb-8 border-2 shadow-sm transition-all ${
                  reliabilityVerdict 
                    ? (VERDICT_CONFIG[(reliabilityVerdict.status as string)]?.border || "border-zinc-300") + " " + (VERDICT_CONFIG[(reliabilityVerdict.status as string)]?.bg || "bg-zinc-50")
                    : "border-orange-300 bg-amber-50/90"
                }`}
                style={{ position: 'relative', zIndex: 100 }}
              >
                <button 
                  onClick={() => setShowAuditDetails(!showAuditDetails)}
                  className="w-full p-4 flex items-center justify-between outline-none group hover:opacity-90 transition-all"
                >
                  <div className="flex items-center gap-3">
                    {/* Circle Score */}
                    <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white/80 border border-zinc-300">
                      <span className="text-[14px] font-black text-zinc-800">{(item.credibility_score || 50)}%</span>
                    </div>
                    <div className="text-left">
                      {reliabilityVerdict ? (
                        <>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={VERDICT_CONFIG[(reliabilityVerdict.status as string)]?.color || "text-zinc-600"}>
                              {VERDICT_CONFIG[(reliabilityVerdict.status as string)]?.icon}
                            </span>
                            <h4 className={`text-[11px] uppercase font-black tracking-widest ${VERDICT_CONFIG[(reliabilityVerdict.status as string)]?.color || "text-zinc-800"}`}>
                              {VERDICT_CONFIG[(reliabilityVerdict.status as string)]?.label || (reliabilityVerdict.status as string)}
                            </h4>
                          </div>
                          <p className="text-[10px] font-medium text-zinc-500">
                            Factualité {(reliabilityVerdict.factual_score as number)}% · Manipulation {(reliabilityVerdict.manipulation_score as number)}%
                          </p>
                        </>
                      ) : (
                        <>
                          <h4 className="text-[10px] uppercase font-black tracking-widest text-zinc-950 mb-0.5">Indice de Fiabilité Globale</h4>
                          <p className="text-[11px] font-serif italic text-zinc-600">Calculé & certifié par l'IA</p>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <motion.div 
                    animate={{ rotate: showAuditDetails ? 180 : 0 }} 
                    transition={{ duration: 0.2 }}
                    className="text-zinc-500 group-hover:text-zinc-700 pr-2"
                  >
                     <ChevronDown size={14} />
                  </motion.div>
                </button>

                {showAuditDetails && (
                  <div className="overflow-hidden border-t border-zinc-200/60 bg-white">
                    <div className="p-5 flex flex-col gap-5">

                      {/* ── Reliability Verdict Details ── */}
                      {reliabilityVerdict && (
                        <>
                          {/* Dual Gauges */}
                          <div className="flex flex-col gap-3">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Factualité</span>
                                <span className="text-[11px] font-black text-zinc-700">{(reliabilityVerdict.factual_score as number)}/100</span>
                              </div>
                              <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-700 ${
                                    (reliabilityVerdict.factual_score as number) >= 70 ? "bg-emerald-500" 
                                    : (reliabilityVerdict.factual_score as number) >= 40 ? "bg-amber-500" 
                                    : "bg-red-500"
                                  }`}
                                  style={{ width: `${reliabilityVerdict.factual_score as number}%` }}
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Indice de Manipulation</span>
                                <span className="text-[11px] font-black text-zinc-700">{(reliabilityVerdict.manipulation_score as number)}/100</span>
                              </div>
                              <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-700 ${
                                    (reliabilityVerdict.manipulation_score as number) <= 30 ? "bg-emerald-500" 
                                    : (reliabilityVerdict.manipulation_score as number) <= 60 ? "bg-amber-500" 
                                    : "bg-red-500"
                                  }`}
                                  style={{ width: `${reliabilityVerdict.manipulation_score as number}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Source Reputation + Evidence Quality */}
                          <div className="flex flex-wrap gap-2 pt-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-600 border border-zinc-200">
                              🌐 Réputation source : {(reliabilityVerdict.source_reputation_score as number)}/100
                            </span>
                            {(reliabilityVerdict.root_evidence_quality as string) && (
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-zinc-50 border border-zinc-200 ${
                                EVIDENCE_DISPLAY[(reliabilityVerdict.root_evidence_quality as string)]?.color || "text-zinc-600"
                              }`}>
                                📋 {EVIDENCE_DISPLAY[(reliabilityVerdict.root_evidence_quality as string)]?.label || (reliabilityVerdict.root_evidence_quality as string)}
                              </span>
                            )}
                            {(reliabilityVerdict.is_synthesis as boolean) && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-200">
                                📰 Synthèse — {(reliabilityVerdict.sources_count as number)} sources
                              </span>
                            )}
                          </div>

                          {/* Detected Cognitive Biases */}
                          {(reliabilityVerdict.detected_biases as string[])?.length > 0 && (
                            <div className="pt-3 border-t border-zinc-100">
                              <span className="text-[9px] uppercase font-black tracking-widest text-red-500 block mb-2">⚠️ Biais Cognitifs Détectés :</span>
                              <div className="flex flex-wrap gap-2">
                                {(reliabilityVerdict.detected_biases as string[]).map((bias, i) => (
                                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 rounded-sm">
                                    {BIAS_DISPLAY[bias]?.icon || "⚠️"} {BIAS_DISPLAY[bias]?.label || bias}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Explanation */}
                          {(reliabilityVerdict.explanation as string) && (
                            <div className="pt-3 border-t border-zinc-100">
                              <span className="text-[9px] uppercase font-black tracking-widest text-zinc-400 block mb-2">Explication du Verdict :</span>
                              <p className="text-[12px] text-zinc-600 font-medium leading-relaxed">
                                {(reliabilityVerdict.explanation as string)}
                              </p>
                            </div>
                          )}
                        </>
                      )}

                      {/* ── Legacy Stars (backward-compatible, always shown) ── */}
                      <div className={`flex flex-col gap-4 ${reliabilityVerdict ? "pt-3 border-t border-zinc-100" : ""}`}>
                        <span className="text-[9px] uppercase font-black tracking-widest text-zinc-400 block">Scores Détaillés :</span>
                        {Object.entries(detailedAuditScores).map(([label, data]) => (
                          <div key={label} className="border-b border-zinc-100 last:border-0 pb-3 last:pb-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">{label}</span>
                              <div className="flex items-center gap-0.5">
                                {Array(5).fill(0).map((_, i) => (
                                  <span key={i} className={`text-[14px] ${i < (data.score || 0) ? "text-orange-500" : "text-zinc-200"}`}>★</span>
                                ))}
                              </div>
                            </div>
                            {data.reason && (
                              <p className="text-[11px] text-zinc-600 font-medium italic leading-relaxed">
                                {data.reason}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

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
                        <MarkdownText text={detailedAnalysis} citations={detailedCitations} link={item.link} />
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

              {/* 🔍 Method 4: Verbatim Collapsible Extracted from original content */}
              <div className="mb-6 border border-zinc-200 bg-zinc-50 p-6 shadow-sm">
                <button 
                  onClick={() => setShowVerbatim(!showVerbatim)} 
                  className="w-full flex items-center justify-between outline-none group"
                >
                  <div className="flex items-center gap-3">
                    <Info size={14} className="text-zinc-600" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-800">
                      🔎 Vérification : Phrases clés d'origine
                    </span>
                  </div>
                  <motion.span 
                    animate={{ rotate: showVerbatim ? 180 : 0 }} 
                    transition={{ duration: 0.2 }}
                    className="text-zinc-400 group-hover:text-zinc-900"
                  >
                    <Zap size={14} className="rotate-90" />
                  </motion.span>
                </button>

                <AnimatePresence>
                  {showVerbatim && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: "auto" }} 
                      exit={{ opacity: 0, height: 0 }} 
                      className="overflow-hidden"
                    >
                      <div className="pt-5 space-y-4">
                        {detailedHighlights && detailedHighlights.length > 0 ? (
                          detailedHighlights.map((text, idx) => (
                            <div key={idx} className="p-4 bg-white border border-zinc-100 relative pl-6">
                              <div className="absolute left-3 top-4 w-1 h-1 bg-orange-500 rounded-full" />
                              <p className="text-[14px] leading-relaxed text-zinc-600 font-serif italic">
                                &ldquo;{text}&rdquo;
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 bg-white border border-zinc-100 relative pl-6">
                            <div className="absolute left-3 top-4 w-1 h-1 bg-zinc-400 rounded-full" />
                            <p className="text-[13px] leading-relaxed text-zinc-400 font-serif italic">
                              &ldquo;Aucun extrait disponible pour cet article (le contenu complet n'a pas pu être extrait de la source).&rdquo;
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
                            <img
                              src={`https://www.google.com/s2/favicons?size=32&domain=${d}`}
                              className="w-full h-full object-contain"
                              alt={sName}
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
