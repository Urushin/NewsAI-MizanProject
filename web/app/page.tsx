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

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════ */

export default function Home() {
  const { user, token, loading: authLoading, refreshKey } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
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
    fetch(`${API}/api/brief`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json: BriefData) => {
        const cur = dataRef.current;
        if (json.content && json.content.length > 0) {
          setData(json); setDismissed(new Set());
        } else if (!cur || !cur.content || cur.content.length === 0) {
          setData(json); setDismissed(new Set());
        }
        setLoading(false);
        if (!hasTriedGenerate.current && (!json.content || json.content.length === 0) && !json.generated_at) {
          hasTriedGenerate.current = true;
          setLoading(true);
          fetch(`${API}/api/brief/generate`, { method: "POST", headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then(() => fetch(`${API}/api/brief`, { headers: { Authorization: `Bearer ${token}` } }))
            .then((r) => r.json())
            .then((fresh: BriefData) => { setData(fresh); setLoading(false); })
            .catch(() => setLoading(false));
        }
      })
      .catch(() => setLoading(false));
  }, [token, refreshKey]);

  const handleDismiss = useCallback((title: string) => {
    setDismissed((prev) => new Set(prev).add(title));
  }, []);

  const visibleContent = useMemo(
    () => (data?.content || []).filter((item) => !dismissed.has(item.title)),
    [data, dismissed]
  );
  const groupedContent = useMemo(() => groupByCategory(visibleContent), [visibleContent]);

  if (authLoading || !user) return null;

  const dateTitle = formatDateTitle(data?.date, lang);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-gray-900 font-sans selection:bg-indigo-100 flex flex-col items-center w-full">

      {/* ── FLOATING PROFILE BUTTON (top-left) ──────── */}
      <div className="fixed top-5 left-5 sm:top-6 sm:left-8 z-40">
        <ProfilePopup onPreview={(d) => setData(d)} />
      </div>

      {/* ── MAIN ───────────────────────────────────────── */}
      <main className="w-full max-w-[720px] px-6 sm:px-8 pt-10 sm:pt-12 pb-16 sm:pb-20">

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-32 text-gray-400 text-sm font-medium">
            <Sparkles size={20} className="text-indigo-500 animate-pulse" />
            {t.loading}
          </div>
        ) : (
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
                      {/* Category separator — thin subtle line + label */}
                      <div className={`flex items-center gap-3 pb-5 ${gIdx === 0 ? 'pt-0' : 'pt-8 mt-2 border-t border-gray-200/60'}`}>
                        <Ico size={14} className={`${meta.color} opacity-60`} />
                        <span className={`text-[11px] font-bold uppercase tracking-[0.1em] ${meta.color} opacity-70`}>
                          {meta.label}
                        </span>
                        <span className="text-[11px] text-gray-300 font-medium">
                          {group.items.length}
                        </span>
                      </div>

                      {/* Articles — flowing like a journal */}
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
              /* ── EMPTY STATE ─────────────────────────── */
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

            {/* ── END-OF-BRIEF FOOTER ─────────────────── */}
            {visibleContent.length > 0 && (
              <motion.footer
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-16 sm:mt-20 pt-8 pb-4"
              >
                <div className="w-10 h-px bg-gray-200 mx-auto mb-8" />
                <div className="text-center flex flex-col items-center gap-2">
                  <div className="w-4 h-4 rounded-[3px] bg-gray-900 opacity-15 mb-1" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400">
                    {t.endOfBrief}
                  </p>
                  <p className="text-[13px] text-gray-400 opacity-60 max-w-[280px]">
                    {t.endSub}
                  </p>
                </div>
              </motion.footer>
            )}
          </>
        )}
      </main>
    </div>
  );
}
