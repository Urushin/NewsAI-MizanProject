"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, API } from "./context/AuthContext";
import { useRouter } from "next/navigation";
import ProfilePopup from "./components/ProfilePopup";
import NotInterested from "./components/NotInterested";
import HistoryPanel from "./components/HistoryPanel";

interface NewsItem {
  title: string;
  category: string;
  summary: string;
  score: number;
  link: string;
  keep: boolean;
}

interface BriefData {
  date: string;
  generated_at: string;
  total_collected: number;
  total_kept: number;
  duration_seconds: number;
  content: NewsItem[];
}

// i18n strings
const i18n: Record<string, Record<string, string>> = {
  fr: {
    loading: "Chargement du briefing…",
    retained: "articles retenus sur",
    analyzed: "analysés",
    endOfBrief: "Fin du briefing",
    nothingToday: "Rien de pertinent aujourd'hui. Profitez de votre journée.",
    noData: "Aucun briefing disponible. Lancez la génération.",
  },
  en: {
    loading: "Loading briefing…",
    retained: "articles kept out of",
    analyzed: "analyzed",
    endOfBrief: "End of briefing",
    nothingToday: "Nothing relevant today. Enjoy your day.",
    noData: "No briefing available yet. Generate one first.",
  },
  ja: {
    loading: "ブリーフィングを読み込み中…",
    retained: "件の記事を保持",
    analyzed: "件を分析",
    endOfBrief: "ブリーフィング終了",
    nothingToday: "今日は関連性のあるニュースはありません。良い一日を。",
    noData: "ブリーフィングはまだありません。生成してください。",
  },
};

