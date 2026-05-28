"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Globe as GlobeIcon, X, MapPin, Search } from "lucide-react";
import BottomNavbar from "../components/BottomNavbar";
import { usePlatform } from "../../hooks/usePlatform";
import { ImpactStyle } from "@capacitor/haptics";
import { useAuth } from "../context/AuthContext";
import { mapLabels } from "../config/translations";
import { triggerHaptic as triggerHapticUtil } from "../utils/haptics";


// Dynamic import for react-globe.gl to avoid SSR errors
const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

export default function MapPage() {
    const { isNative } = usePlatform();
    const { user } = useAuth();
    const lang = user?.language || "fr";
    const t = mapLabels[lang] || mapLabels.en;

    const [countries, setCountries] = useState<any>({ features: [] });
    const [selectedCountry, setSelectedCountry] = useState<any>(null);
    const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

    const triggerHaptic = async (style = ImpactStyle.Light) => {
        if (style === ImpactStyle.Heavy) {
            await triggerHapticUtil.success();
        } else if (style === ImpactStyle.Medium) {
            await triggerHapticUtil.medium();
        } else {
            await triggerHapticUtil.light();
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        // Fetch public GeoJSON dataset for country coordinates/rendering
        fetch("https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson", {
            signal: controller.signal
        })
            .then(res => res.json())
            .then(setCountries)
            .catch(err => {
                if (err.name !== 'AbortError') {
                    console.error("Globe GeoJSON load error:", err);
                }
            });
        return () => {
            controller.abort();
        };
    }, []);

    const mockNews = [
        { id: 1, title: t.geopoliticalTensions, date: lang === "fr" ? "Il y a 2h" : "2h ago", source: t.mockSourceAI },
        { id: 2, title: t.historicTradeAgreement, date: lang === "fr" ? "Il y a 4h" : "4h ago", source: "Financial Times" },
        { id: 3, title: t.newClimateSummit, date: lang === "fr" ? "Hier" : "Yesterday", source: "Le Monde" }
    ];

    return (
        <div className="relative w-full h-screen bg-[#FDFCF8] text-zinc-900 overflow-hidden select-none">
            
            {/* 📍 Top Navigation Bar overlay */}
             <div className={`absolute top-0 left-0 right-0 z-50 px-8 py-6 flex justify-between items-center bg-gradient-to-b from-[#FDFCF8]/90 to-transparent backdrop-blur-sm ${
                isNative ? "safe-top pt-8" : "border-b border-zinc-200/50"
            }`}>
                <div className="flex items-center gap-3">
                    <GlobeIcon size={20} className="text-zinc-800 animate-pulse" />
                    <div>
                        <h1 className="text-lg font-bold tracking-tight text-zinc-900 font-sans leading-none">{t.title}</h1>
                        <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-1">{t.subtitle}</p>
                    </div>
                </div>
                
                {/* Visual feedback on Hover */}
                {hoveredCountry && !isNative && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 border border-zinc-200 rounded-full text-xs font-black tracking-widest shadow-sm text-zinc-800">
                        🌍 {hoveredCountry}
                    </motion.div>
                )}
                
                {!isNative && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => window.history.back()} className="text-[11px] font-black uppercase bg-white border border-zinc-200 px-4 py-2 hover:bg-zinc-50 transition-colors text-zinc-800 rounded-full shadow-sm">{t.back}</button>
                    </div>
                )}
            </div>

            {/* 🌍 3D Globe Component */}
            <div className="w-full h-full cursor-grab active:cursor-grabbing">
                <Globe
                    backgroundColor="rgba(253, 252, 248, 1)"
                    globeImageUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgDTD2qgAAAAASUVORK5CYII="
                    atmosphereColor={isNative ? "rgba(0,0,0,0)" : "rgba(0, 0, 0, 0.05)"}
                    showAtmosphere={!isNative}
                    polygonsData={countries.features}
                    polygonAltitude={isNative ? 0.005 : ((d: any) => d === selectedCountry ? 0.02 : 0.005)}
                    polygonCapColor={isNative 
                        ? ((d: any) => d === selectedCountry ? "rgba(234, 88, 12, 0.7)" : "rgba(0, 0, 0, 0.03)")
                        : ((d: any) => {
                            if (d === selectedCountry) return "rgba(234, 88, 12, 0.7)";
                            if (d.properties.NAME === hoveredCountry) return "rgba(0, 0, 0, 0.08)";
                            return "rgba(0, 0, 0, 0.03)";
                        })
                    }
                    polygonSideColor={() => "rgba(0, 0, 0, 0.02)"}
                    polygonStrokeColor={() => "rgba(0, 0, 0, 0.1)"}
                    polygonLabel={isNative ? undefined : ((d: any) => `<b style="color: #18181b; font-family: sans-serif; font-size: 11px;">${d.properties.NAME}</b>`)}
                    rendererConfig={isNative ? { antialias: false, alpha: true, precision: 'mediump' } : undefined}
                    onPolygonHover={isNative ? undefined : ((d: any) => {
                        if (d) setHoveredCountry(d.properties.NAME);
                        else setHoveredCountry(null);
                    })}
                    onPolygonClick={(d: any) => {
                        triggerHaptic(ImpactStyle.Light);
                        setSelectedCountry(d);
                    }}
                />
            </div>

            {/* 🧾 Side Drawer / Bottom Sheet logic */}
            <AnimatePresence>
                {selectedCountry && (
                    <motion.div 
                        initial={isNative ? { y: "100%" } : { x: "100%", opacity: 0 }} 
                        animate={isNative ? { y: 0 } : { x: 0, opacity: 1 }} 
                        exit={isNative ? { y: "100%" } : { x: "100%", opacity: 0 }} 
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className={`absolute z-[110] flex flex-col bg-[#FDFCF8]/95 backdrop-blur-xl shadow-2xl text-zinc-900 border-zinc-200 ${
                            isNative 
                                ? "left-0 right-0 bottom-0 h-[60dvh] rounded-t-[30px] border-t pb-16" 
                                : "right-0 top-0 bottom-0 w-full sm:w-[400px] border-l"
                        }`}
                    >
                        {isNative && (
                            <div className="w-12 h-1 bg-zinc-200 rounded-full mx-auto mt-4 shrink-0" />
                        )}

                        {/* Drawer Header */}
                        <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-transparent">
                            <div className="flex items-center gap-2">
                                <MapPin size={16} className="text-orange-600 animate-bounce" />
                                <span className="text-base font-bold tracking-tight uppercase font-sans">{(selectedCountry as any).properties.NAME}</span>
                            </div>
                            <button onClick={() => { triggerHaptic(); setSelectedCountry(null); }} className="w-8 h-8 rounded-full bg-zinc-100/80 flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-colors">
                                <X size={16} />
                            </button>
                        </div>

                        {/* List items scrollable container */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{t.recentDispatches}</h4>
                                <span className="text-[10px] bg-orange-500/10 text-orange-600 px-2 py-0.5 rounded font-bold">{mockNews.length} {t.activeNews}</span>
                            </div>

                            {mockNews.map((n) => (
                                <motion.div 
                                    key={n.id} 
                                    initial={{ opacity: 0, y: 10 }} 
                                    animate={{ opacity: 1, y: 0 }} 
                                    className="p-4 border border-zinc-100 bg-white hover:bg-zinc-50 transition-all cursor-pointer group rounded-[16px] shadow-[0_8px_30px_rgb(0,0,0,0.01)]"
                                >
                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block group-hover:text-orange-600 transition-colors">{n.source}</span>
                                    <h5 className="text-[13px] font-bold font-sans mb-2 tracking-tight leading-snug text-zinc-800">{n.title}</h5>
                                    <span className="text-[10px] text-zinc-400 font-medium">{n.date}</span>
                                </motion.div>
                            ))}
                        </div>

                        {/* Drawer Footer Actions */}
                        <div className="p-6 border-t border-zinc-100 bg-[#FDFCF8]">
                            <button onClick={() => triggerHaptic(ImpactStyle.Heavy)} className="w-full py-4 bg-zinc-900 text-white text-center text-[11px] font-black uppercase tracking-widest hover:bg-black transition-colors rounded-full shadow-sm">
                                {t.openFullStream}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <BottomNavbar />

        </div>
    );
}
