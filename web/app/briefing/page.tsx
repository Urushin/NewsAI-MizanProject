"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

import useSWR from "swr";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { motion, AnimatePresence } from "framer-motion";
import NewsCard from "../components/NewsCard";
import HistoryPanel from "../components/HistoryPanel";
import BottomNavbar from "../components/BottomNavbar";
import GenerationLoader from "../components/GenerationLoader";
import ShareMenu from "../components/ShareMenu";
import ErrorEmptyState from "../components/ErrorEmptyState";
import ProfilePopup from "../components/ProfilePopup";
import {
  Sparkles,
  ChevronRight,
  ChevronDown,
  Youtube,
  Play,
  ShieldCheck
} from "lucide-react";

import { BriefData } from "../types/news";
import { useApi } from "../utils/api";
import { briefLabels, commonLabels } from "../config/translations";
import { getCategoryMeta } from "../config/categories";
import { groupByCategory, formatDateTitle } from "../utils/briefUtils";
import { usePlatform } from "../../hooks/usePlatform";
import MobileFeed from "../components/MobileFeed";

export default function BriefingPage() {
  const { user, token, loading: authLoading, genStatus, setGenStatus, triggerRefresh } = useAuth();
  const { isNative } = usePlatform();
  const router = useRouter();

  const api = useApi();
  const toast = useToast();

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDigest, setShowDigest] = useState(false);
  const [showVideos, setShowVideos] = useState(false); // Collapsible videos

  const lang = user?.language || "fr";
  const b = briefLabels[lang] || briefLabels.en;
  const c = commonLabels[lang] || commonLabels.en;

  // Security
  useEffect(() => { if (!authLoading && !user) router.push("/login"); }, [authLoading, user, router]);

  // SWR Data Fetching
  const { data, error, isLoading, mutate } = useSWR<BriefData>(
    token ? (selectedDate ? `/api/brief?date=${selectedDate}` : `/api/brief`) : null,
    (url: string) => api.get(url)
  );

  // External profile preview updates SWR cache
  const handlePreviewData = useCallback((newData: BriefData) => {
    mutate(newData, false);
  }, [mutate]);

  // Generation Status Long Polling
  useEffect(() => {
    if (!token || !genStatus.active || genStatus.isDone) return;
    const interval = setInterval(async () => {
      try {
        const status = await api.get("/api/brief/status");
        if (status.status === "done") {
          setGenStatus({ active: true, step: "Édition prête", percent: 100, isDone: true });
          setTimeout(() => { triggerRefresh(); setGenStatus({ active: false, step: "", percent: 0, isDone: false }); }, 1500);
        } else if (status.status === "error") {
          setGenStatus({ active: false, step: "", percent: 0, isDone: false });
          toast.showToast("Échec de la rédaction.", "error");
        } else {
          setGenStatus({ active: true, step: status.step || "Rédaction en cours...", percent: status.percent || 10, isDone: false });
        }
      } catch (e) { }
    }, 2000);
    return () => clearInterval(interval);
  }, [token, genStatus.active, genStatus.isDone, setGenStatus, triggerRefresh, api]);

  const handleDismiss = useCallback((title: string) => setDismissed(prev => new Set(prev).add(title)), []);
  const visibleContent = useMemo(() => (data?.content || []).filter(i => !dismissed.has(i.title)), [data, dismissed]);
  const groupedContent = useMemo(() => groupByCategory(visibleContent), [visibleContent]);

  if (isLoading || authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#FDFCF8] flex flex-col items-center w-full">
         <main className="w-full max-w-5xl px-8 py-20 space-y-12 animate-pulse mt-12 grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="col-span-8 space-y-10">
            <div className="h-12 w-1/2 bg-zinc-200/50 rounded-sm mb-10" />
            <div className="space-y-12">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-4 mb-4">
                  <div className="flex-1 space-y-4">
                    <div className="h-8 bg-zinc-200/50 rounded-sm w-full max-w-lg mb-6" />
                    <div className="h-3 bg-zinc-100 rounded-sm w-4/5" />
                    <div className="h-3 bg-zinc-100 rounded-sm w-3/4" />
                    <div className="h-3 bg-zinc-100 rounded-sm w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden lg:block lg:col-span-4 mt-24">
             <div className="h-4 lg:w-3/4 bg-zinc-100 rounded-sm mb-4" />
             <div className="h-64 lg:w-full bg-zinc-50 rounded-sm" />
          </div>
        </main>
      </div>
    );
  }

  if (error) return (
    <div className="min-h-screen bg-[#FDFCF8] flex items-center justify-center p-6 text-center">
      <ErrorEmptyState message={error.message || "Impossible de récupérer l'édition."} onRetry={() => mutate()} />
    </div>
  );

  if (genStatus.active) return <GenerationLoader step={genStatus.step} percent={genStatus.percent} isDone={genStatus.isDone} />;

  if (isNative && data?.content) {
    return (
      <MobileFeed 
        items={data.content} 
        lang={lang} 
        date={data.date} 
        globalDigest={data.global_digest}
        onProfilePreview={handlePreviewData}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCF8] text-zinc-900 flex flex-col items-center w-full selection:bg-zinc-200">

      {/* Sidebar Tools */}
      <div className="fixed top-8 left-8 z-40 hidden sm:flex flex-col gap-3">
        <HistoryPanel onSelectDate={(d) => setSelectedDate(d)} selectedDate={selectedDate} lang={lang} />
      </div>

      {/* Main Journal Layout */}
      <main className="w-full max-w-6xl px-6 sm:px-12 py-12 sm:py-20 pb-32">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 xl:gap-24">
            
            {/* Left Column : News Feed */}
            <div className="col-span-1 lg:col-span-8">
                
                {/* Journal Header */}
                <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-14 xl:mb-20 pb-10 border-b border-black md:border-b-2">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div>
                            <h1 className="text-4xl md:text-5xl lg:text-[64px] font-[900] tracking-tighter text-zinc-900 leading-[1] mb-6 font-serif">
                                {formatDateTitle(data?.date, lang)}
                            </h1>
                            <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-zinc-500">
                                <span>Vol. {(data?.total_kept || 0) * 3}</span>
                                <span className="w-1 h-1 bg-zinc-300 rounded-full" />
                                <span>{data?.total_collected || "0"} <strong>Articles analysés</strong></span>
                            </div>
                        </div>
                    </div>
                </motion.header>

                {/* Categories Sections (News List) */}
                <div className="space-y-2">
                {groupedContent.map((group, gIdx) => {
                    const meta = getCategoryMeta(group.category);
                    return (
                    <motion.section key={group.category} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gIdx * 0.1 }}>
                        <div className="space-y-2">
                        {group.subGroups.map((sub) => (
                            <div key={sub.subCategory}>
                            <div className="flex flex-col gap-0">
                                <AnimatePresence mode="popLayout">
                                {sub.items.map((article, idx) => (
                                    <NewsCard
                                        key={article.link + idx}
                                        item={article}
                                        index={idx}
                                        variant={gIdx === 0 && idx === 0 ? "hero" : "default"}
                                        onDismiss={handleDismiss}
                                    />
                                ))}
                                </AnimatePresence>
                            </div>
                            </div>
                        ))}
                        </div>
                    </motion.section>
                    );
                })}
                </div>
            </div>

            {/* Right Column : Digest & Videos (Sidebar) */}
            <div className="col-span-1 lg:col-span-4 mt-8 lg:mt-32 space-y-12">
                
                {/* Global Digest Module */}
                {data?.global_digest && (
                    <section className="bg-zinc-50 p-6 md:p-8 rounded-none border border-zinc-200">
                        <button 
                            onClick={() => setShowDigest(!showDigest)} 
                            className="w-full flex items-center justify-between group outline-none"
                        >
                            <div className="flex items-center gap-3">
                                <Sparkles size={16} className="text-zinc-600" />
                                <span className="text-sm font-[900] lowercase italic font-serif text-zinc-900">
                                    Résumé AI
                                </span>
                            </div>
                            <ChevronRight size={18} className={`text-zinc-400 group-hover:text-zinc-900 transition-transform duration-300 ${showDigest ? "rotate-90" : ""}`} />
                        </button>
                        
                        <AnimatePresence>
                            {showDigest && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }} 
                                    animate={{ height: "auto", opacity: 1 }} 
                                    exit={{ height: 0, opacity: 0 }} 
                                    className="overflow-hidden"
                                >
                                    <div className="pt-6 relative">
                                        <p className="text-[15px] xl:text-[16px] text-zinc-700 font-medium leading-[2.2] xl:leading-[2.4] tracking-wide italic 
                                        before:content-['“'] before:text-4xl before:text-zinc-300 before:absolute before:-top-2 before:-left-2 
                                        after:content-['”'] after:text-4xl after:text-zinc-300 after:absolute after:-bottom-4 after:-right-0 px-2 pb-6">
                                            {data.global_digest}
                                        </p>
                                        
                                        {data.ai_seal && (
                                            <div className="pt-5 mt-4 border-t border-zinc-200 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <ShieldCheck size={14} className="text-zinc-400" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                                                        {data.ai_seal.model}
                                                    </span>
                                                </div>
                                                <div className="text-[9px] font-black tracking-widest text-zinc-400 uppercase">
                                                    Fiabilité {data.ai_seal.precision}%
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </section>
                )}

                {/* YouTube Section */}
                {data?.youtube_videos && data.youtube_videos.length > 0 && (
                    <section className="border-t-2 border-zinc-900 pt-8 mt-12">
                        <button 
                            onClick={() => setShowVideos(!showVideos)} 
                            className="w-full flex items-center justify-between group outline-none mb-6"
                        >
                            <div className="flex items-center gap-3">
                                <Youtube size={18} className="text-zinc-900" />
                                <h2 className="text-sm font-[900] lowercase italic font-serif text-zinc-900">Vidéos</h2>
                            </div>
                            <ChevronRight size={18} className={`text-zinc-400 group-hover:text-zinc-900 transition-transform duration-300 ${showVideos ? "rotate-90" : ""}`} />
                        </button>
                        
                        <AnimatePresence>
                            {showVideos && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }} 
                                    animate={{ height: "auto", opacity: 1 }} 
                                    exit={{ height: 0, opacity: 0 }} 
                                    className="overflow-hidden"
                                >
                                    <div className="flex flex-col gap-5 pt-2 pb-4">
                                        {data.youtube_videos.map((vid, i) => (
                                            <a key={i} href={vid.link} target="_blank" rel="noopener noreferrer" className="group flex flex-col gap-3">
                                                <div className="relative w-full aspect-video bg-zinc-100 overflow-hidden">
                                                    <img src={vid.thumbnail} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={vid.title} loading="lazy" />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                                                        <div className="w-10 h-10 bg-white/90 backdrop-blur flex items-center justify-center rounded-full shadow-lg">
                                                            <Play size={16} fill="black" className="text-black ml-1" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="text-[13px] font-bold line-clamp-2 leading-snug group-hover:text-zinc-500 transition-colors">{vid.title}</h4>
                                                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1.5">{vid.channel}</p>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </section>
                )}

            </div>
        </div>

        {/* Footer */}
        <footer className="mt-24 pt-16 border-t border-zinc-200 text-center space-y-10">
          <ShareMenu data={data} />
          <div className="flex flex-col items-center gap-4">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">
              — {b.endOfBrief} —
            </span>
            <p className="text-[13px] text-zinc-400 font-medium italic max-w-sm mx-auto leading-relaxed">{b.endSub}</p>
          </div>
        </footer>
      </main>

      <BottomNavbar onProfilePreview={handlePreviewData} />
    </div>
  );
}
