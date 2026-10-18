#!/bin/bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")"
trap 'code=$?; echo "[NOVA] Build failed (exit $code)."; read -r -p "Press Enter to close... " _ || true; exit "$code"' ERR
if ! command -v npm >/dev/null || ! command -v node >/dev/null; then
  echo '[NOVA] Install Node.js LTS from https://nodejs.org before building.' >&2
  read -r -p 'Press Enter to finish... ' _ || true
  exit 1
fi
npm install --no-audit --no-fund
npm run check
npm run build:mac
printf '\n[NOVA] macOS DMG and ZIP are in %s/dist\n' "$PWD"
read -r -p 'Press Enter to close... ' _ || true
