"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import OnboardingWizard from "../components/OnboardingWizard";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useApi } from "../utils/api";

export default function AssistantPage() {
    const { user, loading, setGenStatus } = useAuth();
    const api = useApi();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    const startFirstGeneration = async () => {
        setGenStatus({ active: true, step: "Préparation de l'Atelier d'Imprimerie...", percent: 10, isDone: false });
        router.push("/briefing"); 

        try {
            await api.post(`/api/brief/generate?mode=prod`);
        } catch (err) {
            console.error(err);
            setGenStatus({ active: false, step: "", percent: 0, isDone: false });
        }
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FDFCF8]">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="animate-spin text-zinc-900" size={24} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Authentification Kiosque</span>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-[#FDFCF8] flex items-center justify-center p-6 sm:p-12">
            <div className="w-full max-w-4xl">
                <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="text-center mb-12"
                >
                    <div className="text-4xl font-[900] tracking-tighter text-zinc-900 mb-2 font-serif">M.</div>
                    <p className="text-[12px] font-bold text-zinc-400 uppercase tracking-[0.2em] italic font-serif">
                        Configuration de votre Ligne Éditoriale Personnelle
                    </p>
                </motion.div>
                
                <div className="bg-transparent overflow-hidden">
                    <OnboardingWizard
                        onClose={() => router.push("/briefing")}
                        onSuccess={startFirstGeneration}
                    />
                </div>
            </div>
        </main>
    );
}
