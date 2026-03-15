"use client";

import { motion } from "framer-motion";
import { Youtube, Sparkles } from "lucide-react";
import { wizardLabels } from "../../config/translations";
import { useAuth } from "../../context/AuthContext";
import { TRANSITIONS } from "../../config/constants";

interface StepCustomProps {
  youtubeChannels: string;
  setYoutubeChannels: (val: string) => void;
  custom: string;
  setCustom: (val: string) => void;
}

export default function StepCustom({ youtubeChannels, setYoutubeChannels, custom, setCustom }: StepCustomProps) {
  const { user } = useAuth();
  const w = wizardLabels[user?.language || "fr"] || wizardLabels.en;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={TRANSITIONS.fade}>
      <div className="flex flex-col gap-2 mb-10">
        <h3 className="text-2xl font-[850] text-zinc-900 font-serif lowercase italic">Configuration Avancée</h3>
      </div>

      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4 pb-2 border-b border-zinc-100">
          <Youtube size={16} className="text-zinc-400" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-900">{w.step4}</h3>
        </div>
        <textarea
          className="w-full bg-transparent border border-zinc-200 p-6 text-[14px] text-zinc-700 focus:outline-none focus:border-zinc-900 transition-all resize-none font-serif italic"
          placeholder={w.step4Placeholder}
          value={youtubeChannels}
          onChange={(e) => setYoutubeChannels(e.target.value)}
          rows={3}
        />
      </div>

      <div>
        <div className="flex items-center gap-3 mb-4 pb-2 border-b border-zinc-100">
          <Sparkles size={16} className="text-zinc-400" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-900">Ligne Éditioriale Personnalisée</h3>
        </div>
        <textarea
          className="w-full bg-transparent border border-zinc-200 p-6 text-[15px] text-zinc-700 focus:outline-none focus:border-zinc-900 transition-all resize-none font-serif italic"
          placeholder={w.step4Custom}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          rows={5}
        />
      </div>
    </motion.div>
  );
}
