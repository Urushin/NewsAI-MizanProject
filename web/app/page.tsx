"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, API } from "./context/AuthContext";
import { useRouter } from "next/navigation";
import ProfilePopup from "./components/ProfilePopup";
import NewsCard from "./components/NewsCard";
import HistoryPanel from "./components/HistoryPanel";
import { Sparkles, BarChart3, FileText } from "lucide-react";

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

// i18n strings
const i18n: Record<string, Record<string, string>> = {
  fr: {
    loading: "Chargement du briefing…",
    retained: "retenus",
    analyzed: "analysés",
    endOfBrief: "Fin du briefing",
    nothingToday: "Rien de pertinent aujourd'hui. Profitez de votre journée.",
    noData: "Aucun briefing disponible. Lancez la génération.",
    briefTitle: "Daily Briefing",
    keyTakeaways: "À retenir",
    alertsTitle: "Alertes & Impacts Directs",
    deepDiveTitle: "Pour approfondir",
  },
  en: {
    loading: "Loading briefing…",
    retained: "kept",
    analyzed: "analyzed",
    endOfBrief: "End of briefing",
    nothingToday: "Nothing relevant today. Enjoy your day.",
    noData: "No briefing available yet. Generate one first.",
    briefTitle: "Daily Briefing",
    keyTakeaways: "Key Takeaways",
    alertsTitle: "Alerts & Direct Impact",
    deepDiveTitle: "Deep Dive",
  },
  ja: {
    loading: "ブリーフィングを読み込み中…",
    retained: "件保持",
    analyzed: "件分析",
    endOfBrief: "ブリーフィング終了",
    nothingToday: "今日は関連性のあるニュースはありません。良い一日を。",
    noData: "ブリーフィングはまだありません。生成してください。",
    briefTitle: "デイリーブリーフィング",
    keyTakeaways: "要点",
    alertsTitle: "アラート＆直接影響",
    deepDiveTitle: "深掘り",
  },
};

// Helpers
function digestToBullets(digest: string): string[] {
  // Split on sentence boundaries for better bullet points
  return digest
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
}

