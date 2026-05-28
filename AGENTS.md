# 🏛️ AGENTS.md — Directives d'Assistance pour News.ai

Ce document définit les standards de développement, de design et de comportement pour toute Intelligence Artificielle (ou assistant) travaillant sur le projet **News.ai**.

---

## 🚀 1. Vision & Identité
**News.ai** est un kiosque de presse digitale **Premium / Slow-News**. 
L'objectif est d'offrir une expérience de lecture immersive, apaisée et crédible. L'IA agit comme un curateur discret, jamais comme un générateur de "hype".

*   **Lien Emotionel**: L'interface doit rappeler un journal papier de luxe (ex: *The Guardian*, *Financial Times*) adapté au numérique.
*   **Crédibilité**: Toujours mettre en avant les scores de confiance et les sources multiples.

---

## 🎨 2. Design System & Esthétique (LEAN DESIGN)

### ⚪ Couleurs & Thème
*   **Fond principal** : `#FDFCF8` (Ivoire/Papier).
*   **Palette** : Strictement **Zinc / Monochrome** (Noir, Blanc, Gris).
*   **Interdit** : Pas de bleu, violet, indigo ou dégradés "Tech" flashy. Les couleurs vives (Rouge) sont réservées aux urgences (Flash/Impact).

### 🖋️ Typographie
*   **Titres / Titraille** : **Serif** (avec des accents en *italique* et parfois en minuscule pour un rendu artisanal/éditorial). *Note: Préférer parfois l'italique et le lowercase pour les titres de section ornementaux.*
*   **Méta-données / Chiffres** : **Sans-serif** (ex: *Inter* ou équivalent).
*   **Interligne** : Doit "respirer". Les résumés doivent avoir un `line-height` généreux (ex: `leading-[1.8]` ou plus).

### 📐 Mise en page & Composants
*   **Espaces** : Favoriser les espaces blancs (`padding/margin`) plutôt que les bordures épaisses ou les ombres lourdes.
*   **Bordures** : Si nécessaires, elles doivent être très fines (`border-zinc-200` ou `border-black/[0.05]`).
*   **Éléments Flottants** : (ex: `BottomNavbar`) doivent être discrets et réactifs (masquer au scroll descendant, afficher au scroll ascendant ou survol).
*   **Flux de contenu** : Éviter les séparateurs de catégories trop lourds; le flux doit être continu et fluide (Journal Imprimé).

---

## 🛠️ 3. Stack Technique & Structure

*   **Frontend (`web/`)** : 
    *   Framework: Next.js 14 (App Router).
    *   Styles: Tailwind CSS.
    *   Animations: **Framer Motion** (Subtiles, lentes, physiques).
*   **Backend (`backend/` & `scraper/`)** :
    *   Framework: FastAPI (Python 3.11).
    *   Data: PostgreSQL / Supabase.
    *   Communication: Router/Ingress unifié via Kubernetes en prod.

---

## 🤖 4. Règles de Conduite pour l'IA

1.  **Vérifier avant de créer** : Toujours vérifier si un composant (ex: `SafeImage`, `NewsCard`, `ErrorEmptyState`) ou un utilitaire existe déjà avant d'en créer un nouveau.
2.  **Appels API (`useApi`)** : Ne jamais utiliser `fetch` brut pour les requêtes authentifiées. Utiliser le hook `useApi()` qui injecte les headers `Authorization` et gère les redirections `/login` en cas de 401/403.
    *   *Exemple*: `api.get("/api/brief")` ou `api.post("/api/brief/analyze", { ... })`.
    *   *Annulation*: Toujours utiliser un `AbortController` dans les `useEffect` pour éviter les fuites de mémoire lors des fetchs différés.
3.  **Zéro String "en Dur" (Traductions)** : Toutes les chaînes de caractères visibles doivent passer par `translations.ts` (ex: `commonLabels[lang].back`).
4.  **Feedback d'Actions** : Toujours câbler les boutons d'intérêt/rejet vers `/api/feedback` pour maintenir l'apprentissage continu du modèle Mizan.
5.  **Respecter l'Architecture** : Ne pas mélanger la logique du Gateway (Backend) avec la génération brute du Scraper.
6.  **Préservation du Style** : 
    *   Ne jamais modifier un fichier de design sans vérifier qu'il respecte le combo Zinc + `#FDFCF8`.
    *   Chaque modal doit être un chef-d'œuvre de sobriété (Museum-like).
7.  **Gestion d'États** : S'assurer que les flux gèrent proprement les transitions (`isLoading`, `error`) via les squelettes ou états "Empty".

---

*Document maintenu par l'équipe Mizan.ai & ses assistants IA. (Dernière mise à jour : Mars 2026)*
