#!/bin/bash
PROJECT_ROOT="/Users/issam/Documents/Projets perso/Projet_newsAI"
PYTHON="/private/tmp/newsai_venv/bin/python3"

echo "Starting Backend..."
nohup $PYTHON -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload > /tmp/newsai_backend.log 2>&1 &

echo "Starting Worker..."
nohup $PYTHON "$PROJECT_ROOT/backend/job_queue.py" > /tmp/newsai_worker.log 2>&1 &

echo "Starting Frontend..."
cd "$PROJECT_ROOT/web"
nohup npm run dev > /tmp/newsai_frontend.log 2>&1 &

echo "All services started in background!"
echo "Logs are in /tmp/newsai_*.log"
