"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { wizardLabels } from "../../config/translations";
import { useAuth } from "../../context/AuthContext";
import { TRANSITIONS } from "../../config/constants";

interface StepEditorialProps {
  custom: string;
  setCustom: (val: string) => void;
}

export default function StepEditorial({ custom, setCustom }: StepEditorialProps) {
  const { user } = useAuth();
  const w = wizardLabels[user?.language || "fr"] || wizardLabels.en;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={TRANSITIONS.fade}>
      <div className="flex flex-col gap-2 mb-8">
        <h3 className="text-2xl font-[850] text-zinc-900 font-serif lowercase italic">Ligne Éditioriale</h3>
        <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest">Affinage de vos préférences de rédaction</p>
      </div>

      <div>
        <div className="flex items-center gap-3 mb-4 pb-2 border-b border-zinc-100">
          <Sparkles size={16} className="text-zinc-400" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-900">Notes de Rédaction Personnalisées</h3>
        </div>
        <textarea
          className="w-full bg-transparent border border-zinc-200 p-6 text-[15px] text-zinc-700 focus:outline-none focus:border-zinc-900 transition-all resize-none font-serif italic"
          placeholder={w.step4Custom}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          rows={8}
        />
      </div>
    </motion.div>
  );
}
