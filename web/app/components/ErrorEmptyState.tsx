"use client";

import { motion } from "framer-motion";
import { AlertCircle, RotateCcw } from "lucide-react";
import { commonLabels } from "../config/translations";
import { useAuth } from "../context/AuthContext";

interface ErrorEmptyStateProps {
  message: string;
  onRetry: () => void;
}

export default function ErrorEmptyState({ message, onRetry }: ErrorEmptyStateProps) {
  const { user } = useAuth();
  const c = commonLabels[user?.language || "fr"] || commonLabels.en;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-32 px-6 text-center"
    >
      <div className="w-16 h-16 bg-zinc-100 text-zinc-900 border border-zinc-200 flex items-center justify-center mb-8">
        <AlertCircle size={32} strokeWidth={1.5} aria-hidden="true" />
      </div>
      <h3 className="text-3xl font-[900] text-zinc-900 mb-4 font-serif tracking-tight lowercase italic">
          Incident Technique
      </h3>
      <p className="text-zinc-500 max-w-sm mb-12 text-[15px] font-medium leading-relaxed font-serif italic">
        {message.includes("401") || message.includes("403") ? c.errorAuth : "Nous ne sommes pas parvenus à imprimer cette édition. Veuillez vérifier votre connexion au kiosque."}
      </p>
      <button
        onClick={onRetry}
        className="flex items-center gap-3 px-10 py-4 bg-zinc-900 text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-black active:scale-[0.98] transition-all"
      >
        <RotateCcw size={16} aria-hidden="true" />
        {c.retry}
      </button>
    </motion.div>
  );
}
