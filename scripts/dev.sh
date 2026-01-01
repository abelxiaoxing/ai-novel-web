#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-5173}"
VITE_API_BASE="${VITE_API_BASE:-http://localhost:${API_PORT}}"

cd "${ROOT_DIR}"

cleanup() {
  if [[ -n "${API_PID:-}" ]]; then
    kill "${API_PID}" 2>/dev/null || true
  fi
  if [[ -n "${WEB_PID:-}" ]]; then
    kill "${WEB_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "Starting backend on :${API_PORT}..."
python -m uvicorn backend.api_server:app --host 0.0.0.0 --port "${API_PORT}" &
API_PID=$!

echo "Starting frontend on :${WEB_PORT}..."
VITE_API_BASE="${VITE_API_BASE}" npm --prefix "${ROOT_DIR}/webui" run dev -- --port "${WEB_PORT}" &
WEB_PID=$!

echo "Backend PID: ${API_PID}"
echo "Frontend PID: ${WEB_PID}"
echo "VITE_API_BASE: ${VITE_API_BASE}"

wait "${API_PID}" "${WEB_PID}"
