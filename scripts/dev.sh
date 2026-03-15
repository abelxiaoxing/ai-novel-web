#!/usr/bin/env bash
set -euo pipefail

# 兼容通过 zsh/bash 直接执行脚本，不依赖 BASH_SOURCE。
SCRIPT_PATH="$0"
if command -v realpath >/dev/null 2>&1; then
  SCRIPT_PATH="$(realpath "${SCRIPT_PATH}")"
fi
ROOT_DIR="$(cd "$(dirname "${SCRIPT_PATH}")/.." && pwd)"
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-5173}"
VITE_API_BASE="${VITE_API_BASE:-http://localhost:${API_PORT}}"
# 默认放到用户缓存目录，避免在仓库内生成未跟踪缓存文件。
UV_CACHE_DIR="${UV_CACHE_DIR:-${XDG_CACHE_HOME:-${HOME}/.cache}/uv}"
export UV_CACHE_DIR

cd "${ROOT_DIR}"

# uv 管理 Python 环境和依赖，无需手动激活虚拟环境
# 确保依赖已安装: uv sync

cleanup() {
  if [[ -n "${API_PID:-}" ]]; then
    kill "${API_PID}" 2>/dev/null || true
  fi
  if [[ -n "${WEB_PID:-}" ]]; then
    kill "${WEB_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

# 尝试获取局域网IP地址并更新VITE_API_BASE
if command -v python3 >/dev/null 2>&1; then
  LAN_IP=$(python3 -c "import socket; s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('8.8.8.8', 80)); print(s.getsockname()[0]); s.close()" 2>/dev/null || echo "")
  if [[ -n "${LAN_IP}" ]]; then
    VITE_API_BASE_LAN="http://${LAN_IP}:${API_PORT}"
    echo "Detected LAN IP: ${LAN_IP}"
  fi
fi

echo "Starting backend on :${API_PORT}..."
uv run python -m uvicorn backend.api_server:app --host 0.0.0.0 --port "${API_PORT}" &
API_PID=$!

echo "Starting frontend on :${WEB_PORT}..."
VITE_API_BASE="${VITE_API_BASE}" npm --prefix "${ROOT_DIR}/webui" run dev -- --host 0.0.0.0 --port "${WEB_PORT}" &
WEB_PID=$!

echo "Backend PID: ${API_PID}"
echo "Frontend PID: ${WEB_PID}"
echo "VITE_API_BASE (localhost): ${VITE_API_BASE}"
if [[ -n "${VITE_API_BASE_LAN:-}" ]]; then
  echo "VITE_API_BASE (LAN): ${VITE_API_BASE_LAN}"
fi
echo ""
echo "Access from this machine: http://localhost:${WEB_PORT}"
if [[ -n "${VITE_API_BASE_LAN:-}" ]]; then
  echo "Access from LAN: http://${LAN_IP}:${WEB_PORT}"
fi

wait "${API_PID}" "${WEB_PID}"
