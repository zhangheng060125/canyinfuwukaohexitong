#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python -m pip install --disable-pip-version-check --cache-dir /tmp/baihuali-pip-cache -r requirements.lock
npm --prefix frontend ci --no-audit --no-fund --cache /tmp/baihuali-npm-cache
npm --prefix frontend run build
python -m unittest discover -s tests -v
