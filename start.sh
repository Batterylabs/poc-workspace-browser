#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Conda env ────────────────────────────────────────────────────────────────
eval "$(conda shell.bash hook)"
conda activate py313

# ── Ensure Python deps ───────────────────────────────────────────────────────
pip install -q fastapi uvicorn aiosqlite httpx

# ── Build frontend if needed ─────────────────────────────────────────────────
if [ ! -d "dist" ] || [ "$1" = "--rebuild" ]; then
  echo "▶ Building frontend..."
  cd frontend
  npm install --silent
  npm run build
  cd ..
  echo "✓ Frontend built"
fi

# ── Start server ─────────────────────────────────────────────────────────────
echo "▶ Starting Workspace Browser on port 8081..."
exec python -m uvicorn backend.server:app --host 0.0.0.0 --port 8081
