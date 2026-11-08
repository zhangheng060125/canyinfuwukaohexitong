#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -x .venv/bin/python || ! -f frontend/dist/index.html ]]; then
  echo '请先运行 bash scripts/setup.sh'
  exit 1
fi
exec .venv/bin/python -m uvicorn backend.app:app --host 0.0.0.0 --port "${PORT:-8000}"
