"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Youtube, Search, X, Loader2, Link, MessageSquare } from "lucide-react";
import { wizardLabels } from "../../config/translations";
import { useAuth } from "../../context/AuthContext";
import { useApi } from "../../utils/api";
import { TRANSITIONS } from "../../config/constants";

interface StepCustomProps {
  youtubeChannels: string;
  setYoutubeChannels: (val: string) => void;
  rssFeeds: string;
  setRssFeeds: (val: string) => void;
  subreddits: string;
  setSubreddits: (val: string) => void;
}

interface YTChannel {
    id: string;
    title: string;
    thumbnail: string;
    handle?: string;
}

interface RedditSub {
    id: string;
    title: string;
    thumbnail?: string;
    subscribers?: number;
}

export default function StepCustom({ 
  youtubeChannels, setYoutubeChannels, 
  rssFeeds, setRssFeeds, 
  subreddits, setSubreddits 
}: StepCustomProps) {
  const { user } = useAuth();
  const api = useApi();
  const w = wizardLabels[user?.language || "fr"] || wizardLabels.en;

  // YouTube States
  const [ytQuery, setYtQuery] = useState("");
  const [ytResults, setYtResults] = useState<YTChannel[]>([]);
  const [searchingYt, setSearchingYt] = useState(false);
  const [selectedYt, setSelectedYt] = useState<YTChannel[]>([]);

  // RSS States
  const [rssUrl, setRssUrl] = useState("");
  const [selectedRss, setSelectedRss] = useState<string[]>([]);

  // Reddit States
  const [redditQuery, setRedditQuery] = useState("");
  const [redditResults, setRedditResults] = useState<RedditSub[]>([]);
  const [searchingReddit, setSearchingReddit] = useState(false);
  const [selectedReddit, setSelectedReddit] = useState<RedditSub[]>([]);

  // --- 🎥 YouTube Debounce ---
  useEffect(() => {
      const trimmed = ytQuery.trim();
      if (!trimmed) { setYtResults([]); return; }
      const delay = setTimeout(() => {
          setSearchingYt(true);
          api.get(`/api/youtube/search?q=${encodeURIComponent(trimmed)}`)
             .then((data: YTChannel[]) => setYtResults(data || []))
             .catch(() => setYtResults([]))
             .finally(() => setSearchingYt(false));
      }, 500);
      return () => clearTimeout(delay);
  }, [ytQuery, api]);

  // --- 🤖 Reddit Debounce ---
  useEffect(() => {
      const trimmed = redditQuery.trim();
      if (!trimmed) { setRedditResults([]); return; }
      const delay = setTimeout(() => {
          setSearchingReddit(true);
          api.get(`/api/reddit/search?q=${encodeURIComponent(trimmed)}`)
             .then((data: RedditSub[]) => setRedditResults(data || []))
             .catch(() => setRedditResults([]))
             .finally(() => setSearchingReddit(false));
      }, 500);
      return () => clearTimeout(delay);
  }, [redditQuery, api]);

  // --- Sync Back up to OnboardingWizard strings ---
  useEffect(() => {
      setYoutubeChannels(selectedYt.map(c => c.title).join("\n"));
  }, [selectedYt, setYoutubeChannels]);

  useEffect(() => {
      setRssFeeds(selectedRss.join("\n"));
  }, [selectedRss, setRssFeeds]);

  useEffect(() => {
      setSubreddits(selectedReddit.map(r => r.title.replace("r/", "")).join("\n"));
  }, [selectedReddit, setSubreddits]);

  // Handler helpers
  const handleAddRss = () => {
      const trimmed = rssUrl.trim();
      if (trimmed && !selectedRss.includes(trimmed)) {
          setSelectedRss(prev => [...prev, trimmed]);
          setRssUrl("");
      }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={TRANSITIONS.fade}>
      <div className="flex flex-col gap-2 mb-8">
        <h3 className="text-2xl font-[850] text-zinc-900 font-serif lowercase italic">Sources de Veille</h3>
        <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest">Abonnez-vous à vos flux préférés</p>
      </div>

      <div className="space-y-12 h-[60vh] overflow-y-auto custom-scrollbar pr-2">
        
        {/* 🎥 YouTube Section */}
        <div>
            <div className="flex items-center gap-3 mb-4 pb-2 border-b border-zinc-100">
              <Youtube size={16} className="text-zinc-600" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-900">{w.step4 || "Chaînes YouTube"}</h3>
            </div>

            <div className="flex flex-wrap gap-2.5 mb-3">
                {selectedYt.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 bg-zinc-900 text-white pl-1.5 pr-2.5 py-1.5 rounded-full shadow-sm">
                        {c.thumbnail && <img src={c.thumbnail} className="w-5 h-5 rounded-full object-cover" />}
                        <span className="text-[11px] font-black">{c.title}</span>
                        <button type="button" onClick={() => setSelectedYt(prev => prev.filter(x => x.id !== c.id))} className="text-white/50 hover:text-white"><X size={12} /></button>
                    </div>
                ))}
            </div>

            <div className="relative">
                <div className="absolute left-4 top-4 text-zinc-400">{searchingYt ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}</div>
                <input type="text" className="w-full bg-transparent border border-zinc-200 pl-11 pr-4 py-3 text-[14px] font-serif italic focus:outline-none focus:border-zinc-900" placeholder="Rechercher une chaîne YouTube..." value={ytQuery} onChange={(e) => setYtQuery(e.target.value)} />
                {ytResults.length > 0 && (
                    <div className="absolute top-[110%] left-0 right-0 bg-white border border-zinc-200 shadow-2xl z-50 max-h-[220px] overflow-y-auto divide-y divide-zinc-100">
                        {ytResults.map(c => (
                            <button key={c.id} type="button" onClick={() => { if (!selectedYt.some(x => x.id === c.id)) setSelectedYt(p => [...p, c]); setYtQuery(""); setYtResults([]); }} className="w-full flex items-center gap-3 p-3 hover:bg-zinc-50 text-left">
                                <img src={c.thumbnail} className="w-8 h-8 rounded-full border border-zinc-100" />
                                <div className="flex flex-col"><span className="text-sm font-black text-zinc-900">{c.title}</span><span className="text-[10px] text-zinc-400">{c.handle}</span></div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* 🤖 Reddit Section */}
        <div>
            <div className="flex items-center gap-3 mb-4 pb-2 border-b border-zinc-100">
              <MessageSquare size={16} className="text-zinc-600" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-900">Forums Reddit</h3>
            </div>

            <div className="flex flex-wrap gap-2.5 mb-3">
                {selectedReddit.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 bg-orange-600 text-white pl-1.5 pr-2.5 py-1.5 rounded-full shadow-sm">
                        {r.thumbnail ? <img src={r.thumbnail} className="w-5 h-5 rounded-full object-cover" /> : <div className="w-5 h-5 rounded-full bg-orange-700 flex items-center justify-center text-[8px] font-black">r/</div>}
                        <span className="text-[11px] font-black">{r.title}</span>
                        <button type="button" onClick={() => setSelectedReddit(prev => prev.filter(x => x.id !== r.id))} className="text-white/50 hover:text-white"><X size={12} /></button>
                    </div>
                ))}
            </div>

            <div className="relative">
                <div className="absolute left-4 top-4 text-zinc-400">{searchingReddit ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}</div>
                <input type="text" className="w-full bg-transparent border border-zinc-200 pl-11 pr-4 py-3 text-[14px] font-serif italic focus:outline-none focus:border-zinc-900" placeholder="Rechercher un Subreddit (ex: technology, intelligence...)" value={redditQuery} onChange={(e) => setRedditQuery(e.target.value)} />
                {redditResults.length > 0 && (
                    <div className="absolute top-[110%] left-0 right-0 bg-white border border-zinc-200 shadow-2xl z-50 max-h-[220px] overflow-y-auto divide-y divide-zinc-100">
                        {redditResults.map(r => (
                            <button key={r.id} type="button" onClick={() => { if (!selectedReddit.some(x => x.id === r.id)) setSelectedReddit(p => [...p, r]); setRedditQuery(""); setRedditResults([]); }} className="w-full flex items-center gap-3 p-3 hover:bg-zinc-50 text-left">
                                {r.thumbnail ? <img src={r.thumbnail} className="w-8 h-8 rounded-full border border-zinc-100" /> : <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 text-xs font-bold">r/</div>}
                                <div className="flex flex-col"><span className="text-sm font-black text-zinc-900">{r.title}</span><span className="text-[10px] text-zinc-400">{r.subscribers?.toLocaleString()} inscrits</span></div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* 🔗 Flux RSS Section */}
        <div>
            <div className="flex items-center gap-3 mb-4 pb-2 border-b border-zinc-100">
              <Link size={16} className="text-zinc-600" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-900">Flux RSS / URLs de sites</h3>
            </div>

            <div className="flex flex-wrap gap-2.5 mb-3">
                {selectedRss.map((url, i) => (
                    <div key={i} className="flex items-center gap-2 bg-zinc-100 border border-zinc-200 text-zinc-800 px-3 py-1.5 rounded-full shadow-sm max-w-[200px] truncate">
                        <span className="text-[11px] font-bold truncate">{url}</span>
                        <button type="button" onClick={() => setSelectedRss(prev => prev.filter(x => x !== url))} className="text-zinc-400 hover:text-zinc-900"><X size={12} /></button>
                    </div>
                ))}
            </div>

            <div className="flex gap-2">
                <input type="text" className="w-full bg-transparent border border-zinc-200 px-4 py-3 text-[14px] font-serif italic focus:outline-none focus:border-zinc-900 h-11" placeholder="Coller un flux RSS ou URL (ex: https://monsite.com/rss)" value={rssUrl} onChange={(e) => setRssUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddRss()} />
                <button type="button" onClick={handleAddRss} className="bg-zinc-900 text-white px-5 text-[11px] font-black uppercase tracking-widest hover:bg-black transition-colors">Ajouter</button>
            </div>
        </div>

      </div>
    </motion.div>
  );
}
