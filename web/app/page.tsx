"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth, API } from "./context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import NewsCard from "./components/NewsCard";
import ProfilePopup from "./components/ProfilePopup";
import HistoryPanel from "./components/HistoryPanel";
import GenerationLoader from "./components/GenerationLoader";
import {
  Sparkles,
  Zap,
  Heart,
  Globe,
  TrendingUp,
  Shield,
  Cpu,
  Landmark,
  Briefcase,
  Newspaper,
  Coffee,
  AlertCircle,
  RotateCcw,
  ChevronDown,
  Youtube,
  Play
} from "lucide-react";

/* ── Types ─────────────────────────────────────────── */

interface NewsItem {
  title: string;
  localized_title?: string;
  category: string;
  sub_category?: string;
  summary: string | string[];
  score: number;
  link: string;
  keep: boolean;
  gate_passed?: string;
  reason?: string;
  credibility_score?: number;
}

interface BriefData {
  date: string;
  generated_at: string;
  total_collected: number;
  total_kept: number;
  duration_seconds: number;
  global_digest?: string;
  content: NewsItem[];
  youtube_videos?: {
    title: string;
    link: string;
    channel: string;
    thumbnail: string;
    published: string;
  }[];
}

/* ── i18n ──────────────────────────────────────────── */

const i18n: Record<string, Record<string, string>> = {
  fr: {
    loading: "Chargement du briefing…",
    nothingToday: "Aucune actualité pertinente pour aujourd'hui.",
    noData: "Aucun briefing disponible pour le moment.",
    nothingSub: "Revenez plus tard ou ajustez vos centres d'intérêt.",
    noDataSub: "Lancez une édition depuis votre profil.",
    endOfBrief: "Fin du briefing",
    endSub: "Vous êtes à jour. Revenez demain pour de nouvelles actualités.",
    articles: "articles",
    scanned: "sources analysées",
    briefTitle: "Le Briefing du Jour",
  },
  en: {
    loading: "Loading briefing…",
    nothingToday: "Nothing relevant today.",
    noData: "No briefing available yet.",
    nothingSub: "Come back later or adjust your interests.",
    noDataSub: "Generate your first briefing from your profile.",
    endOfBrief: "End of briefing",
    endSub: "You're all caught up. Come back tomorrow.",
    articles: "articles",
    scanned: "sources scanned",
    briefTitle: "Today's Briefing",
  },
};

/* ── Category metadata ─────────────────────────────── */

const CATEGORY_META: Record<
  string,
  { icon: React.ElementType; label: string; color: string; bg: string }
> = {
  Impact: { icon: Zap, label: "Impact Direct", color: "text-red-500", bg: "bg-red-50" },
  Passion: { icon: Heart, label: "Passion", color: "text-indigo-500", bg: "bg-indigo-50" },
  Tech: { icon: Cpu, label: "Technologie", color: "text-cyan-500", bg: "bg-cyan-50" },
  Politik: { icon: Landmark, label: "Politique", color: "text-amber-500", bg: "bg-amber-50" },
  Business: { icon: Briefcase, label: "Business", color: "text-emerald-500", bg: "bg-emerald-50" },
  World: { icon: Globe, label: "International", color: "text-violet-500", bg: "bg-violet-50" },
  Security: { icon: Shield, label: "Sécurité", color: "text-red-500", bg: "bg-red-50" },
  Trending: { icon: TrendingUp, label: "Tendances", color: "text-pink-500", bg: "bg-pink-50" },
};

function getCategoryMeta(cat: string) {
  return CATEGORY_META[cat] || { icon: Newspaper, label: cat || "Actualité", color: "text-indigo-500", bg: "bg-indigo-50" };
}

/* ── Date formatting ───────────────────────────────── */

