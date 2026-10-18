#!/bin/bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")"
if ! command -v npm >/dev/null; then
  echo '[NOVA] Install Node.js LTS from https://nodejs.org before starting.' >&2
  read -r -p 'Press Enter to finish... ' _ || true
  exit 1
fi
if [[ ! -d node_modules ]]; then npm install --no-audit --no-fund; fi
npm start
