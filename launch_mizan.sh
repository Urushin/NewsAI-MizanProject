#!/bin/bash

# 🚀 Mizan.ai — One-Click Startup Script for macOS
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
echo "📂 Project Root: $PROJECT_ROOT"
cd "$PROJECT_ROOT"

# ══════════════════════════════════════════
# 1. Kill any existing processes on our ports
# ══════════════════════════════════════════
echo "🧹 Cleaning up old processes..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# ══════════════════════════════════════════
# 2. Fix Python Virtual Environment
# ══════════════════════════════════════════
echo "🔧 Setting up Python environment..."

# Force delete the corrupted .venv
if [ -d ".venv" ]; then
    echo "🗑️  Removing corrupted .venv..."
    rm -rf .venv 2>/dev/null
    # If rm fails (macOS permissions), try harder
    if [ -d ".venv" ]; then
        echo "⚠️  Using force removal..."
        find .venv -type f -exec rm -f {} + 2>/dev/null
        find .venv -type d -depth -exec rmdir {} + 2>/dev/null
        rm -rf .venv 2>/dev/null
    fi
fi

echo "🆕 Creating fresh virtual environment..."
python3 -m venv .venv

if [ ! -f ".venv/bin/python3" ]; then
    echo "❌ Failed to create .venv. Trying alternative location..."
    python3 -m venv /tmp/mizan_venv
    VENV_PATH="/tmp/mizan_venv"
else
    VENV_PATH=".venv"
fi

echo "📦 Upgrading pip..."
"$VENV_PATH/bin/python3" -m ensurepip --upgrade 2>/dev/null
"$VENV_PATH/bin/python3" -m pip install --upgrade pip 2>/dev/null

echo "📦 Installing backend dependencies..."
"$VENV_PATH/bin/python3" -m pip install -r requirements.txt
"$VENV_PATH/bin/python3" -m pip install stripe uvicorn

# Verify installation
if ! "$VENV_PATH/bin/python3" -c "import uvicorn; import fastapi; print('✅ Backend deps OK')"; then
    echo "❌ Backend installation failed!"
    exit 1
fi

# ══════════════════════════════════════════
# 3. Setup Frontend
# ══════════════════════════════════════════
echo "📦 Checking frontend dependencies..."
cd web && npm install --quiet 2>/dev/null && cd ..

# ══════════════════════════════════════════
# 4. Launch Services in separate Terminal windows
# ══════════════════════════════════════════
echo "🚀 Launching services in new Terminal windows..."

PYTHON="$PROJECT_ROOT/$VENV_PATH/bin/python3"
# If using /tmp path, use absolute
if [[ "$VENV_PATH" == /tmp/* ]]; then
    PYTHON="$VENV_PATH/bin/python3"
fi

# API Terminal
osascript <<EOF
tell application "Terminal"
    do script "cd '$PROJECT_ROOT' && '$PYTHON' -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload"
end tell
EOF

sleep 1

# Worker Terminal
osascript <<EOF
tell application "Terminal"
    do script "cd '$PROJECT_ROOT' && '$PYTHON' backend/job_queue.py"
end tell
EOF

sleep 1

# Frontend Terminal
osascript <<EOF
tell application "Terminal"
    do script "cd '$PROJECT_ROOT/web' && npm run dev"
end tell
EOF

echo ""
echo "✅ All services launched! Check the new Terminal windows."
echo "🔗 API:      http://localhost:8000"
echo "🔗 Health:   http://localhost:8000/api/health"
echo "🔗 Metrics:  http://localhost:8000/api/metrics"
echo "🔗 Frontend: http://localhost:3000"
echo ""
echo "🔑 Login: admin@user.com / AdminPassword123!"