function formatDateTitle(dateStr?: string, lang = "fr"): string {
  try {
    const d = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
    const locale = lang === "fr" ? "fr-FR" : lang === "ja" ? "ja-JP" : "en-US";
    const formatted = d.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return new Date().toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
}

/* ── Group articles by category ────────────────────── */

function groupByCategory(articles: NewsItem[]) {
  const mainGroupsMap = new Map<string, Map<string, NewsItem[]>>();

  for (const item of articles) {
    const cat = item.category || "Passion";
    const subCat = item.sub_category || "Général";

    if (!mainGroupsMap.has(cat)) mainGroupsMap.set(cat, new Map());
    const subMap = mainGroupsMap.get(cat)!;

    if (!subMap.has(subCat)) subMap.set(subCat, []);
    subMap.get(subCat)!.push(item);
  }

  const result: { category: string; subGroups: { subCategory: string; items: NewsItem[] }[] }[] = [];

  // Custom sorting: Impact first
  const sortedCats = Array.from(mainGroupsMap.keys()).sort((a, b) => {
    if (a === "Impact") return -1;
    if (b === "Impact") return 1;
    return a.localeCompare(b);
  });

  for (const cat of sortedCats) {
    const subMap = mainGroupsMap.get(cat)!;
    const subGroups = Array.from(subMap.entries()).map(([subCategory, items]) => ({
      subCategory,
      items
    }));
    result.push({ category: cat, subGroups });
  }

  return result;
}

/* ── Error State Component ────────────────────────── */

const ErrorEmptyState = ({ message, onRetry }: { message: string, onRetry: () => void }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center justify-center py-20 px-6 text-center"
  >
    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-red-100">
      <AlertCircle size={32} />
    </div>
    <h3 className="text-xl font-bold text-gray-900 mb-2">Oups, une petite interférence !</h3>
    <p className="text-gray-500 max-w-sm mb-8 leading-relaxed">
      {message.includes("401") || message.includes("403")
        ? "Votre session a peut-être expiré. Essayez de vous reconnecter."
        : "Nous n'avons pas pu récupérer votre briefing. Cela arrive parfois quand les serveurs prennent un café."}
    </p>
    <button
      onClick={onRetry}
      className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-full font-semibold shadow-xl shadow-indigo-100/50 hover:bg-indigo-700 active:scale-95 transition-all"
    >
      <RotateCcw size={18} />
      Réessayer maintenant
    </button>
  </motion.div>
);

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */

export default function Home() {
  const { user, token, loading: authLoading, refreshKey, genStatus, setGenStatus, triggerRefresh } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDigest, setShowDigest] = useState(false);

  const lang = user?.language || "fr";
  const t = i18n[lang] || i18n.en;

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  const dataRef = useRef<BriefData | null>(null);
  useEffect(() => { dataRef.current = data; }, [data]);

  const hasTriedGenerate = useRef(false);

  useEffect(() => {
    if (!token) return;
    setError(null);

    const fetchBriefData = async () => {
      try {
        const url = selectedDate
          ? `${API}/api/brief?date=${selectedDate}`
          : `${API}/api/brief`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let json: BriefData = await res.json();

        const cur = dataRef.current;
        if ((json.content && json.content.length > 0) || !cur?.content || cur.content.length === 0) {
          setData(json);
          setDismissed(new Set());
        }
      } catch (e: any) {
        console.error("Failed to fetch briefing:", e);
        setError(e.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchBriefData();
  }, [token, refreshKey, retryKey, selectedDate]);

  // Polling for generation status
  useEffect(() => {
    if (!token || !genStatus.active || genStatus.isDone) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/brief/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const status = await res.json();

        if (status.status === "done") {
          setGenStatus({ active: true, step: "Terminé !", percent: 100, isDone: true });
          setTimeout(() => {
            setGenStatus({ active: false, step: "", percent: 0, isDone: false });
            triggerRefresh(); // Reload data
          }, 2000);
        } else if (status.status === "error") {
          setGenStatus({ active: false, step: "", percent: 0, isDone: false });
          setError("La génération a échoué. Veuillez réessayer.");
        } else {
          setGenStatus({
            active: true,
            step: status.step || "Collecte...",
            percent: status.percent || 10,
            isDone: false
          });
        }
      } catch (e) {
        console.error("Status check failed", e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [token, genStatus.active, genStatus.isDone, setGenStatus, triggerRefresh]);

  const handleDismiss = useCallback((title: string) => {
    setDismissed((prev) => new Set(prev).add(title));
  }, []);

  const visibleContent = useMemo(
    () => (data?.content || []).filter((item) => !dismissed.has(item.title)),
    [data, dismissed]
  );
  const groupedContent = useMemo(() => groupByCategory(visibleContent), [visibleContent]);

  if (loading || authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-2xl flex flex-col gap-6"
        >
          <div className="flex justify-between items-end mb-4">
            <div className="h-10 w-48 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-6 w-32 bg-gray-100 rounded-md animate-pulse" />
          </div>
          <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-5/6 bg-gray-100 rounded animate-pulse" />
          <div className="space-y-4 mt-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 w-full bg-white border border-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
        <ErrorEmptyState
          message={error}
          onRetry={() => {
            setLoading(true);
            setError(null);
            setRetryKey(k => k + 1);
          }}
        />
      </div>
    );
  }

  const dateTitle = formatDateTitle(data?.date, lang);

  if (genStatus.active) {
    return <GenerationLoader step={genStatus.step} percent={genStatus.percent} isDone={genStatus.isDone} />;
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-gray-900 font-sans selection:bg-indigo-100 flex flex-col items-center w-full">

      {/* ── FLOATING PROFILE BUTTON (top-left) ──────── */}
      <div className="fixed top-5 left-5 sm:top-6 sm:left-8 z-40 flex flex-col gap-3">
        <ProfilePopup onPreview={(d) => setData(d)} />
        <HistoryPanel
          onSelectDate={(date) => {
            setLoading(true);
            setSelectedDate(date);
          }}
          selectedDate={selectedDate}
          lang={lang}
        />
      </div>

      {/* ── MAIN ───────────────────────────────────────── */}
      <main className="w-full max-w-[720px] px-6 sm:px-8 pt-10 sm:pt-12 pb-16 sm:pb-20">
        <>
          {/* ── DATE TITLE ──────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center pt-3 pb-6 sm:pt-4 sm:pb-8"
          >
            <h1 className="text-[clamp(1.5rem,4vw,2rem)] font-extrabold tracking-tight text-gray-900 leading-tight">
              {dateTitle}
            </h1>
            {data && data.total_kept !== undefined && (
              <p className="mt-3 text-[13px] text-gray-400 font-medium">
                {data.total_kept} {t.articles} · {data.total_collected || "—"} {t.scanned}
              </p>
            )}
          </motion.div>

          {/* ── EDITORIAL DIGEST (COLLAPSIBLE) ────── */}
          {data && data.global_digest && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-8"
            >
              <button
                onClick={() => setShowDigest(!showDigest)}
                className="group flex flex-col items-center w-full focus:outline-none focus:ring-2 focus:ring-indigo-100 rounded-2xl transition-all"
              >
                <div className={`
                  flex items-center gap-2.5 px-5 py-3.5 rounded-2xl border transition-all duration-300
                  ${showDigest
                    ? 'bg-white border-indigo-100 shadow-[0_10px_30px_-10px_rgba(99,102,241,0.1)] mb-4'
                    : 'bg-white border-black/[0.04] shadow-sm hover:border-indigo-100 hover:shadow-md'
                  }
                `}>
                  <Sparkles size={15} className={`${showDigest ? 'text-indigo-500' : 'text-gray-400'} opacity-75 transition-colors`} />
                  <span className={`text-[11px] font-bold uppercase tracking-[0.2em] ${showDigest ? 'text-indigo-600' : 'text-gray-400'} transition-colors`}>
                    {showDigest ? 'Résumé masqué' : 'Afficher le résumé du jour'}
                  </span>
                  <motion.div
                    animate={{ rotate: showDigest ? 180 : 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <ChevronDown size={14} className={`${showDigest ? 'text-indigo-500' : 'text-gray-400'} opacity-50`} />
                  </motion.div>
                </div>
              </button>

              <AnimatePresence>
                {showDigest && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
                    className="overflow-hidden"
                  >
                    <div className="p-6 rounded-3xl bg-indigo-50/30 border border-indigo-100/50">
                      <p className="text-[15px] text-indigo-950/80 font-[450] leading-[1.8] text-justify hyphens-auto">
                        {data.global_digest}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          )}

          {/* ── ARTICLES GROUPED BY CATEGORY ────────── */}
          {groupedContent.length > 0 ? (
            <div className="flex flex-col gap-10">
              {groupedContent.map((group, gIdx) => {
                const meta = getCategoryMeta(group.category);
                const Ico = meta.icon;
                return (
                  <motion.section
                    key={group.category}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.12 + gIdx * 0.08 }}
                  >
                    {/* Main Category Header */}
                    <div className="flex items-center gap-3 pb-6 border-b border-gray-200/60 mb-6 font-serif">
                      <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center`}>
                        <Ico size={16} className={`${meta.color}`} />
                      </div>
                      <span className={`text-sm font-black uppercase tracking-[0.2em] ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>

                    <div className="flex flex-col gap-8">
                      {group.subGroups.map((sub, sIdx) => (
                        <div key={sub.subCategory} className="flex flex-col gap-4">
                          {/* Sub Category Tag */}
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-[2px] bg-gray-200 rounded-full" />
                            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                              {sub.subCategory}
                            </h3>
                            <span className="text-[10px] bg-gray-50 text-gray-400 px-1.5 py-0.5 rounded border border-black/[0.03] font-medium">
                              {sub.items.length}
                            </span>
                          </div>

                          <div className="flex flex-col gap-1">
                            <AnimatePresence>
                              {sub.items.map((article, idx) => (
                                <NewsCard
                                  key={`${article.link}-${idx}`}
                                  item={article}
                                  index={idx}
                                  token={token}
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
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-24 sm:py-32"
            >
              <Coffee size={32} className="mx-auto mb-6 text-gray-300" />
              <p className="text-lg font-bold text-gray-500 mb-2">
                {data?.total_kept === 0 ? t.nothingToday : t.noData}
              </p>
              <p className="text-sm text-gray-400 max-w-xs mx-auto leading-relaxed">
                {data?.total_kept === 0 ? t.nothingSub : t.noDataSub}
              </p>
            </motion.div>
          )}

          {/* ── YOUTUBE VIDEOS ────────── */}
          {data?.youtube_videos && data.youtube_videos.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-12 sm:mt-16"
            >
              <div className="flex items-center gap-3 pb-6 border-b border-gray-200/60 mb-6 font-serif">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                  <Youtube size={16} className="text-red-500" />
                </div>
                <span className="text-sm font-black uppercase tracking-[0.2em] text-red-500">
                  Vidéos YouTube
                </span>
                <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded border border-red-100 font-bold ml-auto">
                  {data.youtube_videos.length} Récentes
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.youtube_videos.map((vid, i) => (
                  <a
                    key={`yt-${i}`}
                    href={vid.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block bg-white rounded-2xl border border-black/[0.04] p-2 hover:shadow-lg hover:shadow-red-500/5 transition-all outline-none focus:ring-2 focus:ring-red-500 overflow-hidden"
                  >
                    <div className="flex items-center gap-4">
                      {/* Image container */}
                      <div className="relative w-32 min-w-[128px] h-[72px] rounded-xl overflow-hidden bg-gray-100 shrink-0">
                        <img
                          src={vid.thumbnail}
                          alt="Miniature YouTube"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-8 h-8 rounded-full bg-red-600/90 text-white flex items-center justify-center backdrop-blur-sm shadow-md">
                            <Play fill="currentColor" size={14} className="ml-0.5" />
                          </div>
                        </div>
                      </div>

                      {/* Texts */}
                      <div className="flex-1 min-w-0 py-1 pr-2">
                        <h4 className="text-[13px] font-bold tracking-tight text-gray-900 leading-[1.3] line-clamp-2 mb-1.5 group-hover:text-red-600 transition-colors">
                          {vid.title}
                        </h4>
                        <div className="flex items-center gap-1.5 opacity-70">
                          <div className="w-4 h-4 rounded-full bg-gray-100 text-[10px] flex items-center justify-center font-bold text-gray-500 overflow-hidden">
                            {vid.channel.charAt(0)}
                          </div>
                          <span className="text-[11px] font-semibold text-gray-500 truncate">
                            {vid.channel}
                          </span>
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </motion.section>
          )}

          {/* ── FOOTER ────────── */}
          {visibleContent.length > 0 && (
            <motion.footer
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-16 sm:mt-20 pt-8 pb-4 text-center flex flex-col items-center gap-2"
            >
              <div className="w-10 h-px bg-gray-200 mx-auto mb-8" />
              <div className="w-4 h-4 rounded-[3px] bg-gray-900 opacity-15 mb-1" />
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400">
                {t.endOfBrief}
              </p>
              <p className="text-[13px] text-gray-400 opacity-60 max-w-[280px]">
                {t.endSub}
              </p>
            </motion.footer>
          )}
        </>
      </main>
    </div>
  );
}