function toBullets(summary: string): string[] {
  return summary
    .split(/\.\s+/)
    .map((s) => s.replace(/\.$/, "").trim())
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

  // Fetch brief from API — re-fetches when refreshKey or selectedDate changes
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
      .then((res) => res.json())
      .then((json: BriefData) => {
        setData(json);
        setDismissed(new Set());
        setLoading(false);

        // Auto-generate for new users: if brief is empty and not viewing history
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
            .then((r) => r.json())
            .then(() => {
              // Re-fetch the newly generated brief
              return fetch(`${API}/api/brief`, {
                headers: { Authorization: `Bearer ${token}` },
              });
            })
            .then((r) => r.json())
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

  // Date formatting per language
  const dateLocale = lang === "ja" ? "ja-JP" : lang === "fr" ? "fr-FR" : "en-US";

  // If a date is selected from history, display it; otherwise show today
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

  const categoryOrder = [
    "Tech & IA",
    "Investissement & Crypto",
    "Politique & Monde",
    "Culture & Manga",
    "Sport & Combat",
    "Niche",
  ];

  // Filter dismissed articles
  const visibleContent = data?.content.filter(
    (item) => !dismissed.has(item.title)
  );

  const grouped = visibleContent?.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, NewsItem[]>);

  const sortedCats = grouped
    ? Object.keys(grouped).sort(
      (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
    )
    : [];

  if (authLoading) return null;
  if (!user) return null;

  let globalIndex = 0;

  return (
    <main
      style={{
        maxWidth: "780px",
        margin: "0 auto",
        padding: "100px 32px 120px",
        position: "relative",
      }}
    >
      {/* Profile Avatar — top left */}
      <div style={{ position: "fixed", top: "24px", left: "24px", zIndex: 1000 }}>
        <ProfilePopup onPreview={(previewData) => {
          setData(previewData);
          setLoading(false);
          setDismissed(new Set());
          // Optional: Scroll to top
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }} />
        <HistoryPanel
          onSelectDate={setSelectedDate}
          selectedDate={selectedDate}
          lang={lang}
        />
      </div>

      {/* ── Header ─────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        style={{ marginBottom: "80px" }}
      >
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-lighter)",
            marginBottom: "8px",
          }}
        >
          Mizan.ai
        </p>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "42px",
            fontWeight: 400,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            color: "var(--text)",
            margin: 0,
            textTransform: "capitalize",
          }}
        >
          {displayDate}
        </h1>
        {data && data.total_kept > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            style={{
              fontSize: "14px",
              color: "var(--text-light)",
              marginTop: "12px",
            }}
          >
            {data.total_kept} {t.retained} {data.total_collected} {t.analyzed}
          </motion.p>
        )}
      </motion.header>

      {/* ── Loading ────────────────────────────────── */}
      {loading && (
        <div style={{ color: "var(--text-light)", fontSize: "15px" }}>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {t.loading}
          </motion.p>
        </div>
      )}

      {/* ── News Feed ──────────────────────────────── */}
      {!loading &&
        grouped &&
        sortedCats.map((category) => {
          const items = grouped[category];

          return (
            <section key={category} style={{ marginBottom: "64px" }}>
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: globalIndex * 0.06 }}
                style={{
                  borderBottom: "1px solid var(--separator)",
                  paddingBottom: "8px",
                  marginBottom: "32px",
                }}
              >
                <span
                  style={{
                    fontSize: "12px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--text-light)",
                    fontWeight: 500,
                  }}
                >
                  {category}
                </span>
              </motion.div>

              <AnimatePresence>
                {items.map((item) => {
                  const currentIndex = globalIndex++;
                  const bullets = toBullets(item.summary);

                  return (
                    <motion.article
                      key={item.link}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{
                        duration: 0.4,
                        delay: currentIndex * 0.06,
                      }}
                      style={{ marginBottom: "40px" }}
                      className="article-item"
                    >
                      {/* Title */}
                      <h2
                        style={{
                          fontFamily: "var(--font-serif)",
                          fontSize: "24px",
                          fontWeight: 500,
                          letterSpacing: "-0.02em",
                          lineHeight: 1.35,
                          color: "var(--text)",
                          margin: "0 0 10px 0",
                        }}
                      >
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: "inherit",
                            textDecoration: "none",
                          }}
                        >
                          {item.title}
                        </a>
                      </h2>

                      {/* Bullet Points */}
                      <ul
                        style={{
                          listStyle: "none",
                          padding: 0,
                          margin: 0,
                        }}
                      >
                        {bullets.map((bullet, bIdx) => (
                          <li
                            key={bIdx}
                            style={{
                              fontSize: "16px",
                              lineHeight: 1.75,
                              color: "#555555",
                              paddingLeft: "16px",
                              position: "relative",
                              marginBottom: "2px",
                            }}
                          >
                            <span
                              style={{
                                position: "absolute",
                                left: 0,
                                color: "var(--text-lighter)",
                              }}
                            >
                              –
                            </span>
                            {bullet}
                          </li>
                        ))}
                      </ul>

                      {/* Not Interested Button */}
                      <div className="not-interested-wrapper">
                        <NotInterested
                          articleTitle={item.title}
                          onDismissed={() => handleDismiss(item.title)}
                          lang={lang}
                        />
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </section>
          );
        })}

      {/* ── End ────────────────────────────────────── */}
      {!loading && data && visibleContent && visibleContent.length > 0 && (
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          style={{
            textAlign: "center",
            paddingTop: "40px",
            borderTop: "1px solid var(--separator)",
          }}
        >
          <p
            style={{
              fontSize: "14px",
              color: "var(--text-lighter)",
              fontStyle: "italic",
              fontFamily: "var(--font-serif)",
            }}
          >
            {t.endOfBrief}
          </p>
        </motion.footer>
      )}

      {/* ── Empty ──────────────────────────────────── */}
      {!loading && data && data.total_kept === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ marginTop: "60px" }}
        >
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "20px",
              color: "var(--text-light)",
              fontStyle: "italic",
            }}
          >
            {t.nothingToday}
          </p>
        </motion.div>
      )}

      {!loading && !data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ marginTop: "60px" }}
        >
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "20px",
              color: "var(--text-light)",
              fontStyle: "italic",
            }}
          >
            {t.noData}
          </p>
        </motion.div>
      )}
    </main>
  );
}
