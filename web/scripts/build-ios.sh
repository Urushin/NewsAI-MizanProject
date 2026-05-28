#!/bin/bash
# ============================================================
# NewsAI — iOS Build & Sync Script
# ============================================================
# Usage:  ./scripts/build-ios.sh
# 
# This script:
#   1. Builds the Next.js app as a static export (out/)
#   2. Syncs the export to the Capacitor iOS project
#   3. Opens Xcode for you to run on simulator/device
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   NewsAI — Build iOS                     ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Step 1: Build Next.js static export
echo "📦 Building Next.js static export..."
npm run build
echo "✅ Static export generated in out/"
echo ""

# Step 2: Sync with Capacitor iOS
echo "📱 Syncing with Capacitor iOS..."
npx cap sync ios
echo "✅ iOS project synced"
echo ""

# Step 3: Open Xcode
echo "🔨 Opening Xcode..."
npx cap open ios

echo ""
echo "══════════════════════════════════════════"
echo "  ✅ Done! Build and run from Xcode."
echo "══════════════════════════════════════════"
echo ""
