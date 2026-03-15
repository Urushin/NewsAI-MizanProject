"use client";

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect } from "react";

export default function LoginPage() {
    const { login, user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (user) {
            router.push("/briefing");
        }
    }, [user, router]);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await login(email, password);
            router.push("/briefing");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#FDFCF8] flex items-center justify-center p-6 sm:p-12">
            <div className="w-full max-w-md">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center mb-16"
                >
                    <div className="text-6xl font-[900] tracking-tighter text-zinc-900 mb-2 font-serif">N.</div>
                    <p className="text-[10px] uppercase tracking-[0.4em] font-black text-zinc-400">Premium Journal</p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <form onSubmit={handleSubmit} className="space-y-8 bg-white p-8 sm:p-12 border border-zinc-200">
                        <div className="text-center mb-10">
                            <h2 className="text-3xl font-[900] text-zinc-900 font-serif italic lowercase tracking-tight">Accès Lecteur</h2>
                            <p className="text-[12px] text-zinc-400 font-medium mt-2">Authentification sécurisée</p>
                        </div>

                        {error && (
                            <div className="p-4 bg-zinc-50 border-l-2 border-zinc-900 text-[13px] font-serif italic text-zinc-500">
                                {error}
                            </div>
                        )}

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400" htmlFor="email">Email de l'abonné</label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="nom.prenom@newsai.local"
                                    className="w-full bg-transparent border-b border-zinc-200 py-3 text-[15px] focus:outline-none focus:border-zinc-900 transition-colors font-serif placeholder:italic placeholder:text-zinc-300"
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400" htmlFor="password">Clef d'accès</label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    className="w-full bg-transparent border-b border-zinc-200 py-3 text-[15px] focus:outline-none focus:border-zinc-900 transition-colors font-serif placeholder:italic placeholder:text-zinc-300"
                                    required
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            className="w-full bg-zinc-900 text-white py-4 text-[13px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-black active:scale-[0.98] transition-all disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? "Vérification..." : "Se connecter"}
                        </button>

                        <div className="text-center pt-4">
                            <p className="text-[12px] text-zinc-400 font-medium">
                                Pas encore membre ?{" "}
                                <a href="/signup" className="text-zinc-900 font-black underline decoration-zinc-200 underline-offset-4 hover:decoration-zinc-900 transition-all">Créer un compte</a>
                            </p>
                        </div>
                    </form>
                </motion.div>

                <div className="mt-16 text-center">
                    <p className="text-[10px] text-zinc-300 font-black uppercase tracking-[0.2em]">© 2026 NewsAI — Imprimerie Digitale IA</p>
                </div>
            </div>
        </main>
    );
}
