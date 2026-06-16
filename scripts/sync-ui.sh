#!/usr/bin/env bash
# Regenerate the bundled UI (ui/app.html) from a running To-Do server.
#
# Usage: ./scripts/sync-ui.sh [SERVER_URL]
#   SERVER_URL defaults to http://127.0.0.1:8080
#
# It fetches the server's rendered page and strips the server-relative PWA/favicon
# links (manifest + icons), which don't apply to the bundled desktop window. The
# desktop app injects the configured server URL at load time, so the bundled file
# must NOT contain a hard-coded API base.
set -euo pipefail

SRV="${1:-http://127.0.0.1:8080}"
SRV="${SRV%/}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$DIR/ui/app.html"

mkdir -p "$DIR/ui"
echo "Fetching UI from $SRV/ ..."
curl -fsS "$SRV/" -o "$OUT"

# Drop server-only <head> asset links (they 404 under todoapp://).
sed -i -E '/href="\/manifest\.webmanifest"|href="\/icon\.svg"|href="\/icon-192\.png"|href="\/apple-touch-icon\.png"/d' "$OUT"

echo "Wrote $OUT ($(wc -c < "$OUT") bytes). Review the diff and commit."
