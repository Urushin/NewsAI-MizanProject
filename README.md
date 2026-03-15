# 🏛️ News.ai — Ton Filtre d'Actualité Intelligent par IA

News.ai est un agrégateur d'actualités SaaS de nouvelle génération qui utilise l'Intelligence Artificielle pour transformer un flux d'informations massif en un briefing quotidien ultra-personnalisé. 

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
- **Analyses de Crédibilité** : Score de confiance sur 10 visualisable directement sur chaque carte via une barre de progression dynamique.
- **Historique Interactif** : Accès aux briefings des jours précédents via un panneau latéral dédié.
- **Feedback Loop** : Système d'apprentissage intégré permettant d'affiner le filtrage selon vos rejets et lectures.
- **Clustering Sémantique (SentenceTransformers)** : Utilisation d'embeddings (`all-MiniLM-L6-v2`) pour regrouper intelligemment les articles traitant du même sujet et éliminer les doublons conceptuels.
- **Synthèse de Groupe Multi-Sources** : L'IA fusionne les informations de plusieurs articles pour créer un résumé unique, balancé et synthétique.
- **Contrôle de Densité du Contenu** : Un slider "Taille des résumés" (1 à 4) permet de choisir entre puces, phrases condensées, paragraphes ou analyses détaillées.
- **Double Personnalisation Hybride** : Le moteur combine désormais ton profil structuré (JSON) et tes instructions libres (Manifeste .txt) pour une précision de filtrage inégalée.
- **Auto-Ajustement du Profil (Nightly Update)** : Système apprenant qui affine tes intérêts en fonction de tes feedbacks quotidiens (clics, rejets).
- **Taxonomie Thématique Riche** : Classification précise sur 6 piliers majeurs (Tech, Finance, Politique, Culture, Lifestyle, Société).
- **Monitoring & APM Natif** : Suivi en temps réel des performances, taux d'erreurs et latences via un middleware dédié.
- **Système de Quotas Dynamique** : Limites de génération et d'articles adaptées à ton plan pour une infrastructure optimisée.
- **Gestion d'Abonnement Stripe** : Intégration complète pour le passage aux plans Pro et Enterprise en quelques clics.

---

## 🛠️ Stack Technique

### Backend (Le Cerveau)
- **Framework** : FastAPI (Python 3.9+)
- **Scraping** : Firecrawl SDK & Feedparser (Asynchrone avec `httpx`)
- **Intelligence Artificielle** : 
    - LLM : Mistral AI (modèles Large/Small)
    - Embeddings : Mistral/OpenAI
- **Traitement** : Pipeline de filtrage cognitif, Job Queue pour le traitement asynchrone.
- **Base de données Locale** : SQLite (`mizan.db`) pour la persistence des statuts de génération et du cache.
- **Monitoring** : Middleware APM custom pour le tracking des percentiles (p50, p95, p99).
- **Billing/SaaS** : Stripe SDK pour la gestion des abonnements et webhooks.
- **Auto-Learning** : Profile Updater asynchrone basé sur les interactions utilisateur.

### Frontend (L'Expérience)
- **Framework** : Next.js 14 (App Router)
- **Styling** : Tailwind CSS
- **Animations** : Framer Motion
- **Architecture** : React Server Components (RSC) pour la performance.
- **Typographie** : Duo de polices premium (Playfair Display pour le style "Journal" et Inter pour la lisibilité).
- **Icons** : Set d'icônes Lucide pour une navigation intuitive.

### Infrastructure & Data
- **Base de données** : Supabase (Postgres)
- **Vecteurs** : pgvector pour la similarité sémantique.
- **Auth** : Supabase Auth (JWT).
- **Paiements** : Stripe.

---

## 📈 Observabilité & Monitoring

Mizan.ai intègre une couche de monitoring robuste pour garantir une haute disponibilité :
- **Metrics Endpoint** : `/api/metrics` expose l'uptime, le taux d'erreur et la latence moyenne.
- **Performance Tracking** : Calcul en temps réel des percentiles (p50, p95, p99) par endpoint.
- **Alerting** : Logging automatique des requêtes lentes (>2s) via Loguru.


