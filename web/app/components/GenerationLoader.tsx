"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { loaderMessages, loaderLabels } from "../config/translations";

interface GenerationLoaderProps {
    step: string;
    percent: number;
    isDone: boolean;
}

export default function GenerationLoader({ step, percent, isDone }: GenerationLoaderProps) {
    const { user } = useAuth();
    const [messageIdx, setMessageIdx] = useState(0);
    const messages = loaderMessages[user?.language || "fr"] || loaderMessages.fr;
    const l = loaderLabels[user?.language || "fr"] || loaderLabels.en;

    useEffect(() => {
        const interval = setInterval(() => {
            setMessageIdx((prev) => (prev + 1) % messages.length);
        }, 3500);
        return () => clearInterval(interval);
    }, [messages]);

    return (
        <div className="fixed inset-0 z-[300] bg-[#FDFCF8] flex flex-col items-center justify-center p-8 overflow-hidden font-serif">
            
            {/* Minimalist central structure */}
            <div className="w-full max-w-sm flex flex-col items-center">
                
                {/* Branding / Icon */}
                <div className="mb-16">
                    <motion.div
                        animate={{ opacity: isDone ? 1 : [0.3, 1, 0.3] }}
                        transition={{ duration: 2, repeat: isDone ? 0 : Infinity, ease: "easeInOut" }}
                        className="text-center font-black text-6xl tracking-tighter text-zinc-900"
                    >
                        M.
                    </motion.div>
                </div>

                <AnimatePresence mode="wait">
                    <motion.h2
                        key={isDone ? 'done' : 'loading'}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="text-2xl font-[850] text-zinc-900 mb-8 tracking-tight font-serif italic"
                    >
                        {isDone ? l.ready : "Rédaction de l'édition..."}
                    </motion.h2>
                </AnimatePresence>

                {/* Status Step Text */}
                <div className="text-center mb-16 h-12 flex flex-col justify-center">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2 font-sans">
                        {step || l.processing}
                    </div>
                    
                    <div className="overflow-hidden">
                        <AnimatePresence mode="wait">
                            {!isDone && (
                                <motion.p
                                    key={messageIdx}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className="text-zinc-400 text-[12px] font-serif italic"
                                >
                                    {messages[messageIdx]}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Sleek Progress Line */}
                <div className="w-full max-w-[200px] flex flex-col gap-3">
                    <div className="w-full h-[1px] bg-zinc-200 relative overflow-hidden">
                        <motion.div
                            className="absolute top-0 left-0 bottom-0 bg-zinc-900"
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-zinc-400 font-sans">
                        <span>Lancement</span>
                        <motion.span 
                            animate={{ color: isDone ? "#000" : "#a1a1aa" }}
                        >
                            {Math.round(percent)}%
                        </motion.span>
                    </div>
                </div>

            </div>
        </div>
    );
}
