"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share, FileText, Copy, Check, Upload } from "lucide-react";
import { shareLabels } from "../config/translations";
import { useAuth } from "../context/AuthContext";
import { TRANSITIONS } from "../config/constants";

interface ShareMenuProps {
    data: any;
}

export default function ShareMenu({ data }: ShareMenuProps) {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const s = shareLabels[user?.language || "fr"] || shareLabels.en;

    // Formatting the briefing efficiently for text/markdown sharing length
    const formatBriefingMarkdown = () => {
        if (!data) return "";
        let text = `# ${s.markdownTitle} ${data.date}\n\n`;
        if (data.global_digest) {
            text += `## ${s.digestTitle}\n${data.global_digest}\n\n`;
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
                    text += `- **${item.localized_title || item.title}**\n  ${item.summary}\n  [${s.readMore}](${item.link})\n\n`;
                });
            }
        }

        if (data.youtube_videos && data.youtube_videos.length > 0) {
            text += `### ${s.youtubeTitle}\n`;
            data.youtube_videos.forEach((vid: any) => {
                text += `- **${vid.title}** (${vid.channel})\n  [${s.watchVideo}](${vid.link})\n`;
            });
        }

        return text;
    };

    const handleShareNative = async () => {
        const text = formatBriefingMarkdown();
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${s.markdownTitle} ${data.date}`,
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
                <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 shadow-xl flex items-center justify-center hover:bg-black transition-all active:scale-95 text-white">
                    <Share size={18} strokeWidth={2} className="group-hover:-translate-y-0.5 transition-transform" />
                </div>
                <span className="text-[9px] uppercase tracking-[0.2em] font-black text-zinc-400 group-hover:text-zinc-900 transition-colors">
                    Partager
                </span>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        transition={TRANSITIONS.spring}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-64 bg-[#FDFCF8] border border-zinc-200 shadow-2xl z-50 p-2 overflow-hidden"
                    >
                        <div className="flex flex-col">
                            <button
                                onClick={handleShareNative}
                                className="flex items-center gap-4 px-4 py-4 text-[11px] font-black uppercase tracking-widest text-zinc-900 hover:bg-zinc-100 transition-colors text-left border-b border-zinc-100"
                            >
                                <Upload size={14} className="text-zinc-400" />
                                {s.shareVia}
                            </button>

                            <button
                                onClick={handlePdf}
                                className="flex items-center gap-4 px-4 py-4 text-[11px] font-black uppercase tracking-widest text-zinc-900 hover:bg-zinc-100 transition-colors text-left border-b border-zinc-100"
                            >
                                <FileText size={14} className="text-zinc-400" />
                                Imprimer / PDF
                            </button>

                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-4 px-4 py-4 text-[11px] font-black uppercase tracking-widest text-zinc-900 hover:bg-zinc-100 transition-colors text-left"
                            >
                                <div className="shrink-0">
                                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-zinc-400" />}
                                </div>
                                {copied ? s.copied : s.copy}
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
