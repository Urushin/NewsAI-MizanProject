"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { User, Newspaper, Layers, Globe, Menu } from "lucide-react";
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from "framer-motion";
import ProfilePopup from "./ProfilePopup";
import { BriefData } from "../types/news";
import { useAuth } from "../context/AuthContext";
import { commonLabels } from "../config/translations";
import { usePlatform } from "../../hooks/usePlatform";
import { triggerHaptic } from "../utils/haptics";

interface BottomNavbarProps {
  onProfilePreview?: (data: BriefData) => void;
}

export default function BottomNavbar({ onProfilePreview }: BottomNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { isNative } = usePlatform();
  const [showMenu, setShowMenu] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
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
      label: "Map",
      icon: Globe,
      path: "/map",
      action: () => router.push("/map"),
    },
    {
      label: "Lecteur",
      icon: User,
      isProfile: true,
    },
  ];

  const renderNav = () => {
    if (isNative) {
      return (
        <>
          {/* Toggle Menu Button */}
          <div className="fixed bottom-6 left-0 right-0 z-[100] flex justify-center pointer-events-none print:hidden">
            <button 
              onClick={() => {
                triggerHaptic.medium();
                setShowMenu(prev => !prev);
              }}
              className={`pointer-events-auto w-12 h-12 rounded-full border flex items-center justify-center active:scale-90 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.06)] ${
                showMenu 
                  ? "bg-zinc-950 border-zinc-900 text-white" 
                  : "bg-white border-zinc-200 text-zinc-950"
              }`}
            >
              <Menu size={18} />
            </button>
          </div>

          {/* Floating Menu Dock */}
          <AnimatePresence>
            {showMenu && (
              <div className="fixed bottom-24 left-0 right-0 z-[100] flex justify-center px-6 pointer-events-none print:hidden">
                <motion.nav
                  initial={{ y: 30, opacity: 0, scale: 0.95 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 30, opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="pointer-events-auto flex items-center gap-2 p-1.5 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-full shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)]"
                >
                  {navItems.map((item) => {
                    const isActive = pathname === item.path;
                    const Icon = item.icon;

                    if (item.isProfile) {
                      return (
                        <button
                          key="profil"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic.light();
                            setProfileOpen(true);
                            setShowMenu(false);
                          }}
                          className="flex items-center justify-center w-11 h-11 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                        >
                          <Icon size={18} />
                        </button>
                      );
                    }

                    return (
                      <button
                        key={item.path}
                        onClick={() => {
                          triggerHaptic.light();
                          setShowMenu(false);
                          item.action?.();
                        }}
                        className={`flex items-center justify-center w-11 h-11 rounded-full transition-all duration-300 ${
                          isActive 
                            ? 'bg-zinc-100 text-zinc-900' 
                            : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                        }`}
                      >
                        <Icon size={18} />
                      </button>
                    );
                  })}
                </motion.nav>
              </div>
            )}
          </AnimatePresence>
        </>
      );
    }

    return (
      <div 
        className="fixed bottom-0 left-0 right-0 z-[100] flex justify-center px-6 pointer-events-none print:hidden"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
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
                <button
                  key="profil"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic.light();
                    setProfileOpen(true);
                  }}
                  className="flex items-center gap-3 px-5 py-3 transition-colors duration-300 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white"
                >
                  <Icon 
                    size={18} 
                    className="transition-colors text-zinc-400 group-hover:text-white" 
                  />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 group-hover:text-white transition-colors hidden sm:block">
                    {item.label}
                  </span>
                </button>
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
  };

  return (
    <>
      {renderNav()}
      <ProfilePopup 
        isOpen={profileOpen} 
        onClose={() => setProfileOpen(false)} 
        onPreview={onProfilePreview} 
      />
    </>
  );
}