---

## 🎨 Design System (v3.0 - Premium Dark)

Mizan.ai a évolué vers une esthétique "Glassmorphic High-End" pour offrir une expérience de lecture apaisante et luxueuse :
- **Thème Sombre Profond** : Palette de couleurs basée sur des gris bleutés (`#0b0f15`) et des accents ambre/or.
- **Hiérarchie Visuelle** : Focus massif sur le "Daily Briefing" avec une date élégante et discrète.
- **Micro-Interactions** : Animations fluides via Framer Motion lors de l'expansion des cartes et de l'apparition du digest.
- **Cartes de Contenu** : Design en relief avec bordures subtiles et ombres portées pour une séparation nette des informations.
- **Evolution Notion-Like (v3.2)** : Vers une esthétique encore plus épurée, avec un focus sur le centrage du contenu, l'utilisation de typographies sans-serif (Inter/System) et une clarté maximale inspirée des outils de productivité modernes.

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

## ⚙️ Installation & Lancement Manuel

### 1. Préparation de l'environnement (Une seule fois)
À la racine du projet, créez un environnement virtuel unique et installez les dépendances :
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
*Assurez-vous d'avoir configuré votre fichier `.env` à la racine.*

### 2. Lancement du Backend (API)
Dans un premier terminal, depuis la racine :
```bash
source .venv/bin/activate
# On exclut le dossier web pour éviter que le reloader ne sature à cause des node_modules
uvicorn backend.app:app --reload --port 8000 --reload-exclude "web/*"
```
*L'API sera accessible sur `http://localhost:8000`.*

### 3. Lancement du Worker (Traitement IA)
Dans un deuxième terminal, depuis la racine :
```bash
source .venv/bin/activate
python3 backend/job_queue.py
```
*Ce service gère le scraping et les appels Mistral AI en arrière-plan.*

### 4. Lancement du Frontend (Next.js)
Dans un troisième terminal, allez dans le dossier `web/` :
```bash
cd web
npm install  # Si nécessaire
npm run dev
```
> [!TIP]
> **Pourquoi `--reload-exclude "web/*"` ?**
> Par défaut, Uvicorn tente de surveiller tous les fichiers du projet pour redémarrer en cas de modification. Comme le dossier `web/node_modules` contient des dizaines de milliers de fichiers, cela peut saturer le système et provoquer des erreurs `FileNotFoundError`. Cette option permet de garder un reloader fluide sur le code Backend uniquement.

---

## 🛡️ Sécurité & Scalabilité (DX Mode)

Le projet intègre un mode **DX (Developer Experience)** piloté par la variable `DEV_MODE=true` dans le `.env`.
- En **Développement** : Authentification simplifiée et Rate Limiting désactivé pour itérer plus vite.
- En **Production** : Toutes les sécurités (JWT strict, RLS, Rate Limiting IP) sont activées par défaut.

---

## 💰 Niveaux d'Abonnement & Quotas

| Plan | Limit Briefs/J | Articles/Brief | Historique | Deep Scrape |
| :--- | :--- | :--- | :--- | :--- |
| **Free** | 1 | 10 | 7 jours | ❌ |
| **Pro** | 5 | 30 | 90 jours | ✅ |
| **Enterprise** | Illimité | 100 | 365 jours | ✅ |


---

## 🗺️ Roadmap Prochaine Étape
1.  **Refactor Server Components** : Migration de la page principale vers RSC pour un chargement instantané.
2.  **Moteur de Recommandation** : Amélioration de la pondération des vecteurs basée sur le feedback utilisateur.
3.  **Application Mobile** : Export PWA ou React Native via le dossier `ios/` (futur).
4.  **Multi-Langue Temps Réel** : Support natif du FR, EN et JA avec détection automatique sur l'interface.
5.  **Mode Podcast** : Intégration prévue d'un résumé audio quotidien via TTS (Text-to-Speech).

---

*Développé pour ceux qui veulent comprendre le monde sans y perdre leur temps.* 🚀

