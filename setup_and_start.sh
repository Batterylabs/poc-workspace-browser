#!/usr/bin/env bash
# ONE-SHOT: Install deps, build frontend, start server.
# Run from workspace-browser directory.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Workspace Browser — Setup & Start"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Python env
eval "$(conda shell.bash hook)" 2>/dev/null || true
conda activate py313 2>/dev/null || true
pip install -q fastapi "uvicorn[standard]" aiosqlite httpx pydantic

# Node / npm frontend build
cd frontend
npm install --legacy-peer-deps --silent
npm run build
cd ..

# Show token
TOKEN=""
if [ -f backend/_token.txt ]; then
  TOKEN=$(cat backend/_token.txt)
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Build complete"
if [ -n "$TOKEN" ]; then
  echo "  Token : $TOKEN"
  echo "  Access: http://localhost:8081/?token=$TOKEN"
else
  echo "  Token will be printed on first server start"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Starting server..."
echo ""

exec python -m uvicorn backend.server:app \
  --host 0.0.0.0 \
  --port 8081 \
  --log-level info
