#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -c 'import sys; assert sys.version_info >= (3, 11), "Python 3.11+ required"'
node -e 'if (+process.versions.node.split(".")[0] < 22) throw Error("Node.js 22+ required")'
python3 -m venv .venv
.venv/bin/python -m pip install --disable-pip-version-check --cache-dir /tmp/baihuali-pip-cache -r requirements.lock
npm --prefix frontend ci --no-audit --no-fund --cache /tmp/baihuali-npm-cache
npm --prefix frontend run build
.venv/bin/python -m unittest discover -s tests -v
