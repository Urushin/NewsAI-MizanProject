"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { User, Newspaper, Layers } from "lucide-react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import ProfilePopup from "./ProfilePopup";
import { BriefData } from "../types/news";
import { useAuth } from "../context/AuthContext";
import { commonLabels } from "../config/translations";

interface BottomNavbarProps {
  onProfilePreview?: (data: BriefData) => void;
}

export default function BottomNavbar({ onProfilePreview }: BottomNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const c = commonLabels[user?.language || "fr"] || commonLabels.en;

  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious() || 0;
    if (latest > previous && latest > 150) {
      setHidden(true);
    } else {
      setHidden(false);
    }
  });

  const navItems = [
    {
      label: c.navBrief,
      icon: Newspaper,
      path: "/briefing",
      action: () => router.push("/briefing"),
    },
    {
      label: "Sources",
      icon: Layers,
      path: "/sources",
      action: () => router.push("/sources"),
    },
    {
      label: "Lecteur",
      icon: User,
      isProfile: true,
    },
  ];

  return (
    <div 
      className="fixed bottom-6 md:bottom-10 left-0 right-0 z-[100] flex justify-center px-6 pointer-events-none print:hidden"
      onMouseEnter={() => setHidden(false)}
    >
      <motion.nav
        variants={{
          visible: { y: 0, opacity: 1, scale: 1 },
          hidden: { y: 100, opacity: 0, scale: 0.95 }
        }}
        initial="visible"
        animate={hidden ? "hidden" : "visible"}
        transition={{ duration: 0.35, ease: "easeInOut" }}
        className="pointer-events-auto flex items-center gap-1 sm:gap-4 p-1.5 sm:p-2 bg-zinc-950/90 backdrop-blur-xl border border-zinc-800 rounded-full shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)]"
      >
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;

          if (item.isProfile) {
            return (
              <ProfilePopup 
                 key="profil"
                 onPreview={onProfilePreview}
                 customTrigger={
                   <button
                     className={`flex items-center gap-3 px-5 py-3 transition-colors duration-300 rounded-full hover:bg-zinc-800`}
                   >
                     <Icon 
                       size={18} 
                       className={`transition-colors text-zinc-400 group-hover:text-white`} 
                     />
                     <span className={`text-[10px] font-bold uppercase tracking-widest text-zinc-400 group-hover:text-white transition-colors hidden sm:block`}>
                       {item.label}
                     </span>
                   </button>
                 }
              />
            );
          }

          return (
            <button
              key={item.path}
              onClick={item.action}
              className={`relative flex items-center gap-3 px-5 py-3 rounded-full transition-all duration-300 ${isActive ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
            >
              <Icon
                size={18}
                className={`transition-colors`}
              />
              <span className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isActive ? 'block' : 'hidden sm:block'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </motion.nav>
    </div>
  );
}
