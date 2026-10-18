#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v npm >/dev/null; then
  echo '[NOVA] Please install nodejs and npm first.' >&2
  exit 1
fi
if [[ ! -d node_modules ]]; then npm install --no-audit --no-fund; fi
npm start
