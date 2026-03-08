"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth, API } from "./context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import NewsCard from "./components/NewsCard";
import ProfilePopup from "./components/ProfilePopup";
import HistoryPanel from "./components/HistoryPanel";
import GenerationLoader from "./components/GenerationLoader";
import ShareMenu from "./components/ShareMenu";
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
  Play,
  CheckCircle2
} from "lucide-react";

import { NewsItem, BriefData } from "./types/news";
import { useApi } from "./utils/api";

const CACHE_VERSION = "v1.2"; // Incremented to match new NewsItem schema (is_fused)

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
  { icon: React.ElementType; label: string; color: string; bg: string; description?: string }
> = {
  "Ce que vous avez manqué ce matin": {
    icon: Sparkles,
    label: "Ce que vous avez manqué ce matin",
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    description: "Les news cruciales de ces dernières heures analysées pour vous."
  },
  "L'essentiel de votre secteur": {
    icon: Briefcase,
    label: "L'essentiel de votre secteur",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    description: "Évolutions stratégiques et opportunités dans vos domaines pro."
  },
  "Lecture détente (Passion)": {
    icon: Heart,
    label: "Lecture détente (Passion)",
    color: "text-rose-600",
    bg: "bg-rose-50",
    description: "L'actualité globale et vos centres d'intérêt secondaires."
  },
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
  const sectionsMap = new Map<string, Map<string, NewsItem[]>>();
  const TIERS = [
    "Ce que vous avez manqué ce matin",
    "L'essentiel de votre secteur",
    "Lecture détente (Passion)"
  ];
  TIERS.forEach(t => sectionsMap.set(t, new Map()));

  for (const item of articles) {
    let targetTier = "Lecture détente (Passion)";
    const isHighImpact = item.gate_passed === "impact" || item.category === "Impact" || (item.score && item.score >= 90);
    const isStrategic = ["Business", "Tech", "Security"].includes(item.category) || (item.score && item.score >= 75);

    if (isHighImpact) {
      targetTier = "Ce que vous avez manqué ce matin";
    } else if (isStrategic) {
      targetTier = "L'essentiel de votre secteur";
    }

    const subCat = item.sub_category || "Général";
    const subMap = sectionsMap.get(targetTier)!;
    if (!subMap.has(subCat)) subMap.set(subCat, []);
    subMap.get(subCat)!.push(item);
  }

  const result: { category: string; subGroups: { subCategory: string; items: NewsItem[] }[] }[] = [];
  for (const tier of TIERS) {
    const subMap = sectionsMap.get(tier)!;
    if (subMap.size === 0) continue;

    const subGroups = Array.from(subMap.entries()).map(([subCategory, items]) => ({
      subCategory,
      items
    })).sort((a, b) => {
      const aFused = a.items.some(i => i.is_fused || i.isFused);
      const bFused = b.items.some(i => i.is_fused || i.isFused);
      if (aFused !== bFused) return aFused ? -1 : 1;
      return 0;
    });

    result.push({ category: tier, subGroups });
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
      <AlertCircle size={32} aria-hidden="true" />
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
      <RotateCcw size={18} aria-hidden="true" />
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
  const api = useApi();
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

  useEffect(() => {
    if (!token) return;
    setError(null);

    const fetchBriefData = async () => {
      const cacheKey = `mizan_brief_cache_${selectedDate || 'today'}`;
      let hasCache = false;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsedCache = JSON.parse(cached);
          // Version and structure validation
          const isValid = parsedCache &&
            parsedCache.version === CACHE_VERSION &&
            parsedCache.data &&
            Array.isArray(parsedCache.data.content);

          if (isValid) {
            setData(parsedCache.data);
            setLoading(false);
            hasCache = true;
          } else {
            // Invalid or old cache, clean it
            localStorage.removeItem(cacheKey);
          }
        }
      } catch (e) { }

      try {
        const url = selectedDate ? `/api/brief?date=${selectedDate}` : `/api/brief`;
        const json: BriefData = await api.get(url);

        // Content verification to avoid unnecessary re-renders
        const currentContent = dataRef.current?.content || [];
        const newContent = json.content || [];
        const contentChanged = JSON.stringify(currentContent) !== JSON.stringify(newContent);
        const digestChanged = dataRef.current?.global_digest !== json.global_digest;

        if (contentChanged || digestChanged || !hasCache) {
          setData(json);
          setDismissed(new Set());
          try {
            localStorage.setItem(cacheKey, JSON.stringify({
              version: CACHE_VERSION,
              data: json,
              timestamp: Date.now()
            }));
          } catch (e) { }
        }
      } catch (e: any) {
        if (!dataRef.current || (!dataRef.current.content?.length && !dataRef.current.global_digest)) {
          setError(e.message || "Error fetching data.");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchBriefData();
  }, [token, refreshKey, retryKey, selectedDate, api]);

  useEffect(() => {
    if (!token || !genStatus.active || genStatus.isDone) return;
    const interval = setInterval(async () => {
      try {
        const status = await api.get("/api/brief/status");
        if (status.status === "done") {
          setGenStatus({ active: true, step: "Terminé !", percent: 100, isDone: true });
          setTimeout(() => {
            setGenStatus({ active: false, step: "", percent: 0, isDone: false });
            triggerRefresh();
          }, 2000);
        } else if (status.status === "error") {
          setGenStatus({ active: false, step: "", percent: 0, isDone: false });
          setError("La génération a échoué.");
        } else {
          setGenStatus({ active: true, step: status.step || "Collecte...", percent: status.percent || 10, isDone: false });
        }
      } catch (e) { }
    }, 2000);
    return () => clearInterval(interval);
  }, [token, genStatus.active, genStatus.isDone, setGenStatus, triggerRefresh, api]);

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
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center w-full">
        <main className="w-full max-w-[720px] px-6 sm:px-8 pt-10 sm:pt-12 pb-16 sm:pb-20">
          <div className="flex flex-col items-center pt-3 pb-6 sm:pt-4 sm:pb-8">
            <div className="h-10 sm:h-12 w-3/4 max-w-[320px] bg-gray-200/70 rounded-2xl animate-pulse mb-3" />
            <div className="h-4 w-40 bg-gray-100 rounded-md animate-pulse" />
          </div>
          <div className="flex flex-col gap-10">
            {[1, 2].map((catIdx) => (
              <section key={catIdx}>
                <div className="flex items-center gap-3 pb-6 border-b border-gray-100 mb-6">
                  <div className="w-8 h-8 rounded-xl bg-gray-200/50 animate-pulse shrink-0" />
                  <div className="h-4 w-32 bg-gray-200/60 rounded-lg animate-pulse" />
                </div>
                <div className="flex flex-col gap-4">
                  {[1, 2].map((cardIdx) => (
                    <div key={cardIdx} className="w-full bg-white rounded-[24px] border border-gray-100/60 p-5 shadow-sm h-32 animate-pulse" />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
        <ErrorEmptyState message={error} onRetry={() => { setLoading(true); setError(null); setRetryKey(k => k + 1); }} />
      </div>
    );
  }

  const dateTitle = formatDateTitle(data?.date, lang);
  if (genStatus.active) return <GenerationLoader step={genStatus.step} percent={genStatus.percent} isDone={genStatus.isDone} />;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-gray-900 flex flex-col items-center w-full print:bg-white">
      <div className="fixed top-5 left-5 sm:top-6 sm:left-8 z-40 flex flex-col gap-3 print:hidden">
        <ProfilePopup onPreview={(d) => setData(d)} />
        <HistoryPanel onSelectDate={(date) => { setLoading(true); setSelectedDate(date); }} selectedDate={selectedDate} lang={lang} />
      </div>

      <main className="w-full max-w-[720px] px-6 sm:px-8 pt-10 sm:pt-12 pb-16 sm:pb-20 print:p-0">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-3 pb-6 sm:pt-4 sm:pb-8">
          <h1 className="text-[clamp(1.5rem,4vw,2rem)] font-extrabold tracking-tight text-gray-900 leading-tight">{dateTitle}</h1>
          {data && data.total_kept !== undefined && (
            <p className="mt-3 text-[13px] text-gray-400 font-medium">{data.total_kept} {t.articles} · {data.total_collected || "—"} {t.scanned}</p>
          )}
        </motion.div>

        {data?.global_digest && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <button onClick={() => setShowDigest(!showDigest)} className="group flex flex-col items-center w-full rounded-2xl">
              <div className={`flex items-center gap-2.5 px-5 py-3.5 rounded-2xl border transition-all ${showDigest ? 'bg-white border-indigo-100 mb-4' : 'bg-white border-black/[0.04]'}`}>
                <Sparkles size={15} className={`${showDigest ? 'text-indigo-500' : 'text-gray-400'}`} aria-hidden="true" />
                <span className={`text-[11px] font-bold uppercase tracking-[0.2em] ${showDigest ? 'text-indigo-600' : 'text-gray-400'}`}>
                  {showDigest ? 'Résumé masqué' : 'Afficher le résumé du jour'}
                </span>
                <motion.div animate={{ rotate: showDigest ? 180 : 0 }} aria-hidden="true"><ChevronDown size={14} aria-hidden="true" /></motion.div>
              </div>
            </button>
            <AnimatePresence>
              {showDigest && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="p-6 rounded-3xl bg-indigo-50/30 border border-indigo-100/50">
                    <p className="text-[15px] text-indigo-950/80 font-[450] leading-[1.8]">{data.global_digest}</p>
                    {data.ai_seal && (
                      <div className="mt-4 pt-4 border-t border-indigo-100/50 flex items-center justify-between">
                        <div className="flex items-center gap-2"><Shield size={14} className="text-indigo-400" aria-hidden="true" /><span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">IA Certifiée · {data.ai_seal.model}</span></div>
                        <div className="text-[10px] font-bold text-indigo-600 px-2 py-1 bg-indigo-100/50 rounded flex items-center gap-1"><CheckCircle2 size={12} aria-hidden="true" /> Precision {data.ai_seal.precision}%</div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}

        <div className="flex flex-col gap-10">
          {groupedContent.map((group, gIdx) => {
            const meta = getCategoryMeta(group.category);
            const Ico = meta.icon;
            return (
              <motion.section key={group.category} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + gIdx * 0.08 }}>
                <div className="flex flex-col gap-1 pb-6 border-b border-gray-200/60 mb-8 font-serif">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center shadow-sm`}><Ico size={20} className={meta.color} aria-hidden="true" /></div>
                    <div className="flex flex-col">
                      <span className={`text-[12px] font-black uppercase tracking-[0.25em] ${meta.color}`}>{meta.label}</span>
                      <div className="flex items-center gap-2">
                        {meta.description && <span className="text-[11px] text-gray-400 font-medium">{meta.description}</span>}
                        <span className="w-1 h-1 rounded-full bg-gray-200" />
                        <span className="text-[10px] text-gray-300 font-bold uppercase leading-none">{group.subGroups.reduce((acc, s) => acc + s.items.length, 0)} Analyses</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-8">
                  {group.subGroups.map((sub, sIdx) => (
                    <div key={sub.subCategory} className="flex flex-col gap-5">
                      {sub.subCategory && !["Général", "Actualité", "News", "Divers"].includes(sub.subCategory) && (
                        <div className="flex items-center gap-3 mt-6 mb-2">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50/50 rounded-full border border-indigo-100/30">
                            <Sparkles size={12} className="text-indigo-400" aria-hidden="true" />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-900/60">Pont Cognitif : {sub.subCategory}</h3>
                          </div>
                          <span className="text-[11px] text-gray-400 italic">— {sub.items.length} perspectives</span>
                        </div>
                      )}
                      <div className="relative ml-2 pl-6 border-l border-gray-100/60 mt-4">
                        <div className="absolute -left-[4.5px] top-0 w-2 h-2 rounded-full bg-gray-100 border border-white" />
                        <div className={`grid gap-8 ${sIdx === 0 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
                          <AnimatePresence mode="popLayout">
                            {sub.items.map((article, idx) => {
                              const isFused = article.is_fused || article.isFused;
                              const uniqueKey = isFused ? `fused-${article.title}` : article.link;
                              return (
                                <NewsCard
                                  key={uniqueKey}
                                  item={article}
                                  index={idx}
                                  variant={(sIdx === 0 && idx === 0) || isFused ? "hero" : "compact"}
                                  onDismiss={handleDismiss}
                                />
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.section>
            );
          })}
        </div>

        {data?.youtube_videos && data.youtube_videos.length > 0 && (
          <section className="mt-16">
            <div className="flex items-center gap-3 pb-6 border-b mb-6 font-serif">
              <Youtube size={16} className="text-red-500" aria-hidden="true" />
              <span className="text-sm font-black uppercase tracking-[0.2em] text-red-500">Vidéos YouTube</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.youtube_videos.map((vid, i) => (
                <a key={i} href={vid.link} target="_blank" rel="noopener noreferrer" className="bg-white rounded-2xl border p-2 flex items-center gap-4 hover:shadow-lg transition-all">
                  <div className="relative w-32 h-[72px] rounded-xl overflow-hidden bg-gray-100 shrink-0">
                    <Image src={vid.thumbnail} fill className="object-cover" alt={vid.title} sizes="128px" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/5"><Play fill="white" size={14} className="text-white" aria-hidden="true" /></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-bold line-clamp-2 leading-tight mb-1">{vid.title}</h4>
                    <span className="text-[11px] text-gray-500 font-semibold">{vid.channel}</span>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {visibleContent.length > 0 && (
          <footer className="mt-16 text-center flex flex-col items-center gap-2">
            <div className="w-10 h-px bg-gray-200 mb-8" />
            <ShareMenu data={data} />
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mt-8">{t.endOfBrief}</p>
            <p className="text-[13px] text-gray-400 opacity-60">{t.endSub}</p>
          </footer>
        )}
      </main>
    </div>
  );
}
