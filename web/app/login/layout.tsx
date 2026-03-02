import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Connexion",
    description: "Connectez-vous à votre compte Mizan.ai pour accéder à votre briefing personnalisé.",
    openGraph: {
        title: "Connexion — Mizan.ai",
        description: "Connectez-vous à votre briefing IA personnalisé.",
    },
    robots: {
        index: false,
        follow: false,
    },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return children;
}
