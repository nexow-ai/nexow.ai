#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDS=()
SHUTTING_DOWN=false

cleanup() {
  if $SHUTTING_DOWN; then return; fi
  SHUTTING_DOWN=true

  echo ""
  echo "[nexow] Shutting down..."

  for pid in "${PIDS[@]}"; do
    pkill -TERM -P "$pid" 2>/dev/null || true
    kill -TERM "$pid" 2>/dev/null || true
  done

  sleep 1

  for pid in "${PIDS[@]}"; do
    pkill -KILL -P "$pid" 2>/dev/null || true
    kill -KILL "$pid" 2>/dev/null || true
  done

  wait 2>/dev/null || true
  echo "[nexow] All services stopped."
  exit 0
}
trap cleanup INT TERM

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Nexow — Local Development        ${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check .env exists
if [ ! -f "$ROOT_DIR/.env" ]; then
  echo -e "${YELLOW}[warn] .env not found. Copy .env.example to .env and fill in your keys.${NC}"
  exit 1
fi

# ── Load .env into shell so all children inherit ────────
set -a
source "$ROOT_DIR/.env"
set +a

# ── Install dependencies ────────────────────────────────
echo -e "${CYAN}[setup]${NC}    Installing frontend dependencies..."
cd "$ROOT_DIR/frontend"
pnpm install --frozen-lockfile 2>&1 | sed "s/^/[setup]    /"

echo -e "${CYAN}[setup]${NC}    Installing engine dependencies..."
cd "$ROOT_DIR/engine"
uv sync --all-extras 2>&1 | sed "s/^/[setup]    /"

echo ""

# ── Clean Turbopack cache (prevents corruption) ─────────
rm -rf "$ROOT_DIR/frontend/.next"

# ── Frontend (Next.js) ──────────────────────────────────
echo -e "${CYAN}[frontend]${NC} Starting Next.js on http://localhost:3000 ..."
cd "$ROOT_DIR/frontend"
pnpm dev --port 3000 2>&1 | sed "s/^/[frontend] /" &
PIDS+=($!)

# ── Engine (Python) ─────────────────────────────────────
echo -e "${CYAN}[engine]${NC}   Starting Python engine with hot-reload ..."
cd "$ROOT_DIR/engine"
uv run --all-extras -- watchfiles "python -m nexow.main" nexow/ 2>&1 | sed "s/^/[engine]   /" &
PIDS+=($!)

echo ""
echo -e "${GREEN}[nexow] All services started. Press Ctrl+C to stop.${NC}"
echo ""

wait
