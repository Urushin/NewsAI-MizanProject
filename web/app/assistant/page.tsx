"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, API } from "../context/AuthContext";
import OnboardingWizard from "../components/OnboardingWizard";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";

export default function AssistantPage() {
    const { user, token, loading, setGenStatus } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    const startFirstGeneration = async () => {
        setGenStatus({ active: true, step: "Initialisation de votre première édition...", percent: 10, isDone: false });
        router.push("/"); // Go to home, it will show the immersive loader

        try {
            await fetch(`${API}/api/brief/generate?mode=prod`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
            // Polling is handled by page.tsx
        } catch (err) {
            console.error(err);
            setGenStatus({ active: false, step: "", percent: 0, isDone: false });
        }
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100/30 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-100/30 rounded-full blur-[120px]" />

            <div className="w-full max-w-4xl z-10">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
                        Bienvenue, {user.username} !
                    </h1>
                    <p className="text-gray-500">
                        Prenons un instant pour configurer votre intelligence artificielle.
                    </p>
                </div>
                <div className="bg-white rounded-[32px] shadow-xl border border-black/[0.03] overflow-hidden">
                    <OnboardingWizard
                        onClose={() => router.push("/")}
                        onSuccess={startFirstGeneration}
                    />
                </div>
            </div>
        </main>
    );
}
