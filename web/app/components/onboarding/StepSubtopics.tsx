"use client";

import { motion } from "framer-motion";
import { SlidersHorizontal } from "lucide-react";
import { wizardLabels } from "../../config/translations";
import { useAuth } from "../../context/AuthContext";
import { TRANSITIONS } from "../../config/constants";

interface StepSubtopicsProps {
  selectedTopics: string[];
  taxonomy: Record<string, string[]>;
  selectedSubtopics: string[];
  toggleSub: (s: string) => void;
}

export default function StepSubtopics({ selectedTopics, taxonomy, selectedSubtopics, toggleSub }: StepSubtopicsProps) {
  const { user } = useAuth();
  const w = wizardLabels[user?.language || "fr"] || wizardLabels.en;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={TRANSITIONS.fade}>
      <div className="flex flex-col gap-2 mb-10">
        <h3 className="text-2xl font-[850] text-zinc-900 font-serif lowercase italic">{w.step2}</h3>
        <p className="text-[12px] text-zinc-400 font-bold uppercase tracking-widest">Affiner les centres d'intérêt</p>
      </div>

      {selectedTopics.length === 0 ? (
        <p className="text-[14px] text-zinc-400 bg-zinc-50 p-10 text-center border border-zinc-200 font-serif italic">
          {w.step2Warning}
        </p>
      ) : (
        <div className="flex flex-col gap-12">
          {selectedTopics.map((topic) => (
            <div key={topic} className="flex flex-col gap-5">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 border-b border-zinc-100 pb-2">{topic}</h4>
              <div className="flex flex-wrap gap-3">
                {taxonomy[topic]?.map((sub) => {
                  const isSelected = selectedSubtopics.includes(sub);
                  return (
                    <button
                      key={sub}
                      onClick={() => toggleSub(sub)}
                      className={`px-6 py-2 text-[13px] font-bold transition-all duration-300 border 
                        ${isSelected ? "bg-zinc-900 border-zinc-900 text-white shadow-lg" : "bg-transparent border-zinc-200 text-zinc-500 hover:border-zinc-400"}`}
                    >
                      {isSelected ? "— " : ""}{sub}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
