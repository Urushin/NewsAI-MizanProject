"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  ExternalLink, 
  Database, 
  Search, 
  CheckCircle, 
  History, 
  Globe,
  Loader2
} from "lucide-react";

import { useApi } from "../utils/api";
import { sourcesLabels, commonLabels } from "../config/translations";
import BottomNavbar from "../components/BottomNavbar";
import { usePlatform } from "../../hooks/usePlatform";


interface ScannedSource {
    title: string;
    link: string;
}

export default function SourcesPage() {
    const { user, token, loading: authLoading } = useAuth();
    const { isNative } = usePlatform();
    const api = useApi();
    const router = useRouter();
    const [rawSources, setRawSources] = useState<ScannedSource[]>([]);
    const [usedSources, setUsedSources] = useState<ScannedSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState<"used" | "raw">("used");

    const lang = user?.language || "fr";
    const s = sourcesLabels[lang] || sourcesLabels.en;
    const c = commonLabels[lang] || commonLabels.en;

    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!token) return;
        api.get("/api/brief/sources")
            .then(data => {
                setRawSources(data.raw_articles || []);
                setUsedSources(data.used_articles || []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [token, api]);

    const activeList = activeTab === "used" ? usedSources : rawSources;

    const filtered = useMemo(() => {
      return activeList.filter(s =>
          (s.title || "").toLowerCase().includes(search.toLowerCase()) ||
          (s.link || "").toLowerCase().includes(search.toLowerCase())
      );
    }, [activeList, search]);

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FDFCF8]">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="animate-spin text-zinc-900" size={24} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{c.loading}</span>
                </div>
            </div>
        );
    }

  if (isNative) {
    return (
        <main className="min-h-screen bg-[#FDFCF8] text-zinc-900 flex flex-col items-center w-full pb-36 safe-top safe-bottom select-none">
            
            {/* Header */}
            <div className="w-full px-8 pt-8 pb-4 flex justify-between items-center bg-[#FDFCF8]">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 font-sans">
                  Sources
                </h1>
                <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 border border-zinc-200">
                    <Database size={10} className="text-zinc-600" />
                    <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Index</span>
                </div>
            </div>

            <div className="w-full px-8 mt-6">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                    
                    {/* Search Bar Capsule */}
                    <div className="relative w-full mb-6 flex items-center bg-white border border-zinc-100 rounded-full px-4 py-3.5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] focus-within:border-zinc-300 transition-colors">
                        <Search className="text-zinc-400 mr-3" size={16} />
                        <input
                            type="text"
                            placeholder={s.searchPlaceholder}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-transparent text-[14px] font-bold text-zinc-900 focus:outline-none placeholder:text-zinc-400 placeholder:font-sans"
                        />
                    </div>

                    {/* Filter Tabs Capsule */}
                    <div className="flex bg-zinc-50 border border-zinc-200/60 p-0.5 rounded-full w-full h-11 mb-6">
                        <button
                            onClick={() => setActiveTab("used")}
                            className={`flex-1 flex items-center justify-center gap-2 rounded-full py-1 text-[10px] font-black uppercase tracking-widest transition-all ${
                                activeTab === "used" ? "bg-white text-zinc-950 shadow-sm font-black" : "text-zinc-400 hover:text-zinc-600"
                            }`}
                        >
                            <CheckCircle size={14} />
                            {s.tabUsed} ({usedSources.length})
                        </button>
                        <button
                            onClick={() => setActiveTab("raw")}
                            className={`flex-1 flex items-center justify-center gap-2 rounded-full py-1 text-[10px] font-black uppercase tracking-widest transition-all ${
                                activeTab === "raw" ? "bg-white text-zinc-950 shadow-sm font-black" : "text-zinc-400 hover:text-zinc-600"
                            }`}
                        >
                            <History size={14} />
                            {s.tabGlobal} ({rawSources.length})
                        </button>
                    </div>

                    {/* Sources List */}
                    <AnimatePresence mode="wait">
                      <motion.div 
                        key={activeTab + search}
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="space-y-3"
                      >
                          {filtered.length > 0 ? (
                              filtered.map((item, idx) => {
                                  let hostname = "";
                                  try {
                                      hostname = new URL(item.link).hostname;
                                  } catch (e) {}

                                  return (
                                      <motion.div 
                                        key={idx} 
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: Math.min(idx * 0.01, 0.2) }}
                                        className="bg-white border border-zinc-100 p-4 rounded-[20px] flex items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.015)]"
                                      >
                                          {/* Logo and texts */}
                                          <div className="flex items-center gap-4 flex-1 min-w-0">
                                              {hostname && (
                                                  <div className="relative w-9 h-9 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0">
                                                      <img 
                                                          src={`https://www.google.com/s2/favicons?sz=64&domain=${hostname}`} 
                                                          className="w-5 h-5 object-contain" 
                                                          alt="source favicon" 
                                                      />
                                                  </div>
                                              )}
                                              <div className="min-w-0">
                                                  <h3 className="text-[14px] font-bold text-zinc-900 truncate font-sans">
                                                      {item.title ? item.title.replace(/^Source\s*\(Synthèse\)\s*:\s*/i, "") : "Donnée Anonyme"}
                                                  </h3>
                                                  <p className="text-[10px] font-bold text-zinc-400 truncate mt-0.5 tracking-tight uppercase font-mono">
                                                      {hostname}
                                                  </p>
                                              </div>
                                          </div>
                                          
                                          {/* Immersive external link button */}
                                          <a
                                              href={item.link}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="w-9 h-9 rounded-full bg-zinc-50 hover:bg-zinc-100 flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-colors shrink-0 ml-4 active:scale-90"
                                          >
                                              <ExternalLink size={14} />
                                          </a>
                                      </motion.div>
                                  );
                              })
                          ) : (
                              <div className="py-20 text-center">
                                  <Search size={24} className="mx-auto text-zinc-300 mb-6" />
                                  <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">{s.noResults}</p>
                              </div>
                          )}
                      </motion.div>
                    </AnimatePresence>
                </motion.div>
            </div>
            
            {/* Navigation Menu */}
            <BottomNavbar />
        </main>
    );
  }

    return (
        <main className="min-h-screen bg-[#FDFCF8] text-zinc-900 flex flex-col items-center w-full pb-32">
            
            {/* Minimal Header */}
            <div className="w-full max-w-4xl px-6 pt-10 pb-6 flex items-center justify-between sticky top-0 bg-[#FDFCF8]/90 backdrop-blur-md z-50">
                <button
                    onClick={() => router.back()}
                    className="group flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                    <ArrowLeft size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{c.back}</span>
                </button>
                <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 border border-zinc-200">
                    <Database size={12} className="text-zinc-600" />
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Index</span>
                </div>
            </div>

            <div className="w-full max-w-4xl px-6 md:px-12 mt-12">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                    
                    <header className="mb-14 border-b-2 border-zinc-900 pb-10">
                      <h1 className="text-4xl md:text-5xl lg:text-[64px] font-[900] tracking-tighter text-zinc-900 mb-4 font-serif leading-[1]">
                          Sources
                      </h1>
                      <p className="text-zinc-500 text-[15px] font-medium leading-relaxed max-w-xl italic">
                          Toutes les informations scrutées et utilisées par notre système IA pour construire l'édition du jour.
                      </p>
                    </header>

                    <div className="flex flex-col md:flex-row gap-8 items-start md:items-center justify-between mb-10">
                        {/* Filter Tabs */}
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setActiveTab("used")}
                                 className={`flex items-center gap-2 px-5 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "used" ? "bg-zinc-900 text-white shadow-sm" : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"}`}
                            >
                                <CheckCircle size={14} />
                                {s.tabUsed} ({usedSources.length})
                            </button>
                            <button
                                onClick={() => setActiveTab("raw")}
                                className={`flex-center gap-2 px-5 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "raw" ? "bg-zinc-900 text-white shadow-sm" : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"}`}
                            >
                                <History size={14} />
                                {s.tabGlobal} ({rawSources.length})
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="relative w-full md:w-auto min-w-[300px] group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-zinc-900 transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder={s.searchPlaceholder}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-transparent border-b border-zinc-300 py-3 pl-12 pr-4 text-[15px] font-medium text-zinc-900 focus:outline-none focus:border-zinc-900 transition-colors placeholder:text-zinc-400"
                            />
                        </div>
                    </div>

                    {/* Sources List */}
                    <AnimatePresence mode="wait">
                      <motion.div 
                        key={activeTab + search}
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="space-y-0"
                      >
                          {filtered.length > 0 ? (
                              filtered.map((item, idx) => (
                                  <motion.div 
                                    key={idx} 
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: Math.min(idx * 0.02, 0.4) }}
                                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-6 border-b border-zinc-200 hover:bg-zinc-50/50 px-4 -mx-4 transition-colors"
                                  >
                                      <div className="flex-1 min-w-0 pr-4 pl-2">
                                          <h3 className="text-[15px] font-[600] text-zinc-900 truncate group-hover:text-zinc-600 transition-colors font-serif">
                                              {item.title ? item.title.replace(/^Source\s*\(Synthèse\)\s*:\s*/i, "") : "Donnée Anonyme"}
                                          </h3>
                                          <p className="text-[12px] font-medium text-zinc-400 truncate mt-1 tracking-tight">
                                              {new URL(item.link).hostname}
                                          </p>
                                      </div>
                                      <a
                                          href={item.link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 flex items-center gap-2 pr-2 transition-colors ml-2 sm:ml-0"
                                      >
                                          Consulter l'article <ExternalLink size={12} />
                                      </a>
                                  </motion.div>
                              ))
                          ) : (
                              <div className="py-24 text-center">
                                  <Search size={24} className="mx-auto text-zinc-300 mb-6" />
                                  <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">{s.noResults}</p>
                              </div>
                          )}
                      </motion.div>
                    </AnimatePresence>
                </motion.div>
            </div>
            <BottomNavbar />
        </main>
    );
}
