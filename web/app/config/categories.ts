import { Newspaper, Building2, Coffee, Sparkles, MonitorPlay } from "lucide-react";

export const TIER_KEYS = {
  TRENDING: "Ce que vous avez manqué ce matin",
  SECTOR: "L'essentiel de votre secteur",
  PASSION: "Lecture détente (Passion)",
} as const;

export const CATEGORY_META: Record<
  string,
  { icon: any; labelKey?: string; color: string; bg: string; defaultLabel: string }
> = {
  [TIER_KEYS.TRENDING]: {
    icon: Sparkles,
    labelKey: "tier1",
    color: "text-zinc-900",
    bg: "bg-transparent",
    defaultLabel: "À la Une",
  },
  [TIER_KEYS.SECTOR]: {
    icon: Building2,
    labelKey: "tier2",
    color: "text-zinc-900",
    bg: "bg-transparent",
    defaultLabel: "Secteur",
  },
  [TIER_KEYS.PASSION]: {
    icon: Coffee,
    labelKey: "tier3",
    color: "text-zinc-900",
    bg: "bg-transparent",
    defaultLabel: "Détente",
  },
};

export function getCategoryMeta(cat: string) {
  return CATEGORY_META[cat] || { icon: Newspaper, defaultLabel: cat || "Actualité", color: "text-zinc-900", bg: "bg-transparent" };
}
