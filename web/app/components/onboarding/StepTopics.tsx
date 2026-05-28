"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, X } from "lucide-react";
import { wizardLabels } from "../../config/translations";
import { useAuth } from "../../context/AuthContext";
import { TRANSITIONS } from "../../config/constants";

interface StepTopicsProps {
  taxonomy: Record<string, string[]>;
  selectedTopics: string[];
  toggleTopic: (t: string) => void;
  selectedSubtopics: string[];
  toggleSub: (s: string) => void;
}

export default function StepTopics({ taxonomy, selectedTopics, toggleTopic, selectedSubtopics, toggleSub }: StepTopicsProps) {
  const { user } = useAuth();
  const w = wizardLabels[user?.language || "fr"] || wizardLabels.en;

  const [customInput, setCustomInput] = useState("");
  const addedCustoms = selectedTopics.filter(t => !Object.keys(taxonomy).includes(t));

  const handleAddCustom = () => {
      const trimmed = customInput.trim();
      if (trimmed && !selectedTopics.includes(trimmed)) {
          toggleTopic(trimmed);
          setCustomInput("");
      }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={TRANSITIONS.fade}>
      <div className="flex flex-col gap-2 mb-8">
        <h3 className="text-2xl font-[850] text-zinc-900 font-serif lowercase italic">{w.step1}</h3>
        <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest">Base de recherche & Affinement</p>
      </div>
      
      <div className="flex flex-col gap-4">
        {Object.keys(taxonomy).map((topic) => {
            const isSelected = selectedTopics.includes(topic);
            const subtopics = taxonomy[topic] || [];

            return (
                <div 
                    key={topic} 
                    className={`border transition-all duration-300 ${
                        isSelected ? "border-zinc-900 shadow-xl" : "border-zinc-200 hover:border-zinc-400"
                    }`}
                >
                    {/* Topic Header Trigger */}
                    <button
                        type="button"
                        onClick={() => toggleTopic(topic)}
                        className={`w-full p-6 flex justify-between items-center text-left transition-colors ${
                            isSelected ? "bg-zinc-900 text-white" : "bg-transparent text-zinc-800"
                        }`}
                    >
                        <span className="text-[15px] font-[900] uppercase tracking-tighter">
                            {topic}
                        </span>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] text-zinc-400 uppercase tracking-widest">
                                {subtopics.length} options
                            </span>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                                isSelected ? "border-white/40 text-white" : "border-zinc-200 text-zinc-400"
                            }`}>
                                {isSelected ? <Check size={12} /> : <ChevronRight size={12} className="rotate-90" />}
                            </div>
                        </div>
                    </button>

                    {/* Inline Expandable Subtopics */}
                    <AnimatePresence initial={false}>
                        {isSelected && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                className="overflow-hidden bg-[#FDFCF8]/30"
                            >
                                <div className="p-6 border-t border-zinc-100 flex flex-col gap-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                        Sélectionner les sous-thèmes :
                                    </p>
                                    <div className="flex flex-wrap gap-2.5">
                                        {subtopics.map((sub) => {
                                            const isSubSelected = selectedSubtopics.includes(sub);
                                            return (
                                                <button
                                                    key={sub}
                                                    type="button"
                                                    onClick={() => toggleSub(sub)}
                                                    className={`px-4 py-1.5 text-[12px] font-bold border transition-all duration-200 ${
                                                        isSubSelected 
                                                            ? "bg-zinc-900 border-zinc-900 text-white shadow-md scale-102" 
                                                            : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:text-zinc-900"
                                                    }`}
                                                >
                                                    {isSubSelected ? "— " : ""}{sub}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            );
        })}

        {/* Custom Input */}
        <div className="mt-4 pt-6 border-t border-zinc-100">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block mb-3">Autre thème d'Intérêt ?</label>
            
            {addedCustoms.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {addedCustoms.map(t => (
                        <div key={t} className="flex items-center gap-2 bg-zinc-900 text-white pl-3 pr-2.5 py-1.5 rounded-full shadow-md">
                            <span className="text-[11px] font-black">{t}</span>
                            <button type="button" onClick={() => toggleTopic(t)} className="text-white/50 hover:text-white"><X size={12} /></button>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex gap-2">
                <input 
                    type="text" 
                    placeholder="Tapez un sujet... (ex: Cuisine moléculaire)"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
                    className="w-full bg-transparent border border-zinc-100 px-4 py-3 text-[14px] font-serif italic focus:outline-none focus:border-zinc-900 h-11 bg-zinc-50"
                />
                <button type="button" onClick={handleAddCustom} className="bg-zinc-900 text-white px-5 text-[11px] font-black uppercase tracking-widest hover:bg-black transition-colors h-11">Ajouter</button>
            </div>
        </div>

      </div>
    </motion.div>
  );
}
