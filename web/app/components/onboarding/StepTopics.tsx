"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { wizardLabels } from "../../config/translations";
import { useAuth } from "../../context/AuthContext";
import { TRANSITIONS } from "../../config/constants";

interface StepTopicsProps {
  taxonomy: Record<string, string[]>;
  selectedTopics: string[];
  toggleTopic: (t: string) => void;
}

export default function StepTopics({ taxonomy, selectedTopics, toggleTopic }: StepTopicsProps) {
  const { user } = useAuth();
  const w = wizardLabels[user?.language || "fr"] || wizardLabels.en;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={TRANSITIONS.fade}>
      <div className="flex flex-col gap-2 mb-10">
        <h3 className="text-2xl font-[850] text-zinc-900 font-serif lowercase italic">{w.step1}</h3>
        <p className="text-[12px] text-zinc-400 font-bold uppercase tracking-widest">Base de recherche</p>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {Object.keys(taxonomy).map((topic) => {
            const isSelected = selectedTopics.includes(topic);
            return (
                <button
                key={topic}
                onClick={() => toggleTopic(topic)}
                className={`py-8 px-6 text-center border transition-all duration-300 relative group
                    ${isSelected ? "border-zinc-900 bg-zinc-900 text-white shadow-xl" : "border-zinc-200 hover:border-zinc-400 bg-transparent text-zinc-600"}
                `}
                >
                <div className="flex flex-col items-center gap-3">
                    <span className="text-[14px] font-[900] uppercase tracking-tighter">
                    {topic}
                    </span>
                    {isSelected && <Check size={14} className="text-white/50" aria-hidden="true" />}
                </div>
                </button>
            );
        })}
      </div>
    </motion.div>
  );
}
