"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { History, Calendar, ChevronRight, X, Clock } from "lucide-react";
import { useApi } from "../utils/api";

interface HistoryEntry {
    date: string;
    total_kept: number;
    total_collected: number;
}

import { historyLabels, commonLabels } from "../config/translations";
import { TRANSITIONS } from "../config/constants";

interface Props {
    onSelectDate: (date: string | null) => void;
    selectedDate: string | null;
    lang: string;
}

function formatHistoryDate(dateStr: string, lang: string): string {
    const parts = dateStr.split("_");
    const datePart = parts[0];
    const timePart = parts[1];

    const [y, m, d] = datePart.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const locale = lang === "fr" ? "fr-FR" : "en-US";

    const formattedDate = date.toLocaleDateString(locale, {
        weekday: "short",
        day: "numeric",
        month: "short",
    });

    if (timePart) {
        const [h, min] = timePart.split("-");
        const hFmt = lang === "fr" ? "h" : ":";
        return `${formattedDate} (${h}${hFmt}${min})`;
    }
    return formattedDate;
}

export default function HistoryPanel({ onSelectDate, selectedDate, lang }: Props) {
    const { token } = useAuth();
    const api = useApi();
    const [open, setOpen] = useState(false);
    const [dates, setDates] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const t = historyLabels[lang] || historyLabels.en;
    const c = commonLabels[lang] || commonLabels.en;

    useEffect(() => {
        if (!open || !token) return;
        setLoading(true);
        api.get("/api/brief/history")
            .then((data: { dates: HistoryEntry[] }) => {
                setDates(data.dates || []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [open, token, api]);

    const todayStr = new Date().toISOString().slice(0, 10);

    const formattedEntries = useMemo(() => {
        return dates.map(entry => ({
            ...entry,
            label: formatHistoryDate(entry.date, lang),
            isSelected: entry.date === selectedDate,
            isMainToday: entry.date === todayStr
        }));
    }, [dates, lang, selectedDate, todayStr]);

    return (
        <div className="relative">
            <motion.button
                whileTap={{ scale: 0.95 }}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all bg-zinc-950 text-white shadow-xl hover:bg-black group ${open ? 'ring-2 ring-zinc-200' : ''}`}
                onClick={() => setOpen((o) => !o)}
                aria-label={t.title}
                title={t.title}
            >
                <History size={16} />
            </motion.button>

            <AnimatePresence>
                {open && (
                    <>
                      <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-[150] bg-zinc-950/40 backdrop-blur-sm"
                          onClick={() => setOpen(false)}
                      />
                      <motion.div
                          initial={{ opacity: 0, scale: 0.98, x: -10 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.98, x: -10 }}
                          transition={TRANSITIONS.spring}
                          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:absolute sm:top-0 sm:left-14 sm:translate-x-0 sm:translate-y-0 z-[160] w-[90vw] max-w-[320px] bg-[#FDFCF8] rounded-none shadow-2xl border border-zinc-200 p-8 flex flex-col"
                          ref={panelRef}
                      >
                          <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-200">
                              <h3 className="text-[11px] font-[900] text-zinc-900 flex items-center gap-3 uppercase tracking-[0.2em] font-sans">
                                  <Clock size={16} className="text-zinc-400" />
                                  Archives
                              </h3>
                              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-900">
                                  <X size={20} />
                              </button>
                          </div>

                          {selectedDate && (
                              <button
                                  className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-100 text-zinc-900 text-[10px] font-black uppercase tracking-widest mb-6 hover:bg-zinc-200 transition-colors"
                                  onClick={() => {
                                      onSelectDate(null);
                                      setOpen(false);
                                  }}
                              >
                                  <ChevronRight size={14} className="rotate-180" />
                                  Retour Aujourd'hui
                              </button>
                          )}

                          <div className="flex-1 max-h-[400px] overflow-y-auto custom-scrollbar -mx-4 px-4 space-y-0">
                              {loading ? (
                                  [1, 2, 3].map(i => (
                                      <div key={i} className="h-16 border-b border-zinc-100 animate-pulse" />
                                  ))
                              ) : dates.length === 0 ? (
                                  <div className="py-20 text-center">
                                      <Calendar size={24} className="mx-auto text-zinc-200 mb-4" />
                                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest leading-relaxed">{t.empty}</p>
                                  </div>
                              ) : (
                                  formattedEntries.map((entry) => (
                                      <button
                                          key={entry.date}
                                          className={`w-full text-left py-5 border-b border-zinc-100 flex justify-between items-center transition-all group ${entry.isSelected ? "opacity-100" : "opacity-60 hover:opacity-100"}`}
                                          onClick={() => {
                                              onSelectDate(entry.isMainToday ? null : entry.date);
                                              setOpen(false);
                                          }}
                                      >
                                           <div className="flex flex-col gap-1">
                                               <p className={`text-[15px] font-[700] text-zinc-900 font-serif ${entry.isSelected ? "underline underline-offset-4 decoration-zinc-900" : ""}`}>
                                                   {entry.label}
                                               </p>
                                               <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                                                   {entry.total_kept} Articles • {entry.total_collected} Sources
                                               </p>
                                           </div>
                                          <ChevronRight size={14} className={`transition-transform duration-300 group-hover:translate-x-1 ${entry.isSelected ? 'text-zinc-900' : 'text-zinc-300'}`} />
                                      </button>
                                  ))
                              )}
                          </div>
                      </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
