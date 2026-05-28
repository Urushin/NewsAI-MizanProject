# 🧠 GEMINI.md — Guide d'Opérations & Workflows pour l'IA

Ce document répertorie les **commandes locales**, **les scripts**, et **les variables d'environnement** nécessaires pour que tout assistant IA puisse exécuter, tester et déboguer le projet rapidement.

---

## 🚀 1. Commandes de Lancement Local (Workspace)

Pour travailler en local sans Kubernetes, utilisez les raccourcis suivants :

### 🏃‍♂️ Lancement Global en Arrière-plan
Un script `run_bg.sh` est disponible à la racine pour tout lancer d'un coup.
```bash
./run_bg.sh
```
*   **Backend** : FastAPI sur port `8000` via virtualenv `/private/tmp/newsai_venv/bin/python3`.
*   **Worker** : `job_queue.py` pour le traitement asynchrone des flux d'IA.
*   **Frontend** : `npm run dev` sur Next.js (`web/`).

### 📜 Consultation des Logs (Débogage)
Les logs des processus en arrière-plan sont redirigés vers `/tmp/` :
*   `tail -f /tmp/newsai_backend.log` (Pour l'API Gateway)
*   `tail -f /tmp/newsai_worker.log` (Pour le processeur d'Ingestion)
*   `tail -f /tmp/newsai_frontend.log` (Pour l'interface web)

---

## 🛠️ 2. Structure d'Exécution & Environnements

### 🐍 Python Virtual Environment
Le projet utilise un environnement virtuel hébergé à un emplacement spécifique (sur ce système) :
```text
/private/tmp/newsai_venv/bin/python3
```
👉 *Règle IA* : Toujours utiliser ce chemin absolu pour exécuter des scripts Python ou des commandes `uvicorn` pour éviter les conflits de dépendance avec d'autres environnements locaux.

---

## 🧪 3. Scripts de Test Rapides

### Validation d'Analyse (LLM Pipeline)
Si vous modifiez la logique d'analyse ou le verdict de l'article :
```bash
/private/tmp/newsai_venv/bin/python3 tmp_test_analyze.py
```
*(Permet de vérifier la réponse structurelle d'un résumé avant déploiement).*

---

## 🤖 4. Commandes Utiles (Anti-Erreurs)

*   **Tuer les services** : Si des ports sont bloqués.
    ```bash
    kill $(lsof -t -i:8000) # Pour le Backend
    kill $(lsof -t -i:3000) # Pour le Frontend Next.js
    ```
*   **Vider le cache Node** : En cas de glitch Framer-Motion.
    ```bash
    cd web && rm -rf .next && npm run dev
    ```

---

*Document d'exploitation technique pour Assistants IA & Développeurs.*
