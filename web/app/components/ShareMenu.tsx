"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share, FileText, Copy, Check, X, Upload } from "lucide-react";

interface ShareMenuProps {
    data: any;
}

export default function ShareMenu({ data }: ShareMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    // Formatting the briefing efficiently for text/markdown sharing length
    const formatBriefingMarkdown = () => {
        if (!data) return "";
        let text = `# Mizan.ai - Édition du ${data.date}\n\n`;
        if (data.global_digest) {
            text += `## Résumé Éditorial\n${data.global_digest}\n\n`;
        }

        if (data.content && data.content.length > 0) {
            const categories: Record<string, any[]> = {};
            data.content.forEach((item: any) => {
                if (!categories[item.category]) categories[item.category] = [];
                categories[item.category].push(item);
            });

            for (const [cat, items] of Object.entries(categories)) {
                text += `### ${cat}\n`;
                items.forEach((item: any) => {
                    text += `- **${item.localized_title || item.title}**\n  ${item.summary}\n  [Lire la suite](${item.link})\n\n`;
                });
            }
        }

        if (data.youtube_videos && data.youtube_videos.length > 0) {
            text += `### Vidéos YouTube\n`;
            data.youtube_videos.forEach((vid: any) => {
                text += `- **${vid.title}** (${vid.channel})\n  [Voir la vidéo](${vid.link})\n`;
            });
        }

        return text;
    };

    const handleShareNative = async () => {
        const text = formatBriefingMarkdown();
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Mizan.ai - Édition du ${data.date}`,
                    text: text,
                });
            } catch (e) {
                console.error("Error sharing:", e);
            }
        } else {
            handleCopy();
        }
        setIsOpen(false);
    };

    const handleCopy = async () => {
        const text = formatBriefingMarkdown();
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            setTimeout(() => setIsOpen(false), 2200);
        } catch (e) {
            console.error("Failed to copy:", e);
        }
    };

    const handlePdf = () => {
        setIsOpen(false);
        // Standard browser print triggers PDF generation on iOS/Desktop
        setTimeout(() => {
            window.print();
        }, 100);
    };

    return (
        <div className="relative inline-block text-left mt-8 print:hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="group flex flex-col items-center justify-center gap-2 focus:outline-none"
            >
                <div className="w-12 h-12 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:shadow-md hover:border-indigo-100 transition-all active:scale-95 text-gray-500 hover:text-indigo-600">
                    <Share size={20} strokeWidth={2.5} className="group-hover:-translate-y-0.5 transition-transform" />
                </div>
                <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400 group-hover:text-indigo-600 transition-colors">
                    Partager l'édition
                </span>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-60 rounded-2xl bg-white/90 backdrop-blur-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-white/50 overflow-hidden z-50 p-2"
                    >
                        <div className="flex flex-col gap-1">
                            <button
                                onClick={handleShareNative}
                                className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100/80 rounded-xl transition-colors text-left"
                            >
                                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                    <Upload size={14} strokeWidth={2.5} />
                                </div>
                                Partager via...
                            </button>

                            <button
                                onClick={handlePdf}
                                className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100/80 rounded-xl transition-colors text-left"
                            >
                                <div className="w-7 h-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                                    <FileText size={14} strokeWidth={2.5} />
                                </div>
                                Exporter en PDF
                            </button>

                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100/80 rounded-xl transition-colors text-left"
                            >
                                <div className={`w-7 h-7 rounded-lg ${copied ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-600'} flex items-center justify-center shrink-0 transition-colors`}>
                                    {copied ? <Check size={14} strokeWidth={2.5} /> : <Copy size={14} strokeWidth={2.5} />}
                                </div>
                                {copied ? "Copié !" : "Copier (Notion)"}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Invisible backdrop to close the menu */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
}
