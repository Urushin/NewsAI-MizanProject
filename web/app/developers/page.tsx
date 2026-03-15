"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Terminal, 
  Cpu, 
  Database, 
  Code2, 
  GitBranch, 
  Layers, 
  ShieldAlert, 
  Zap, 
  Search,
  BookOpen,
  ArrowLeft,
  Server,
  Workflow,
  Fingerprint,
  Box,
  Braces
} from "lucide-react";

export default function DeveloperDocs() {
  const router = useRouter();

  const stack = [
    { name: "Frontend", items: ["Next.js 14 (App Router)", "Framer Motion", "Lucide React", "Tailwind CSS"] },
    { name: "Backend", items: ["FastAPI (Python 3.11+)", "Supabase (Postgres + Vector)", "Loguru", "Firecrawl (Scraping)"] },
    { name: "Intelligent Layer", items: ["Mistral Large 2 (Synthèse)", "GPT-4o (Validation/Biais)", "Mistral Small (Extraction)", "OpenAI Embeddings"] },
  ];

  const pipeline = [
    {
      step: "01. Intake & Vectorization",
      description: "Collection brute via RSS + Firecrawl Search. Le contenu est tronqué (Head-Tail) pour optimiser le contexte LLM (800 chars tête / 400 chars queue).",
      details: "Utilisation de `text-embedding-3-small` pour stocker les articles dans Supabase `vector`. Matching sémantique avec le `manifesto_embedding` de l'utilisateur."
    },
    {
      step: "02. Chimera Clustering",
      description: "Regroupement par similarité de chaînes (difflib) et chevauchement de mots-clés (Keyword Overlap).",
      details: "Seuil de clustering : 0.45. Algorithme maison combinant difflib SequenceMatcher et intersection de sets de mots-clés (top 12 keywords par article)."
    },
    {
      step: "03. The Secretary (Stage 1)",
      description: "Extraction de points de données atomiques par l'IA Mistral Small.",
      details: "Instruction LLM : Extraire UNIQUEMENT des faits bruts d'une phrase. Pas de narration à ce stade pour éviter les hallucinations narratives."
    },
    {
      step: "04. The Surgeon (Stage 2)",
      description: "Algorithme de comparaison local (Python) pour identifier le 'tronc commun' et les 'branches divergentes'.",
      details: "Calcul de similarité Jaccard sur les data points. Si similarité > 0.55, le point est marqué comme 'Commun'. Sinon, il est marqué comme 'Unique' à sa source."
    },
    {
      step: "05. The Analyst (Stage 3)",
      description: "Journalisme de synthèse de haut niveau via Mistral Large 2.",
      details: "L'analyste reçoit les points communs et divergents. Il doit rédiger une synthèse fluide en mentionnant explicitement les incohérences entre sources."
    },
    {
      step: "06. Cognitive Filtering",
      description: "Validation finale avec le 'Cognitive Bias Codex'.",
      details: "Détection de 6 biais majeurs : Pente Glissante, Faux Dilemme, Homme de Paille, Cadrage (Framing), Appel à la Peur, Fausse Équivalence."
    }
  ];

  const prompts = [
    {
      id: "Secretary",
      title: "Extraction de Faits (Mistral Small)",
      content: "You are a data extraction AI. Extract ALL key factual data points from the content. Output ONLY a clean JSON array of strings. Each string is 1 sentence max."
    },
    {
      id: "Analyst",
      title: "Synthèse Journalistique (Mistral Large)",
      content: "You are a senior intelligence analyst. Write a cohesive synthesis. Explicitly mention when sources contradict each other ('Selon X... mais Y affirme...'). Attributes key claims to their sources."
    },
    {
      id: "BiasCodex",
      title: "Cognitive Bias Codex (System)",
      content: "COGNITIVE BIAS CODEX:\n1. Pente Glissante: Prétendre qu'une étape mènera à une catastrophe sans preuve.\n2. Faux Dilemme: Réduire à deux options opposées.\n3. Framing: Utiliser des mots chargés (ex: 'austérité' vs 'optimisation').\n4. Appel à la Peur: Mots apocalyptiques pour paralyser le jugement."
    }
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-gray-300 font-mono selection:bg-indigo-500/30 overflow-x-hidden">
      {/* Dev Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0B]/80 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-[1400px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors border border-white/10"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2">
              <Terminal size={18} className="text-indigo-500" />
              <span className="text-sm font-bold tracking-tighter text-white">NEWSAI_DEV_CORE_V1.2</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-[10px] text-gray-500">STATUS: PRODUCTION_STABLE</span>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-40 px-6 max-w-[1400px] mx-auto">
        {/* Intro Section */}
        <section className="mb-24">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 rounded border border-indigo-500/20 mb-8"
          >
            <Code2 size={12} className="text-indigo-400" />
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Internal Documentation</span>
          </motion.div>
          <h1 className="text-5xl sm:text-7xl font-black text-white tracking-tighter mb-8 leading-none">
            Deep Dive <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 bg-[length:200%_auto] animate-gradient">Infrastructure.</span>
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl font-serif italic">
            "Software is the only domain where the architect and the scientist are the same person." - NewsAI Technical Manifesto.
          </p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* LEFT COLUMN: Stack & Code */}
          <div className="lg:col-span-4 space-y-12">
            {/* Tech Stack Card */}
            <div className="bg-[#111113] border border-white/5 rounded-[32px] p-8">
              <h3 className="text-white font-bold mb-8 flex items-center gap-2">
                <Box size={18} className="text-indigo-500" /> Tech Stack
              </h3>
              <div className="space-y-8">
                {stack.map((group, i) => (
                  <div key={i}>
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-3">{group.name}</span>
                    <ul className="space-y-2">
                      {group.items.map((item, ii) => (
                        <li key={ii} className="text-sm flex items-center gap-2">
                          <span className="w-1 h-1 bg-indigo-500/40 rounded-full" /> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Prompt Repository */}
            <div className="bg-[#111113] border border-white/5 rounded-[32px] p-8">
              <h3 className="text-white font-bold mb-8 flex items-center gap-2">
                <Braces size={18} className="text-indigo-500" /> Prompt Registry
              </h3>
              <div className="space-y-6">
                {prompts.map((p, i) => (
                  <div key={i} className="group cursor-pointer">
                    <span className="text-[11px] font-bold text-indigo-400 block mb-2">{p.title}</span>
                    <div className="bg-black/50 p-4 rounded-xl text-[10px] text-gray-500 font-mono leading-relaxed border border-white/5 group-hover:border-indigo-500/30 transition-all max-h-32 overflow-hidden relative">
                      {p.content}
                      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/80 to-transparent" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: The Pipeline */}
          <div className="lg:col-span-8">
            <div className="bg-[#111113] border border-white/5 rounded-[40px] p-8 sm:p-12">
              <h3 className="text-white font-bold mb-12 flex items-center gap-2">
                <Workflow size={20} className="text-indigo-500" /> Information Lifecycle
              </h3>

              <div className="space-y-16">
                {pipeline.map((step, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="relative pl-12 sm:pl-16 group"
                  >
                    {/* Visual Line Connectors */}
                    {i !== pipeline.length - 1 && (
                      <div className="absolute left-[23px] sm:left-[31px] top-12 bottom-[-64px] w-px bg-white/5 group-hover:bg-indigo-500/20 transition-all" />
                    )}
                    
                    {/* Icon Circle */}
                    <div className="absolute left-0 top-0 w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-black border border-white/10 flex items-center justify-center group-hover:border-indigo-500/50 transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                      <span className="text-xl font-bold text-white group-hover:text-indigo-500 transition-colors">
                        {i + 1}
                      </span>
                    </div>

                    <div className="pt-2">
                      <h4 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">{step.step}</h4>
                      <p className="text-gray-400 text-sm leading-relaxed mb-4 max-w-xl">
                        {step.description}
                      </p>
                      <div className="bg-black/30 p-4 rounded-2xl border border-white/[0.03] inline-block">
                        <div className="flex items-center gap-2 mb-2">
                          <Fingerprint size={12} className="text-indigo-500" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Engine Logic</span>
                        </div>
                        <p className="text-[12px] text-gray-600 leading-relaxed font-serif italic">
                          {step.details}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Hidden Details / Edge Cases */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-[#111113] border border-white/5 rounded-[32px] p-8">
                  <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                    <ShieldAlert size={16} className="text-red-500" /> Edge Cases & Failover
                  </h4>
                  <ul className="space-y-3 text-[12px] text-gray-500 list-disc pl-4">
                    <li>Graceful degradation: Si Chimera échoue, le système bascule sur un résumé simple via Batch.</li>
                    <li>Head-Tail Clipping: Protection contre les articles trop longs qui saturent la fenêtre de contexte.</li>
                    <li>Automatic Anti-Hallucination: Le pipeline rejette toute synthèse dont le titre n'apparaît pas dans les sources d'origine.</li>
                  </ul>
               </div>
               <div className="bg-[#111113] border border-white/5 rounded-[32px] p-8">
                  <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                    <Zap size={16} className="text-amber-500" /> Optimization Signals
                  </h4>
                  <ul className="space-y-3 text-[12px] text-gray-500 list-disc pl-4">
                    <li>Throttling: Délai de 0.5s par requête Google News pour éviter le ban IP.</li>
                    <li>Token Tracker: Log quotidien de la consommation par modèle pour monitoring des coûts.</li>
                    <li>Async Scraper: Collecte de 100+ articles en moins de 15 secondes via httpx.</li>
                  </ul>
               </div>
            </div>
          </div>

        </div>

        {/* Footer info */}
        <section className="mt-40 border-t border-white/5 pt-12 flex flex-col sm:flex-row justify-between items-center gap-8">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-500 rounded flex items-center justify-center text-black font-black">N</div>
              <div>
                 <p className="text-sm font-bold text-white">NewsAI Project</p>
                 <p className="text-[10px] text-gray-500 uppercase tracking-widest">Cognitive News Protocol v1.2</p>
              </div>
           </div>
           <div className="flex gap-8 text-[11px] font-bold text-gray-500 tracking-widest uppercase">
              <a href="#" className="hover:text-indigo-500">API Docs</a>
              <a href="#" className="hover:text-indigo-500">Spec Repo</a>
              <a href="#" className="hover:text-indigo-500">Contribute</a>
           </div>
        </section>
      </main>
      
      {/* Background Ambience */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />
    </div>
  );
}
