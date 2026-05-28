"use client";

import { motion } from "framer-motion";
import { Check, BookOpen, Layers } from "lucide-react";
import { TRANSITIONS } from "../../config/constants";

interface StepPreferencesProps {
  summaryFormat: string;
  setSummaryFormat: (val: string) => void;
  theme: string;
  setTheme: (val: string) => void;
}

const FORMATS = [
  { id: "bullet", title: "Bullet points", desc: "Rapide et direct sous forme d'énumérations." },
  { id: "detailed", title: "Analytique", desc: "Plus de détails, structuré par points clés d'impact." },
  { id: "editorial", title: "Chronique", desc: "Narratif, rédigé comme un article de journal." }
];

const THEMES = [
  { id: "light", title: "Papier (Clair)", desc: "Aesthetic minimaliste journalier blanc." },
  { id: "dark", title: "Sombre", desc: "Contrasté, reposant pour la lecture de nuit." },
  { id: "glass", title: "Glass (Moderne)", desc: "Effets de flou et transparence contemporains." }
];

export default function StepPreferences({ summaryFormat, setSummaryFormat, theme, setTheme }: StepPreferencesProps) {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={TRANSITIONS.fade}>
      <div className="flex flex-col gap-2 mb-8">
        <h3 className="text-2xl font-[850] text-zinc-900 font-serif lowercase italic">Préférences</h3>
        <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest">Personnalisez votre expérience de lecture</p>
      </div>

      <div className="space-y-10">
        
        {/* Format Section */}
        <div>
          <div className="flex items-center gap-3 mb-4 pb-2 border-b border-zinc-100">
            <BookOpen size={16} className="text-zinc-600" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-900">Format de Résumé Préféré</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {FORMATS.map((f) => {
              const isSelected = summaryFormat === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSummaryFormat(f.id)}
                  className={`p-4 border text-left flex flex-col justify-between transition-all relative ${
                    isSelected ? "border-zinc-900 bg-zinc-900 text-white shadow-lg" : "border-zinc-200 hover:border-zinc-400 text-zinc-800"
                  }`}
                >
                  {isSelected && <div className="absolute right-3 top-3"><Check size={14} className={isSelected ? "text-white" : "text-zinc-900"} /></div>}
                  <div>
                    <span className="text-[13px] font-[900] uppercase tracking-wide block mb-1">{f.title}</span>
                    <p className={`text-[11px] font-serif italic ${isSelected ? "text-zinc-300" : "text-zinc-400"}`}>{f.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Theme Section */}
        <div>
          <div className="flex items-center gap-3 mb-4 pb-2 border-b border-zinc-100">
            <Layers size={16} className="text-zinc-600" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-900">Thème Visuel</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {THEMES.map((t) => {
              const isSelected = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={`p-4 border text-left flex flex-col justify-between transition-all relative ${
                    isSelected ? "border-zinc-900 bg-zinc-900 text-white shadow-lg" : "border-zinc-200 hover:border-zinc-400 text-zinc-800"
                  }`}
                >
                  {isSelected && <div className="absolute right-3 top-3"><Check size={14} className={isSelected ? "text-white" : "text-zinc-900"} /></div>}
                  <div>
                    <span className="text-[13px] font-[900] uppercase tracking-wide block mb-1">{t.title}</span>
                    <p className={`text-[11px] font-serif italic ${isSelected ? "text-zinc-300" : "text-zinc-400"}`}>{t.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </motion.div>
  );
}
