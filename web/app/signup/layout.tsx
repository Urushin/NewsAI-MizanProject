import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Créer un compte",
    description: "Inscrivez-vous sur Mizan.ai et recevez votre premier briefing IA en quelques secondes.",
    openGraph: {
        title: "Créer un compte — Mizan.ai",
        description: "Inscrivez-vous et recevez votre briefing IA personnalisé.",
    },
    robots: {
        index: false,
        follow: false,
    },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
    return children;
}
