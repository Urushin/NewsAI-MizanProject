import { NewsItem } from "../types/news";
import { briefLabels } from "../config/translations";
import { TIER_KEYS } from "../config/categories";

export function groupByCategory(articles: NewsItem[]) {
  const sectionsMap = new Map<string, Map<string, NewsItem[]>>();
  const TIERS = [
    TIER_KEYS.TRENDING,
    TIER_KEYS.SECTOR,
    TIER_KEYS.PASSION
  ];
  TIERS.forEach(t => sectionsMap.set(t, new Map()));

  for (const item of articles) {
    let targetTier: string = TIER_KEYS.PASSION;
    const isHighImpact = item.gate_passed === "impact" || item.category === "Impact" || (item.score && item.score >= 90);
    const isStrategic = ["Business", "Tech", "Security"].includes(item.category) || (item.score && item.score >= 75);

    if (isHighImpact) {
      targetTier = TIER_KEYS.TRENDING;
    } else if (isStrategic) {
      targetTier = TIER_KEYS.SECTOR;
    }

    const subCat = item.sub_category || "Général";
    const subMap = sectionsMap.get(targetTier)!;
    if (!subMap.has(subCat)) subMap.set(subCat, []);
    subMap.get(subCat)!.push(item);
  }

  const result: { category: string; subGroups: { subCategory: string; items: NewsItem[] }[] }[] = [];
  for (const tier of TIERS) {
    const subMap = sectionsMap.get(tier)!;
    if (subMap.size === 0) continue;

    const subGroups = Array.from(subMap.entries()).map(([subCategory, items]) => ({
      subCategory,
      items
    })).sort((a, b) => {
      const aFused = a.items.some(i => i.is_fused);
      const bFused = b.items.some(i => i.is_fused);
      if (aFused !== bFused) return aFused ? -1 : 1;
      return 0;
    });

    result.push({ category: tier, subGroups });
  }
  return result;
}

export function formatDateTitle(dateStr?: string, lang: string = "fr"): string {
    try {
      const d = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
      const locale = lang === "fr" ? "fr-FR" : lang === "ja" ? "ja-JP" : "en-US";
      const formatted = d.toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
        return briefLabels[lang]?.title || "Briefing";
    }
}
