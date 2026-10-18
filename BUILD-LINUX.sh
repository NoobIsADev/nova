#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v npm >/dev/null || ! command -v node >/dev/null; then
  echo '[NOVA] Install nodejs and npm before running this script.' >&2
  exit 1
fi
npm install --no-audit --no-fund
npm run check
npm run build:linux
printf '\n[NOVA] Linux AppImage created in: %s/dist\n' "$PWD"
echo 'Make the AppImage executable (chmod +x) before opening it.'
