#!/usr/bin/env bash
# Workspace Browser — full bootstrap + start
# Run this once after cloning / after code changes.
# Usage: bash bootstrap.sh [--no-start]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "════════════════════════════════════════════════════"
echo "  Workspace Browser Bootstrap"
echo "════════════════════════════════════════════════════"

# ── 1. Conda env + Python deps ────────────────────────────────────────────
echo ""
echo "▶ [1/4] Installing Python dependencies..."
eval "$(conda shell.bash hook)"
conda activate py313
pip install -q --upgrade fastapi uvicorn[standard] aiosqlite httpx pydantic
echo "✓ Python deps ready"

# ── 2. Node / npm check ───────────────────────────────────────────────────
echo ""
echo "▶ [2/4] Checking Node.js..."
node --version
npm --version
echo "✓ Node ready"

# ── 3. Frontend build ─────────────────────────────────────────────────────
echo ""
echo "▶ [3/4] Building frontend..."
cd frontend
npm install --legacy-peer-deps
npm run build
cd ..
echo "✓ Frontend built → dist/"

# ── 4. Print token + start ────────────────────────────────────────────────
echo ""
echo "▶ [4/4] Reading auth token..."
if [ -f "backend/_token.txt" ]; then
  TOKEN=$(cat backend/_token.txt)
else
  TOKEN="(will be generated on first start)"
fi
echo ""
echo "════════════════════════════════════════════════════"
echo "  ✅ Bootstrap complete!"
echo "  Token:  $TOKEN"
echo "  Access: http://localhost:8081/?token=$TOKEN"
echo "════════════════════════════════════════════════════"

if [ "${1:-}" = "--no-start" ]; then
  echo "  (pass no args to auto-start the server)"
  exit 0
fi

# Start server
echo ""
echo "▶ Starting server on :8081 ..."
echo "  (Ctrl+C to stop)"
echo ""
exec python -m uvicorn backend.server:app \
  --host 0.0.0.0 \
  --port 8081 \
  --log-level info
