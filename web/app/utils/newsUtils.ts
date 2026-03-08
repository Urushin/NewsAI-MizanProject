export const CLEAN_SOURCE_MAP: Record<string, string> = {
    "lesechos.fr": "Les Échos",
    "lemonde.fr": "Le Monde",
    "lefigaro.fr": "Le Figaro",
    "liberation.fr": "Libération",
    "bfmtv.com": "BFMTV",
    "tf1info.fr": "TF1 Info",
    "midilibre.fr": "Midi Libre",
    "la-croix.com": "La Croix",
    "challenges.fr": "Challenges",
    "investir.lesechos.fr": "Investir",
    "latribune.fr": "La Tribune",
    "lepoint.fr": "Le Point",
    "lexpress.fr": "L'Express",
    "nouvelobs.com": "L'Obs",
    "sudouest.fr": "Sud Ouest",
    "leparisien.fr": "Le Parisien",
    "boursier.com": "Boursier.com",
    "zonebourse.com": "Zonebourse",
    "capital.fr": "Capital",
    "marianne.net": "Marianne",
    "valeursactuelles.com": "Valeurs Actuelles",
    "huffingtonpost.fr": "HuffPost",
    "20minutes.fr": "20 Minutes",
    "francetvinfo.fr": "France Info",
    "futura-sciences.com": "Futura Sciences",
    "presse-citron.net": "Presse-Citron",
    "phonandroid.com": "Phonandroid",
    "frandroid.com": "Frandroid",
    "numerama.com": "Numerama",
    "usinenouvelle.com": "L'Usine Nouvelle"
};

export function formatSourceName(domain: string, backendName?: string): string {
    if (backendName && !backendName.toLowerCase().includes("google")) {
        return backendName;
    }
    return CLEAN_SOURCE_MAP[domain] || domain;
}

export function extractDomain(url: string): string {
    try {
        return new URL(url).hostname.replace("www.", "");
    } catch {
        return "";
    }
}

/**
 * Robust logic to separate title and source name, and clean the source name.
 */
export function parseTitleAndSource(rawTitle: string, link: string, backendSourceName?: string) {
    let title = rawTitle;
    const domain = extractDomain(link);
    let sName = backendSourceName;

    // Google News style splitting "Title - Media"
    if (!sName) {
        const parts = title.split(" - ");
        if (parts.length > 1) {
            const potentialSource = parts[parts.length - 1].trim();
            if (potentialSource.length < 25 && potentialSource.length > 2) {
                sName = potentialSource;
                title = parts.slice(0, -1).join(" - ").trim();
            }
        }
    }

    const finalSourceName = formatSourceName(domain, sName);

    return { title, sourceName: finalSourceName, domain };
}

export function getInitials(name: string): string {
    if (!name) return "??";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

export function digestToBullets(summary: string | string[]): string[] {
    if (Array.isArray(summary)) {
        return summary.map((s) => s.trim()).filter((s) => s.length > 5);
    }
    return summary
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10);
}
