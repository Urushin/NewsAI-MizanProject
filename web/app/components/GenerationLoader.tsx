"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, Brain, Newspaper, Globe, Rocket, CheckCircle2 } from "lucide-react";

const HEARTHSTONE_MESSAGES = [
    "Recrutement de correspondants virtuels...",
    "Lecture de la presse mondiale en accéléré...",
    "Entraînement des neurones de l'IA...",
    "Traduction des scoops internationaux...",
    "Filtrage des fake news et du bruit numérique...",
    "Préparation du café pour l'IA éditorialiste...",
    "Synchronisation avec les flux satellites...",
    "Analyse de l'impact géopolitique...",
    "Détection des signaux faibles...",
    "Nettoyage des archives poussiéreuses...",
    "Assemblage du puzzle de l'actualité...",
    "Mise en page de votre édition sur-mesure..."
];

interface GenerationLoaderProps {
    step: string;
    percent: number;
    isDone: boolean;
}

export default function GenerationLoader({ step, percent, isDone }: GenerationLoaderProps) {
    const [messageIdx, setMessageIdx] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setMessageIdx((prev) => (prev + 1) % HEARTHSTONE_MESSAGES.length);
        }, 3500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6 overflow-hidden">
            {/* Animated Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-50 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-50 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />

            <div className="relative z-10 w-full max-w-lg text-center">
                {/* Visual Icon */}
                <div className="mb-12 relative inline-block">
                    <motion.div
                        animate={isDone ? {} : {
                            scale: [1, 1.05, 1],
                            rotate: [0, 5, -5, 0]
                        }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className={`w-28 h-28 rounded-[32px] ${isDone ? 'bg-emerald-500' : 'bg-indigo-600'} flex items-center justify-center shadow-2xl shadow-indigo-200 relative z-10 transition-colors duration-500`}
                    >
                        {isDone ? (
                            <CheckCircle2 className="text-white" size={56} />
                        ) : (
                            <div className="relative">
                                <Brain className="text-white opacity-20 absolute inset-0 scale-150 animate-pulse" size={56} />
                                <Sparkles className="text-white relative z-10" size={56} />
                            </div>
                        )}
                    </motion.div>
                    {!isDone && (
                        <motion.div
                            animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.4, 0.2] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inset-0 bg-indigo-400 rounded-[32px] blur-2xl"
                        />
                    )}
                </div>

                <AnimatePresence mode="wait">
                    <motion.h2
                        key={isDone ? 'done' : 'loading'}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-3xl font-black text-gray-900 mb-4 tracking-tight"
                    >
                        {isDone ? "C'est prêt !" : "Mizan prépare votre Brief"}
                    </motion.h2>
                </AnimatePresence>

                {/* Status Step */}
                <div className="mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-widest border border-indigo-100/50 mb-3">
                        <Loader2 className="animate-spin" size={12} />
                        {step || "Initialisation..."}
                    </div>

                    <div className="h-10 overflow-hidden">
                        <AnimatePresence mode="wait">
                            {!isDone && (
                                <motion.p
                                    key={messageIdx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="text-gray-400 text-sm font-medium italic"
                                >
                                    {HEARTHSTONE_MESSAGES[messageIdx]}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden mb-4 p-1 shadow-inner group">
                    <motion.div
                        className={`h-full ${isDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-blue-400'} rounded-full shadow-lg`}
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                </div>

                <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Progression</span>
                    <span className={`text-[12px] font-black ${isDone ? 'text-emerald-500' : 'text-indigo-600'}`}>
                        {Math.round(percent)}%
                    </span>
                </div>

                {/* Icons steps */}
                <div className="mt-16 flex justify-center gap-8 opacity-20">
                    <Globe size={24} className={percent > 20 ? "text-indigo-600 opacity-100" : ""} aria-hidden="true" />
                    <Newspaper size={24} className={percent > 50 ? "text-indigo-600 opacity-100" : ""} aria-hidden="true" />
                    <Brain size={24} className={percent > 80 ? "text-indigo-600 opacity-100" : ""} aria-hidden="true" />
                    <Rocket size={24} className={percent === 100 ? "text-indigo-600 opacity-100" : ""} aria-hidden="true" />
                </div>
            </div>
        </div>
    );
}
