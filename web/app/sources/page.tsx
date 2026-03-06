"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, API } from "../context/AuthContext";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, ExternalLink, Database, Search } from "lucide-react";

interface ScannedSource {
    title: string;
    url: string;
}

export default function SourcesPage() {
    const { user, token, loading: authLoading } = useAuth();
    const router = useRouter();
    const [sources, setSources] = useState<ScannedSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!token) return;

        fetch(`${API}/api/brief/sources`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(r => r.json())
            .then(data => {
                if (data.sources_scanned) {
                    setSources(data.sources_scanned);
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [token]);

    const filtered = sources.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.url.toLowerCase().includes(search.toLowerCase())
    );

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-[#FAFAFA] text-gray-900 font-sans selection:bg-indigo-100 flex flex-col items-center w-full pb-20">
            {/* Header Sticky */}
            <div className="w-full max-w-[800px] px-6 pt-10 pb-6 flex items-center justify-between sticky top-0 bg-[#FAFAFA]/80 backdrop-blur-md z-10">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-500 hover:text-black transition-colors"
                >
                    <ArrowLeft size={18} />
                    <span className="text-sm font-semibold">Retour</span>
                </button>
                <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
                    <Database size={14} className="text-indigo-600" />
                    <span className="text-[12px] font-bold text-indigo-700 uppercase tracking-wider">
                        Archive de Collecte
                    </span>
                </div>
            </div>

            <div className="w-full max-w-[800px] px-6">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <h1 className="text-3xl font-black tracking-tight text-gray-900 mb-2">
                        Sources Analysées
                    </h1>
                    <p className="text-gray-500 mb-8 leading-relaxed">
                        Voici la liste exhaustive de tous les articles récupérés et traités par Mizan pour votre dernière édition personnalisée.
                        Sur les <span className="text-indigo-600 font-bold">{sources.length}</span> sources collectées, seules les plus pertinentes ont été retenues.
                    </p>

                    {/* Search Bar */}
                    <div className="relative mb-8">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Rechercher une source ou un domaine..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-white border border-black/[0.05] rounded-2xl py-4 pl-12 pr-6 text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all shadow-sm"
                        />
                    </div>

                    {/* Table / List */}
                    <div className="bg-white rounded-[24px] border border-black/[0.05] shadow-sm overflow-hidden">
                        {filtered.length > 0 ? (
                            <div className="divide-y divide-gray-50">
                                {filtered.map((item, idx) => (
                                    <div key={idx} className="group flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <h3 className="text-[14px] font-semibold text-gray-800 truncate group-hover:text-indigo-600 transition-colors">
                                                {item.title || "Titre inconnu"}
                                            </h3>
                                            <p className="text-[11px] text-gray-400 truncate mt-0.5">
                                                {item.url}
                                            </p>
                                        </div>
                                        <a
                                            href={item.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm"
                                        >
                                            <ExternalLink size={14} />
                                        </a>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-12 text-center">
                                <p className="text-gray-400 text-sm italic">Aucune source ne correspond à votre recherche.</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </main>
    );
}
