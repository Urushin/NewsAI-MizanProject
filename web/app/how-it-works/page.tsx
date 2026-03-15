"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  Database, 
  Cpu, 
  Search, 
  Zap, 
  ShieldCheck, 
  Code2, 
  Globe, 
  Layers,
  ChevronDown,
  Info,
  Sparkles,
  Fingerprint
} from "lucide-react";

export default function HowItWorks() {
  const router = useRouter();

  const steps = [
    {
      title: "Collecte Multi-Sources",
      icon: Database,
      description: "NewsAI scanne en temps réel des milliers de flux RSS, Google News et sources spécialisées basées sur vos centres d'intérêt.",
      details: "Nous utilisons un moteur de collection asynchrone capable d'extraire le contenu textuel complet des articles en évitant les publicités et le bruit visuel.",
      tech: ["RSS Feeds", "Playwright/Scraping", "Google News API"]
    },
    {
      title: "Clustering & Déduplication",
      icon: Layers,
      description: "L'IA regroupe les articles parlant du même sujet pour éviter la répétition.",
      details: "Grâce à notre algorithme de clustering, nous identifions les événements identiques reportés par différents médias. Cela nous permet de fusionner les perspectives.",
      tech: ["Sequence Matching", "Keyword Overlap", "Clustering Algorithms"]
    },
    {
      title: "Matching Sémantique",
      icon: Search,
      description: "Votre 'Manifesto' est converti en vecteur mathématique pour trouver les news qui vous importent vraiment.",
      details: "Contrairement aux simples mots-clés, nous comprenons le contexte. Si vous vous intéressez à l'IA, nous saurons si un article sur les semi-conducteurs est pertinent pour vous.",
      tech: ["OpenAI Embeddings", "Vector Search (Supabase Vector)"]
    },
    {
      title: "Analyse Chimera (Fusion IA)",
      icon: Cpu,
      description: "Plusieurs sources sont fusionnées en une seule synthèse cohérente et factuelle.",
      details: "Notre pipeline 'Chimera' prend les 5 meilleures sources d'un sujet et demande à l'IA d'en extraire les faits concordants, éliminant ainsi les biais isolés.",
      tech: ["Mistral Large 2", "GPT-4o", "Cross-Source Verification"]
    },
    {
      title: "Détection des Biais Cognitifs",
      icon: Fingerprint,
      description: "Chaque article est passé au crible pour détecter les manipulations rhétoriques.",
      details: "L'IA identifie les 'Pentes Glissantes', les 'Faux Dilemmes' et les 'Appels à la Peur' pour vous prévenir d'une lecture potentiellement biaisée.",
      tech: ["Cognitive Bias Codex", "Prompt Engineering Avancé"]
    },
    {
      title: "IA Seal & Vérification",
      icon: ShieldCheck,
      description: "Un dernier contrôle de qualité assure une précision de 98% avant l'envoi.",
      details: "Nous vérifions l'absence d'hallucinations et la neutralité du ton journalistique. Le résultat est un briefing pur, dense et actionnable.",
      tech: ["Self-Correction Loops", "Hallucination Checks"]
    }
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-gray-900 font-sans selection:bg-indigo-100 pb-32">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-md border-b border-black/[0.03] px-6 py-4">
        <div className="max-w-[1200px] mx-auto flex justify-between items-center">
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft size={16} /> Retour
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
              <span className="text-white font-black text-xs">M</span>
            </div>
            <span className="font-extrabold text-sm tracking-tight">Infrastructure NewsAI</span>
          </div>
          <div className="w-16" /> {/* Spacer */}
        </div>
      </nav>

      <main className="pt-32 px-6">
        <div className="max-w-[800px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-20"
          >
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-6">Transparence Totale.</h1>
            <p className="text-gray-500 text-lg font-medium leading-relaxed">
              Nous pensons que la confiance passe par la compréhension. Voici comment NewsAI transforme le chaos du web en intelligence structurée.
            </p>
          </motion.div>

          {/* VERTICAL SCHEMA */}
          <div className="relative border-l-2 border-dashed border-gray-200 ml-4 sm:ml-8 pl-8 sm:pl-16 space-y-20 pb-10">
            {steps.map((step, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className="relative"
              >
                {/* Step Marker */}
                <div className="absolute -left-[54px] sm:-left-[82px] top-0 w-12 h-12 bg-white rounded-2xl border-2 border-gray-100 shadow-sm flex items-center justify-center z-10">
                  <step.icon size={20} className="text-indigo-600" />
                </div>
                
                <div className="bg-white p-8 rounded-[32px] border border-black/[0.03] shadow-[0_4px_24px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.04)] transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full uppercase tracking-widest">Étape 0{i+1}</span>
                    <h3 className="text-xl font-black tracking-tight">{step.title}</h3>
                  </div>
                  <p className="text-gray-500 font-bold mb-4 leading-relaxed">{step.description}</p>
                  <p className="text-gray-400 text-sm leading-relaxed mb-6">{step.details}</p>
                  
                  <div className="flex flex-wrap gap-2">
                    {step.tech.map((t, ti) => (
                      <span key={ti} className="text-[11px] font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-lg border border-black/[0.02]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* SPECIAL SECTION: THE PROMPT */}
          <motion.section 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-32 bg-indigo-900 rounded-[48px] p-8 sm:p-12 text-white relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/10 mb-8">
                <Code2 size={14} className="text-indigo-300" />
                <span className="text-[10px] font-black text-indigo-100 uppercase tracking-widest">Sous le capot : Prompt Engineering</span>
              </div>
              <h2 className="text-3xl font-black mb-6 leading-tight">Nous ne demandons pas juste un résumé.</h2>
              <p className="text-indigo-100/80 mb-10 leading-relaxed font-medium">
                Le secret de la pertinence de NewsAI réside dans nos instructions précises. Voici un extrait de ce que nous envoyons à nos modèles pour chaque article :
              </p>
              
              <div className="bg-black/40 backdrop-blur-md rounded-2xl p-6 font-mono text-sm text-indigo-200 border border-white/10 overflow-x-auto leading-relaxed">
                <p className="mb-4 text-indigo-400 opacity-60">// System Prompt Fragment</p>
                <p className="">"Tu es une IA de filtre cognitif. Évalue cet article selon le profil utilisateur.</p>
                <p className="text-green-400">SI l'article impacte directement la vie quotidienne (taxes, lois locales, secteur pro),</p>
                <p className="">ALORS attribue un score de conformité de 90+ même si le sujet est hors des intérêts habituels.</p>
                <p className="mt-4">DÉTECTE les biais suivants : Pente Glissante, Faux Dilemme, Cadrage Idéologique.</p>
                <p className="">RÉDIGE un titre informatif concret, supprime tout clickbait."</p>
              </div>
            </div>
            {/* Background elements */}
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/20 rounded-full blur-[100px]" />
          </motion.section>

          {/* REASSURANCE SECTION */}
          <section className="mt-32 text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-indigo-100 shadow-sm">
              <ShieldCheck size={32} className="text-indigo-600" />
            </div>
            <h2 className="text-3xl font-black mb-6 tracking-tight">Votre vie privée est isolée.</h2>
            <p className="text-gray-500 max-w-[600px] mx-auto leading-relaxed font-medium mb-12">
              Votre "Manifesto" est stocké de manière sécurisée et n'est utilisé que pour le matching sémantique local. Nous ne vendons jamais vos données et n'entraînons aucun modèle tiers avec vos préférences personnelles.
            </p>
            <button 
              onClick={() => router.push("/signup")}
              className="bg-indigo-600 text-white px-10 py-5 rounded-full text-lg font-black shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
            >
              Créer mon compte en toute confiance
            </button>
          </section>
        </div>
      </main>

      <footer className="mt-32 py-12 px-6 border-t border-black/[0.03]">
        <div className="max-w-[800px] mx-auto flex flex-col sm:flex-row justify-between items-center gap-6 text-gray-400 text-sm font-bold">
          <div className="flex items-center gap-4">
             <span>© 2026 NewsAI Docs</span>
             <a href="/developers" className="text-indigo-600 hover:underline">Accès Développeur</a>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-gray-900 transition-colors">Sécurité</a>
            <a href="#" className="hover:text-gray-900 transition-colors">RGPD</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