export default function Home() {
  const { user, token, loading: authLoading, refreshKey } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const lang = user?.language || "fr";
  const t = i18n[lang] || i18n.en;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  // Fetch brief from API
  const hasTriedGenerate = useRef(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const url = selectedDate
      ? `${API}/api/brief?date=${selectedDate}`
      : `${API}/api/brief`;
    fetch(url, {
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

        // Auto-generate for new users
        if (
          !selectedDate &&
          !hasTriedGenerate.current &&
          (!json.content || json.content.length === 0) &&
          !json.generated_at
        ) {
          hasTriedGenerate.current = true;
          setLoading(true);
          fetch(`${API}/api/brief/generate`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => {
              if (!r.ok) throw new Error(`Generate HTTP ${r.status}`);
              return r.json();
            })
            .then(() => {
              return fetch(`${API}/api/brief`, {
                headers: { Authorization: `Bearer ${token}` },
              });
            })
            .then((r) => {
              if (!r.ok) throw new Error(`Refresh HTTP ${r.status}`);
              return r.json();
            })
            .then((fresh: BriefData) => {
              setData(fresh);
              setLoading(false);
            })
            .catch(() => setLoading(false));
        }
      })
      .catch(() => setLoading(false));
  }, [token, refreshKey, selectedDate]);

  const handleDismiss = useCallback((title: string) => {
    setDismissed((prev) => new Set(prev).add(title));
  }, []);

  // Date formatting
  const dateLocale = lang === "ja" ? "ja-JP" : lang === "fr" ? "fr-FR" : "en-US";

  const displayDate = selectedDate
    ? new Date(
      parseInt(selectedDate.slice(0, 4)),
      parseInt(selectedDate.slice(5, 7)) - 1,
      parseInt(selectedDate.slice(8, 10))
    ).toLocaleDateString(dateLocale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    : new Date().toLocaleDateString(dateLocale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  // Filter dismissed articles
  const visibleContent = (data?.content || []).filter(
    (item: NewsItem) => !dismissed.has(item.title)
  );

  const impactArticles = visibleContent.filter((item: NewsItem) => item.category === "Impact" || item.gate_passed === "impact");
  const passionArticles = visibleContent.filter((item: NewsItem) => item.category === "Passion" || item.gate_passed === "interest").sort((a: NewsItem, b: NewsItem) => b.score - a.score);

  if (authLoading) return null;
  if (!user) return null;

  const digestBullets = data?.global_digest ? digestToBullets(data.global_digest) : [];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0b0f15 0%, #111826 40%, #0f1520 100%)",
      }}
      className="flex justify-center w-full"
    >
      <main className="w-full max-w-3xl px-6 sm:px-12 pt-[100px] pb-[120px] relative">
        {/* ── Profile Avatar — top left ── */}
        <div className="fixed top-6 left-6 z-[1000]">
          <ProfilePopup onPreview={(previewData) => {
            setData(previewData);
            setLoading(false);
            setDismissed(new Set());
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }} />
          <HistoryPanel
            onSelectDate={setSelectedDate}
            selectedDate={selectedDate}
            lang={lang}
          />
        </div>

        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: "48px" }}
        >
          {/* Small date */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            style={{
              fontSize: "13px",
              color: "var(--text-muted)",
              textTransform: "capitalize",
              letterSpacing: "0.05em",
              marginBottom: "8px",
            }}
          >
            {displayDate}
          </motion.p>

          {/* Main Title */}
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(28px, 5vw, 40px)",
              fontWeight: 600,
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
              marginBottom: "4px",
            }}
          >
            {t.briefTitle}
          </h1>

          {/* Subtitle with brand */}
          <p style={{
            fontSize: "14px",
            color: "var(--text-muted)",
            marginBottom: "20px",
          }}>
            Édition personnalisée <span style={{ color: "var(--accent-amber)", fontWeight: 500 }}>Mizan.ai</span>
          </p>

          {/* Stats pills */}
          {data && data.total_kept > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}
            >
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 14px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 500,
                background: "var(--accent-green-muted)",
                color: "var(--accent-green)",
                border: "1px solid rgba(34, 197, 94, 0.15)",
              }}>
                <FileText size={13} />
                {data.total_kept} {t.retained}
              </span>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 14px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 500,
                background: "rgba(100, 116, 139, 0.1)",
                color: "var(--text-secondary)",
                border: "1px solid rgba(100, 116, 139, 0.1)",
              }}>
                <BarChart3 size={13} />
                {data.total_collected} {t.analyzed}
              </span>
            </motion.div>
          )}
        </motion.header>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ padding: "40px 0" }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                justifyContent: "center",
                color: "var(--text-muted)",
                fontSize: "15px",
              }}
            >
              <Sparkles size={16} style={{ color: "var(--accent-amber)" }} />
              {t.loading}
            </motion.div>
          </div>
        )}

        {/* ── Key Takeaways (À Retenir) — Bullet Points ── */}
        {!loading && data && data.global_digest && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            style={{
              marginBottom: "40px",
              padding: "24px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "16px",
              boxShadow: "var(--shadow-card)",
              borderLeft: "3px solid var(--accent-amber)",
            }}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "16px",
            }}>
              <Sparkles size={14} style={{ color: "var(--accent-amber)" }} />
              <span style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--accent-amber)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}>
                {t.keyTakeaways}
              </span>
            </div>
            <ul style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}>
              {digestBullets.map((bullet, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "flex-start",
                    fontSize: "14.5px",
                    lineHeight: 1.7,
                    color: "var(--text-secondary)",
                  }}
                >
                  <span style={{
                    display: "inline-block",
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    background: "var(--accent-amber)",
                    marginTop: "9px",
                    flexShrink: 0,
                  }} />
                  {bullet}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* ── Alerts & Impact Section ── */}
        {!loading && impactArticles.length > 0 && (
          <section style={{ marginBottom: "40px" }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "20px",
              }}
            >
              <h2 style={{
                fontFamily: "var(--font-serif)",
                fontSize: "18px",
                fontWeight: 600,
                color: "var(--text-primary)",
                letterSpacing: "-0.01em",
              }}>
                {t.alertsTitle}
              </h2>
              <div style={{
                flex: 1,
                height: "1px",
                background: "linear-gradient(90deg, var(--border-medium), transparent)",
              }} />
            </motion.div>
            <AnimatePresence>
              {impactArticles.map((item: NewsItem, idx: number) => (
                <NewsCard key={`${item.link}-${idx}`} item={item} index={idx} token={token} onDismiss={handleDismiss} />
              ))}
            </AnimatePresence>
          </section>
        )}

        {/* ── Deep Dive Section ── */}
        {!loading && passionArticles.length > 0 && (
          <section style={{ marginBottom: "40px" }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "20px",
              }}
            >
              <h2 style={{
                fontFamily: "var(--font-serif)",
                fontSize: "18px",
                fontWeight: 600,
                color: "var(--text-primary)",
                letterSpacing: "-0.01em",
              }}>
                {t.deepDiveTitle}
              </h2>
              <div style={{
                flex: 1,
                height: "1px",
                background: "linear-gradient(90deg, var(--border-medium), transparent)",
              }} />
            </motion.div>
            <AnimatePresence>
              {passionArticles.map((item: NewsItem, idx: number) => (
                <NewsCard key={`${item.link}-${idx}`} item={item} index={idx} token={token} onDismiss={handleDismiss} />
              ))}
            </AnimatePresence>
          </section>
        )}

        {/* ── End Marker ── */}
        {!loading && data && visibleContent && visibleContent.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{
              marginTop: "48px",
              paddingBottom: "40px",
              textAlign: "center",
            }}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              justifyContent: "center",
              marginBottom: "8px",
            }}>
              <div style={{ width: "40px", height: "1px", background: "var(--border-subtle)" }} />
              <span style={{ fontSize: "11px", color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {t.endOfBrief}
              </span>
              <div style={{ width: "40px", height: "1px", background: "var(--border-subtle)" }} />
            </div>
          </motion.div>
        )}

        {/* ── Empty States ── */}
        {!loading && data && data.total_kept === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ marginTop: "80px", textAlign: "center" }}
          >
            <p style={{
              fontFamily: "var(--font-serif)",
              fontSize: "22px",
              color: "var(--text-muted)",
              fontStyle: "italic",
            }}>
              {t.nothingToday}
            </p>
          </motion.div>
        )}

        {!loading && !data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ marginTop: "80px", textAlign: "center" }}
          >
            <p style={{
              fontFamily: "var(--font-serif)",
              fontSize: "22px",
              color: "var(--text-muted)",
              fontStyle: "italic",
            }}>
              {t.noData}
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
