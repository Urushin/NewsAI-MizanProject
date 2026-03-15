"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { landingLabels } from "./config/translations";
import { 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  ChevronRight, 
  ArrowRight,
  CheckCircle2
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [lang, setLang] = useState("fr");

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const browserLang = navigator.language.split("-")[0];
      if (landingLabels[browserLang]) setLang(browserLang);
    }
  }, []);

  const t = landingLabels[lang] || landingLabels.en;

  const features = [
    {
      icon: Zap,
      title: t.feat1Title,
      description: t.feat1Desc
    },
    {
      icon: ShieldCheck,
      title: t.feat2Title,
      description: t.feat2Desc
    },
    {
      icon: Sparkles,
      title: t.feat3Title,
      description: t.feat3Desc
    }
  ];

  const plans = [
    {
      name: "Journal Standard",
      price: "0€",
      features: ["1 Briefing quotidien", "Sources limitées", "Analyse standard", "Accès mobile"],
      button: "Commencer la Lecture",
      active: false
    },
    {
      name: "NewsAI Pro",
      price: "12€",
      priceSub: "/mois",
      features: ["Briefings illimités", "Indexation mondiale", "Analyse profonde", "Export PDF Haute Qualité", "Lecture sans distraction"],
      button: "S'abonner au Kiosque",
      active: true
    },
    {
      name: "Rédaction Enterprise",
      price: "Sur mesure",
      features: ["Accès API complet", "Support Dédié", "Infrastructure isolée", "Personnalisation totale"],
      button: "Contacter l'Imprimerie",
      active: false
    }
  ];

  return (
    <div className="min-h-screen bg-[#FDFCF8] text-zinc-900 font-sans selection:bg-zinc-200 overflow-x-hidden">
      
      {/* Premium Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FDFCF8]/90 backdrop-blur-md border-b border-zinc-200 px-6 py-5 md:px-12">
        <div className="max-w-7xl mx-auto flex justify-between items-center font-serif">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-[900] tracking-tighter">N.</span>
            <div className="h-6 w-[1px] bg-zinc-200 mx-2 hidden sm:block" />
            <span className="font-[900] text-sm tracking-[0.3em] uppercase hidden sm:block">NewsAI</span>
          </div>
          <div className="flex items-center gap-8 font-sans">
            <button 
              onClick={() => router.push("/login")}
              className="text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              Accès Lecteur
            </button>
            <button 
              onClick={() => router.push("/signup")}
              className="bg-zinc-900 text-white px-6 py-2.5 text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95"
            >
              Subscription
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-40">
        {/* HERO SECTION */}
        <section className="px-6 pb-32">
          <div className="max-w-5xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-zinc-100 border border-zinc-200 mb-10">
                <Sparkles size={14} className="text-zinc-900" />
                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Édition Numérique Indépendante</span>
              </div>
              
              <h1 className="text-[clamp(3rem,10vw,6.5rem)] font-[900] leading-[0.95] tracking-tighter mb-10 font-serif lowercase italic">
                {t.heroTitle1} <br />
                <span className="text-zinc-400 font-sans uppercase tracking-[0.2em] italic text-[0.4em] block mt-4 font-black">{t.heroTitle2}</span>
              </h1>
              
              <p className="text-zinc-500 text-lg sm:text-xl max-w-[650px] mx-auto mb-16 leading-[1.6] font-serif italic">
                {t.heroSub}
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <button 
                  onClick={() => router.push("/signup")}
                  className="w-full sm:w-auto bg-zinc-900 text-white px-12 py-6 text-[13px] font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-black hover:-translate-y-1 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  Entrer dans le Kiosque <ChevronRight size={18} />
                </button>
                <button 
                  onClick={() => router.push("/how-it-works")}
                  className="w-full sm:w-auto bg-transparent text-zinc-900 border border-zinc-200 px-12 py-6 text-[13px] font-black uppercase tracking-[0.2em] hover:bg-zinc-50 transition-all flex items-center justify-center gap-3"
                >
                  La Méthode NewsAI
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* FEATURES GRID (NEWSPAPER STYLE) */}
        <section className="px-6 py-32 bg-white border-y border-zinc-200">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-100">
              {features.map((f, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.2 }}
                  className="p-12 first:pl-0 last:pr-0"
                >
                  <div className="mb-8">
                     <f.icon size={24} strokeWidth={1.5} className="text-zinc-900" />
                  </div>
                  <h3 className="text-2xl font-[900] mb-5 tracking-tight font-serif italic lowercase">{f.title}</h3>
                  <p className="text-zinc-500 text-[15px] leading-relaxed font-serif italic">{f.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* STATEMENT SECTION */}
        <section className="px-6 py-40 bg-[#FDFCF8] overflow-hidden">
          <div className="max-w-4xl mx-auto text-center relative">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[15rem] font-[900] text-zinc-100/50 -z-10 font-serif">“</div>
             <h2 className="text-3xl md:text-5xl font-[900] text-zinc-900 leading-[1.2] font-serif italic tracking-tight mb-12 lowercase">
                L’information n’est plus une question de quantité, mais de discernement. NewsAI redonne du sens à votre lecture quotidienne.
             </h2>
             <button 
                onClick={() => router.push("/how-it-works")}
                className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-400 hover:text-zinc-900 transition-all underline underline-offset-8 decoration-zinc-200"
             >
                Découvrir l'Architecture de Confiance
             </button>
          </div>
        </section>

        {/* SUBSCRIPTION TABLE */}
        <section className="px-6 py-40 bg-zinc-950 text-white">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end mb-24 gap-8">
               <div className="max-w-2xl">
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mb-6 block">Tarification</span>
                  <h2 className="text-5xl md:text-7xl font-[900] tracking-tighter font-serif italic lowercase">L'accès à l'essentiel.</h2>
               </div>
               <p className="text-zinc-400 text-lg font-serif italic max-w-sm mb-2">Des offres conçues pour les lecteurs les plus exigeants.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 border border-zinc-800">
              {plans.map((p, i) => (
                <motion.div 
                  key={i}
                  className={`p-12 flex flex-col items-start border-zinc-800 border-b md:border-b-0 md:border-r last:border-0 ${p.active ? 'bg-white text-zinc-950' : 'bg-transparent'}`}
                >
                  <span className={`text-[10px] font-black uppercase tracking-widest mb-10 ${p.active ? 'text-zinc-400' : 'text-zinc-500'}`}>{p.name}</span>
                  <div className="flex items-baseline gap-2 mb-12">
                    <span className="text-6xl font-[900] tracking-tighter font-serif">{p.price}</span>
                    {p.priceSub && <span className="text-sm font-bold opacity-50 uppercase tracking-widest">{p.priceSub}</span>}
                  </div>
                  
                  <div className="flex-1 w-full space-y-6 mb-16">
                    {p.features.map((feat, fi) => (
                      <div key={fi} className="flex items-start gap-4">
                        <CheckCircle2 size={14} className={`mt-1 ${p.active ? 'text-zinc-900' : 'text-zinc-500'}`} />
                        <span className="text-[14px] font-bold tracking-tight opacity-80">{feat}</span>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={() => router.push("/signup")}
                    className={`w-full py-5 text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] ${
                      p.active 
                      ? 'bg-zinc-900 text-white shadow-2xl' 
                      : 'bg-transparent border border-zinc-700 text-white hover:bg-zinc-800'
                    }`}
                  >
                    {p.button}
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="px-6 py-40 text-center border-t border-zinc-100">
          <div className="max-w-2xl mx-auto">
             <h2 className="text-4xl font-[900] tracking-tight mb-12 font-serif lowercase italic">Prêt à changer votre rapport à l'actualité ?</h2>
             <button 
                onClick={() => router.push("/signup")}
                className="group relative inline-flex items-center gap-6 text-zinc-900"
             >
                <span className="text-3xl font-[900] font-serif lowercase italic transition-all group-hover:pr-4">Ouvrir votre première édition</span>
                <ArrowRight size={32} className="transition-transform group-hover:translate-x-4" />
             </button>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-zinc-50 border-t border-zinc-200 py-24 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-16">
          <div className="space-y-6 max-w-xs">
            <span className="text-4xl font-[900] font-serif tracking-tighter block">N.</span>
            <p className="text-zinc-400 text-sm font-serif italic leading-relaxed">
               NewsAI est une imprimerie digitale indépendante utilisant l'intelligence artificielle pour synthétiser l'essentiel du monde.
            </p>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">© 2026 NewsAI — Imprimerie Digitale</p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-16">
             <div className="flex flex-col gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-900">Lectures</span>
                <a href="/briefing" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors">Dernière Édition</a>
                <a href="/archive" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors">Archives Kiosk</a>
                <a href="/sources" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors">Index des Sources</a>
             </div>
             <div className="flex flex-col gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-900">Société</span>
                <a href="#" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors">Manifesto</a>
                <a href="/how-it-works" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors">Méthodologie</a>
                <a href="/developers" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors">Documentation</a>
             </div>
             <div className="flex flex-col gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-900">Réseaux</span>
                <a href="#" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors">Twitter (X)</a>
                <a href="#" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors">LinkedIn</a>
             </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
