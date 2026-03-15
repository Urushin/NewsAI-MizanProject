# 🏛️ NewsAI — Votre Filtre d'Actualité Intelligent par IA

NewsAI est un agrégateur d'actualités de nouvelle génération qui utilise l'Intelligence Artificielle pour transformer un flux d'informations massif en un briefing quotidien ultra-personnalisé.

> [!NOTE]
> Ce projet a été modernisé pour le TP avec une architecture **Microservices** et un déploiement orchestré par **Kubernetes**.

---

## 🚀 Vision du Projet

Dans un monde saturé d'informations, NewsAI agit comme un curateur cognitif. Il ne se contente pas de regrouper des articles ; il les **filtre**, les **classe** et les **résume** en fonction de votre "Manifeste" personnel (votre vision du monde et vos intérêts réels).

---

## 🏗️ Architecture du Projet (v4.0 - Microservices)

Le projet est divisé en quatre composants principaux, chacun conteneurisé :

1.  **Frontend (`web/`)** : Interface premium Next.js 14 optimisée pour la lecture.
2.  **Backend (`backend/`)** : API Gateway (FastAPI) gérant l'intelligence, la synthèse et la logique métier.
3.  **Scraper (`scraper/`)** : Microservice spécialisé dans le scraping intensif (Firecrawl/RSS), séparant la collecte de l'API.
4.  **Database** : PostgreSQL avec persistance via Kubernetes PV/PVC.

### 📁 Structure des dossiers
```text
PROJET_NEWSAI/
├── backend/          # API Gateway (Service 1)
├── web/              # Frontend UI (Service 2)
├── scraper/          # Worker de collecte (Service 3)
├── k8s/              # Manifestes Kubernetes (Déploiements, Services, Ingress)
├── terraform/        # Infrastructure as Code (GKE)
├── supabase/         # Scripts SQL & Config
└── .env              # Configuration & Clés API
```

---

## 🛠️ Stack Technique

- **Orchestration** : Kubernetes (K8s)
- **Conteneurisation** : Docker
- **Backend/Scraper** : FastAPI (Python 3.11)
- **Frontend** : Next.js 14 (App Router)
- **IA** : Mistral AI (Large Language Models)
- **Base de données** : PostgreSQL / Supabase
- **Infrastructure** : Terraform (GCP/GKE)

---

## ⚙️ Guide de Lancement (Mode TP - Kubernetes)

Pour lancer le projet dans un environnement local Kubernetes (comme Minikube ou Docker Desktop) :

### 1. Préparer les images Docker
Depuis la racine :
```bash
# Backend
docker build -t newsai-backend:latest -f backend/Dockerfile .
# Scraper
docker build -t newsai-scraper:latest -f scraper/Dockerfile .
# Frontend
docker build -t newsai-frontend:latest -f web/Dockerfile ./web
```

### 2. Déployer sur Kubernetes
Assurez-vous que votre cluster (Minikube) est lancé :
```bash
# Appliquer les configurations
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/scraper-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

### 3. Accéder à l'application
Ajoutez les hôtes locaux à votre fichier `/etc/hosts` :
```text
127.0.0.1 newsai.local api.newsai.local
```
L'application sera accessible sur `http://newsai.local`.

---

## 🧪 Mode Test / Évaluation

Pour tester l'application et les correctifs :

1.  **Identifiants** :
    *   **Email** : `retry_auth_fix@mizan.ai`
    *   **Mot de passe** : `SuccessPassword123!`

2.  **Parcours recommandé** :
    *   Connectez-vous avec les identifiants ci-dessus.
    *   Rendez-vous sur la page **Profil** (ou l'Assistant de configuration).
    *   Configurez vos préférences de lecture/sources.
    *   Générez une **Nouvelle Édition** pour charger les actualités fraîchement condensées.
    *   *Note : Réactualisez la page après quelques secondes si le contenu n'apparaît pas instantanément.*

---

## ⚙️ Installation & Lancement Manuel (Développement)

Si vous ne possédez pas Kubernetes, vous pouvez lancer les services manuellement :

### 1. Backend & Scraper
```bash
source .venv/bin/activate
# Service 1: API
uvicorn backend.app:app --host 0.0.0.0 --port 8000
# Service 2: Scraper App
uvicorn scraper.app:app --host 0.0.0.0 --port 8001
```

### 2. Frontend
```bash
cd web
npm install
npm run dev
```

---

## ✨ Fonctionnalités Clés

- **Filtrage Cognitif par IA** : Double passage de validation (Embeddings + LLM).
- **Service-to-Service Communication** : Le backend délègue la collecte au microservice Scraper.
- **Persistence des données** : PostgreSQL orchestré avec stockage persistant.
- **Routage Unifié** : Ingress Controller pour gérer les sous-domaines (api/www).
- **IA Seal of Trust** : Score de confiance et résumé AI pour chaque article.

---

*Développé pour NewsAI — L'information, sans le bruit.* 🚀
