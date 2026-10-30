#!/usr/bin/env bash
# Deploy mit Kennzeichnung: wrangler deploy --message "<agent>/<sha>".
# Pflicht: BL_DEPLOY_AGENT (z. B. macrohard, minihard). Optional: BL_DEPLOY_DRY_RUN=1 (nur --dry-run, kein Upload).
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${BL_DEPLOY_AGENT:-}" ]; then
  echo "Deploy abgebrochen: BL_DEPLOY_AGENT fehlt (z. B. BL_DEPLOY_AGENT=macrohard npm run deploy)." >&2; exit 1
fi
case "$BL_DEPLOY_AGENT" in *[!A-Za-z0-9._-]*) echo "Deploy abgebrochen: BL_DEPLOY_AGENT nur [A-Za-z0-9._-]." >&2; exit 1;; esac
SHA=$(git rev-parse --short HEAD)
DIRTY=""; git diff --quiet HEAD -- || DIRTY="-dirty"
# Nur echte Produktions-Builds: dist muss mit VITE_SAT_MOCK=0 gebaut sein (Prebuild-Sperre prüft den Key).
if ! ls dist/assets/index-*.js >/dev/null 2>&1; then echo "Deploy abgebrochen: kein dist – erst ESRI_API_KEY=… VITE_SAT_MOCK=0 npm run build." >&2; exit 1; fi
if ! grep -q 'VITE_SAT_MOCK:"0"' dist/assets/index-*.js; then
  echo "Deploy abgebrochen: dist ist ein Mock-/Test-Build (VITE_SAT_MOCK≠0)." >&2; exit 1
fi
BUNDLE=$(basename "$(ls dist/assets/index-*.js | head -1)")
MSG="${BL_DEPLOY_AGENT}/${SHA}${DIRTY}"
echo "Deploy: message=${MSG} bundle=${BUNDLE}"
EXTRA=(); [ "${BL_DEPLOY_DRY_RUN:-}" = "1" ] && EXTRA=(--dry-run)
npx wrangler deploy --message "$MSG" "${EXTRA[@]}"
