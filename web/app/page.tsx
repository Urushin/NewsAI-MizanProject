"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth, API } from "./context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import NewsCard from "./components/NewsCard";
import ProfilePopup from "./components/ProfilePopup";
import { Search, Sparkles } from "lucide-react";

interface NewsItem {
  title: string;
  category: string;
  summary: string;
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

const i18n: Record<string, Record<string, string>> = {
  fr: {
    loading: "Chargement du briefing…",
    nothingToday: "Rien de pertinent aujourd'hui.",
    noData: "Aucun briefing disponible.",
  },
  en: {
    loading: "Loading briefing…",
    nothingToday: "Nothing relevant today.",
    noData: "No briefing available yet.",
  }
};

export default function Home() {
  const { user, token, loading: authLoading, refreshKey } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const lang = user?.language || "fr";
  const t = i18n[lang] || i18n.en;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  const hasTriedGenerate = useRef(false);

  useEffect(() => {
    if (!token) return;

    // We fetch the brief
    fetch(`${API}/api/brief`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: BriefData) => {
        setData(json);
        setDismissed(new Set());
        setLoading(false);

        // Auto generation on first open if empty
        if (!hasTriedGenerate.current && (!json.content || json.content.length === 0) && !json.generated_at) {
          hasTriedGenerate.current = true;
          setLoading(true);
          fetch(`${API}/api/brief/generate`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => r.json())
            .then(() => fetch(`${API}/api/brief`, { headers: { Authorization: `Bearer ${token}` } }))
            .then((r) => r.json())
            .then((fresh: BriefData) => {
              setData(fresh);
              setLoading(false);
            })
            .catch(() => setLoading(false));
        }
      })
      .catch(() => setLoading(false));
  }, [token, refreshKey]);

  const handleDismiss = useCallback((title: string) => {
    setDismissed((prev) => new Set(prev).add(title));
  }, []);

  if (authLoading || !user) return null;

  const visibleContent = (data?.content || []).filter(
    (item: NewsItem) => !dismissed.has(item.title)
  );

  return (
    <div className="min-h-screen bg-[#F9F9F9] text-gray-900 font-sans selection:bg-indigo-100 flex flex-col items-center w-full">

      {/* HEADER FIXE MINIMALISTE */}
      <header className="fixed top-0 left-0 right-0 z-40 h-16 flex items-center bg-[#F9F9F9]/80 backdrop-blur-md">
        <div className="max-w-2xl mx-auto w-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 opacity-80 hover:opacity-100 transition-opacity cursor-default">
            <div className="w-5 h-5 rounded-sm bg-gray-900" />
            <h1 className="text-base font-bold tracking-tight text-gray-900">mizan</h1>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-gray-400 hover:text-black transition-colors rounded-full hover:bg-black/5" title="Search">
              <Search size={18} />
            </button>
            <ProfilePopup onPreview={(d) => setData(d)} />
          </div>
        </div>
      </header>

      {/* CONTENU CENTRALISÉ */}
      <main className="w-full max-w-2xl px-6 pt-28 pb-24">

        {loading ? (
          <div className="flex py-20 items-center justify-center text-gray-400 gap-3 text-sm font-medium">
            <Sparkles size={16} className="text-indigo-500 animate-pulse" />
            {t.loading}
          </div>
        ) : (
          <>
            {/* RÉSUMÉ ÉDITORIAL (Bordures sobres) */}
            {data && data.global_digest && (
              <motion.section
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12 p-6 rounded-xl border border-gray-200 bg-white/40 space-y-4"
              >
                <div className="flex items-center gap-2 text-gray-400">
                  <Sparkles size={14} />
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-900">Le Briefing du Jour</h2>
                </div>

                <p className="text-[17px] text-gray-800 font-medium leading-[1.8]">
                  {data.global_digest}
                </p>

                <div className="flex items-center gap-6 pt-2 opacity-50">
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-widest text-gray-500">Articles</span>
                    <span className="text-xs font-bold text-gray-900">{data.total_kept}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-widest text-gray-500">Scannés</span>
                    <span className="text-xs font-bold text-gray-900">{data.total_collected}</span>
                  </div>
                </div>
              </motion.section>
            )}

            {/* FLUX D'ARTICLES */}
            {(visibleContent.length > 0) ? (
              <section className="divide-y divide-gray-100">
                <AnimatePresence>
                  {visibleContent.map((article: NewsItem, idx: number) => (
                    <NewsCard key={`${article.link}-${idx}`} item={article} index={idx} token={token} onDismiss={handleDismiss} />
                  ))}
                </AnimatePresence>
              </section>
            ) : (
              <div className="py-20 text-center text-gray-400 italic font-medium">
                {data?.total_kept === 0 ? t.nothingToday : t.noData}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
