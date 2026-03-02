# 🏛️ Mizan.ai — Ton Filtre d'Actualité Intelligent par IA

Mizan.ai est un agrégateur d'actualités SaaS de nouvelle génération qui utilise l'Intelligence Artificielle pour transformer un flux d'informations massif en un briefing quotidien ultra-personnalisé. 

Le projet repose sur une architecture "Lean" et performante, séparant le traitement lourd (Python/IA) de l'interface utilisateur (Next.js/Supabase).

---

## 🚀 Vision du Projet

Dans un monde saturé d'informations, Mizan.ai agit comme un curateur cognitif. Il ne se contente pas de regrouper des articles ; il les **filtre**, les **classe** et les **résume** en fonction de ton "Manifeste" personnel (ta vision du monde et tes intérêts réels).

---

## ✨ Fonctionnalités Clés

- **Briefing Quotidien Personnalisé** : Un résumé exécutif de ta journée en 3 phrases, suivi des articles les plus pertinents.
- **Filtrage Cognitif par IA** : Double passage de validation (Embeddings + LLM) pour éliminer le bruit et ne garder que l'essentiel.
- **Classification "Impact vs Passion"** : Distinction claire entre ce qui change le monde et ce qui nourrit tes centres d'intérêt.
- **Recherche Sémantique (Vector Search)** : Utilisation de `pgvector` pour faire correspondre les articles à ton profil de manière conceptuelle, pas seulement par mots-clés.
- **Dashboard Moderne** : Interface fluide construite avec Next.js 14, Framer Motion et Tailwind CSS.
- **Gestion SaaS Complète** : Authentification Supabase, politiques de sécurité RLS, et intégration Stripe pour les abonnements.

---

## 🛠️ Stack Technique

### Backend (Le Cerveau)
- **Framework** : FastAPI (Python 3.9+)
- **Scraping** : Firecrawl SDK & Feedparser (Asynchrone avec `httpx`)
- **Intelligence Artificielle** : 
    - LLM : Mistral AI (modèles Large/Small)
    - Embeddings : Mistral/OpenAI
- **Traitement** : Pipeline de filtrage cognitif, Job Queue pour le traitement asynchrone.

### Frontend (L'Expérience)
- **Framework** : Next.js 14 (App Router)
- **Styling** : Tailwind CSS
- **Animations** : Framer Motion
- **Architecture** : React Server Components (RSC) pour la performance.

### Infrastructure & Data
- **Base de données** : Supabase (Postgres)
- **Vecteurs** : pgvector pour la similarité sémantique.
- **Auth** : Supabase Auth (JWT).
- **Paiements** : Stripe.

---

## 📁 Structure du Projet

```text
PROJET_NEWSAI/
├── backend/          # API FastAPI, Logic IA & Scraping
├── web/              # Interface Next.js (Frontend)
├── supabase/         # Scripts SQL, Migrations & RLS
├── scripts/          # Utilitaires (Seed, Reset, Tests)
├── docs/             # Documentation & Notes de tâches
├── logs/             # Fichiers de log (debug)
├── .env              # Configuration & Clés API
└── requirements.txt  # Dépendances Python
```

---

## ⚙️ Installation & Configuration

### 1. Cloner le projet
```bash
git clone <url-du-repo>
cd Projet_newsAI
```

### 2. Configuration Backend (Python)
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Crée un fichier `.env` à la racine en t'inspirant des variables nécessaires (Mistral, Firecrawl, Supabase).

### 3. Configuration Frontend (Next.js)
```bash
cd web
npm install
npm run dev
```

### 4. Configuration Base de Données
Exécuter les scripts dans `supabase/supabase_rls_security.sql` directement dans l'éditeur SQL de Supabase pour configurer les tables et la sécurité.

---

## 🛡️ Sécurité & Scalabilité (DX Mode)

Le projet intègre un mode **DX (Developer Experience)** piloté par la variable `DEV_MODE=true` dans le `.env`.
- En **Développement** : Authentification simplifiée et Rate Limiting désactivé pour itérer plus vite.
- En **Production** : Toutes les sécurités (JWT strict, RLS, Rate Limiting IP) sont activées par défaut.

---

## 🗺️ Roadmap Prochaine Étape
1.  **Refactor Server Components** : Migration de la page principale vers RSC pour un chargement instantané.
2.  **Moteur de Recommandation** : Amélioration de la pondération des vecteurs basée sur le feedback utilisateur.
3.  **Application Mobile** : Export PWA ou React Native via le dossier `ios/` (futur).

---

*Développé avec passion pour une consommation d'information plus saine.* 🚀
