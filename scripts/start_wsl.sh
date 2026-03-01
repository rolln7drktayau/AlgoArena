#!/usr/bin/env bash
set -euo pipefail

SKIP_INSTALL=0
if [[ "${1:-}" == "--skip-install" ]]; then
  SKIP_INSTALL=1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -d ".venv" ]]; then
  echo "Creating Python virtual environment..."
  python3 -m venv .venv
fi

if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  echo "Installing backend dependencies..."
  # shellcheck disable=SC1091
  source .venv/bin/activate
  python -m pip install -r backend/requirements.txt
  deactivate

  if [[ ! -d "frontend/node_modules" ]]; then
    echo "Installing frontend dependencies..."
    (cd frontend && npm install)
  fi
fi

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "Starting backend..."
# shellcheck disable=SC1091
source .venv/bin/activate
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
deactivate

echo "Starting frontend..."
(
  cd frontend
  npm run dev -- --host 0.0.0.0 --port 5173
) &
FRONTEND_PID=$!

echo "Services running:"
echo "  Backend:  http://localhost:8000/docs"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both."

wait

