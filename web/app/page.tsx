"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth, API } from "./context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import NewsCard from "./components/NewsCard";
import ProfilePopup from "./components/ProfilePopup";
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
} from "lucide-react";

/* ── Types ─────────────────────────────────────────── */

interface NewsItem {
  title: string;
  localized_title?: string;
  category: string;
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

function groupByCategory(articles: NewsItem[]): { category: string; items: NewsItem[] }[] {
  const map = new Map<string, NewsItem[]>();
  for (const item of articles) {
    const cat = item.category || "Passion";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(item);
  }
  const groups: { category: string; items: NewsItem[] }[] = [];
  // Impact first
  if (map.has("Impact")) {
    groups.push({ category: "Impact", items: map.get("Impact")! });
    map.delete("Impact");
  }
  for (const [cat, items] of map) {
    groups.push({ category: cat, items });
  }
  return groups;
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
  const { user, token, loading: authLoading, refreshKey } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

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
        const res = await fetch(`${API}/api/brief`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let json: BriefData = await res.json();

        const cur = dataRef.current;
        if ((json.content && json.content.length > 0) || !cur?.content || cur.content.length === 0) {
          setData(json);
          setDismissed(new Set());
        }

        setLoading(false);

        // Auto-generate if first login and empty brief
        if (!hasTriedGenerate.current && (!json.content || json.content.length === 0) && !json.generated_at) {
          hasTriedGenerate.current = true;
          setLoading(true);

          const genRes = await fetch(`${API}/api/brief/generate`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
          });

          if (!genRes.ok) throw new Error(`Generation failed: ${genRes.status}`);

          const freshRes = await fetch(`${API}/api/brief`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (freshRes.ok) {
            json = await freshRes.json();
            setData(json);
          } else {
            throw new Error(`Failed to fetch fresh brief: ${freshRes.status}`);
          }
        }
      } catch (e: any) {
        console.error("Failed to fetch briefing:", e);
        setError(e.message || "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchBriefData();
  }, [token, refreshKey, retryKey]);

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

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-gray-900 font-sans selection:bg-indigo-100 flex flex-col items-center w-full">

      {/* ── FLOATING PROFILE BUTTON (top-left) ──────── */}
      <div className="fixed top-5 left-5 sm:top-6 sm:left-8 z-40">
        <ProfilePopup onPreview={(d) => setData(d)} />
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

          {/* ── EDITORIAL DIGEST ────────────────────── */}
          {data && data.global_digest && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-7 sm:mb-8 p-4 sm:p-5 rounded-xl bg-white border border-black/[0.04] shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-indigo-500 opacity-70" />
                <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">
                  {t.briefTitle}
                </h2>
              </div>
              <p className="text-[14px] text-gray-600 font-[450] leading-[1.75]">
                {data.global_digest}
              </p>
            </motion.section>
          )}

          {/* ── ARTICLES GROUPED BY CATEGORY ────────── */}
          {groupedContent.length > 0 ? (
            <div className="flex flex-col">
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
                    <div className={`flex items-center gap-3 pb-5 ${gIdx === 0 ? 'pt-0' : 'pt-8 mt-2 border-t border-gray-200/60'}`}>
                      <Ico size={14} className={`${meta.color} opacity-60`} />
                      <span className={`text-[11px] font-bold uppercase tracking-[0.1em] ${meta.color} opacity-70`}>
                        {meta.label}
                      </span>
                      <span className="text-[11px] text-gray-300 font-medium">
                        {group.items.length}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <AnimatePresence>
                        {group.items.map((article, idx) => (
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
