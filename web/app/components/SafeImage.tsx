"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";

interface SafeImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackType?: "screenshot" | "icon" | "gradient";
  domain?: string;
}

export default function SafeImage({ src, alt, className = "", fallbackType = "icon", domain }: SafeImageProps) {
  const [error, setError] = useState(false);
  
  // Construct fallback screenshot URL if requested
  const screenshotUrl = domain ? `https://v1.screenshot.11ty.dev/${encodeURIComponent(domain)}/large/` : null;
  const finalSrc = error || !src ? (fallbackType === "screenshot" ? screenshotUrl : null) : src;

  if (error || !finalSrc) {
    return (
      <div className={`flex flex-col items-center justify-center bg-zinc-50 border border-zinc-100 text-zinc-300 ${className}`}>
        {fallbackType === "icon" ? (
          <>
            <ImageIcon size={20} strokeWidth={1} />
            <span className="text-[8px] font-black mt-2 tracking-[0.2em] uppercase">NewsAI Archive</span>
          </>
        ) : (
          <div className="w-full h-full bg-zinc-50" />
        )}
      </div>
    );
  }

  return (
    <img
      src={finalSrc}
      alt={alt}
      className={className}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}
