"use client";

import { motion } from "framer-motion";
import { Radar } from "lucide-react";
import { wizardLabels } from "../../config/translations";
import { useAuth } from "../../context/AuthContext";
import { TRANSITIONS } from "../../config/constants";

interface StepIdentityProps {
  ageRange: string;
  setAgeRange: (val: string) => void;
  exactAge: string;
  setExactAge: (val: string) => void;
  location: string;
  setLocation: (val: string) => void;
  exactLocation: string;
  setExactLocation: (val: string) => void;
  occupation: string;
  setOccupation: (val: string) => void;
  exactOccupation: string;
  setExactOccupation: (val: string) => void;
}

export default function StepIdentity({
  ageRange, setAgeRange, exactAge, setExactAge,
  location, setLocation, exactLocation, setExactLocation,
  occupation, setOccupation, exactOccupation, setExactOccupation
}: StepIdentityProps) {
  const { user } = useAuth();
  const w = wizardLabels[user?.language || "fr"] || wizardLabels.en;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={TRANSITIONS.fade}>
      <div className="flex flex-col gap-2 mb-8">
        <h3 className="text-2xl font-[850] text-zinc-900 font-serif lowercase italic">{w.step3}</h3>
      </div>
      
      <div className="mb-10 p-6 bg-zinc-50 border border-zinc-200">
        <p className="text-[13px] text-zinc-600 leading-relaxed font-serif italic">
          {w.step3Sub}
        </p>
      </div>

      <div className="space-y-12">
        {/* Age Section */}
        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block border-b border-zinc-100 pb-2">{w.age}</label>
          <div className="flex flex-wrap gap-3">
            {["18-25", "26-35", "36-50", "50+"].map(range => (
              <button
                key={range}
                onClick={() => { setAgeRange(range); setExactAge(""); }}
                className={`px-5 py-2 text-[13px] font-bold transition-all border ${ageRange === range ? "bg-zinc-900 border-zinc-900 text-white shadow-lg" : "bg-transparent border-zinc-200 text-zinc-500 hover:border-zinc-400"}`}
              >
                {range} {w.years}
              </button>
            ))}
            <input
              type="number"
              placeholder={w.agePlaceholder}
              value={exactAge}
              onChange={(e) => { setExactAge(e.target.value); if (e.target.value) setAgeRange(""); }}
              className="px-5 py-2 text-[13px] border border-zinc-200 bg-transparent focus:outline-none focus:border-zinc-900 w-[120px] font-serif italic"
            />
          </div>
        </div>

        {/* Location Section */}
        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block border-b border-zinc-100 pb-2">{w.location}</label>
          <div className="flex flex-wrap gap-3">
            {["France", "Belgique", "Suisse", "Québec"].map(loc => (
              <button
                key={loc}
                onClick={() => { setLocation(loc); setExactLocation(""); }}
                className={`px-5 py-2 text-[13px] font-bold transition-all border ${location === loc ? "bg-zinc-900 border-zinc-900 text-white shadow-lg" : "bg-transparent border-zinc-200 text-zinc-500 hover:border-zinc-400"}`}
              >
                {loc}
              </button>
            ))}
            <input
              type="text"
              placeholder={w.locationPlaceholder}
              value={exactLocation}
              onChange={(e) => { setExactLocation(e.target.value); if (e.target.value) setLocation(""); }}
              className="px-5 py-2 text-[13px] border border-zinc-200 bg-transparent focus:outline-none focus:border-zinc-900 flex-1 min-w-[150px] font-serif italic"
            />
          </div>
        </div>

        {/* Occupation Section */}
        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block border-b border-zinc-100 pb-2">{w.occupation}</label>
          <div className="flex flex-wrap gap-3">
            {["Santé", "Tech", "Étudiant", "Éducation", "Commerce"].map(occ => (
              <button
                key={occ}
                onClick={() => { setOccupation(occ); setExactOccupation(""); }}
                className={`px-5 py-2 text-[13px] font-bold transition-all border ${occupation === occ ? "bg-zinc-900 border-zinc-900 text-white shadow-lg" : "bg-transparent border-zinc-200 text-zinc-500 hover:border-zinc-400"}`}
              >
                {occ}
              </button>
            ))}
            <input
              type="text"
              placeholder={w.occupationPlaceholder}
              value={exactOccupation}
              onChange={(e) => { setExactOccupation(e.target.value); if (e.target.value) setOccupation(""); }}
              className="px-5 py-2 text-[13px] border border-zinc-200 bg-transparent focus:outline-none focus:border-zinc-900 flex-1 min-w-[200px] font-serif italic"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
