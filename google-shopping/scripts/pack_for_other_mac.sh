#!/bin/bash
# Pack google-shopping + Cursor skill/rule for another Mac.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d)"
DEST="${PACK_DEST:-$ROOT/transfer-pack}"
ZIP="${ROOT}/google-shopping-transfer-$STAMP.zip"

rm -rf "$DEST"
mkdir -p "$DEST/google-shopping" \
  "$DEST/cursor-for-parent-workspace/skills" \
  "$DEST/cursor-for-parent-workspace/rules"

rsync -a \
  --exclude node_modules \
  --exclude data \
  --exclude logs \
  --exclude archive \
  --exclude .cache \
  --exclude chrome_profile \
  --exclude probe-out \
  --exclude .DS_Store \
  --exclude '*.log' \
  --exclude google-shopping.csv \
  --exclude google-shopping.jsonl \
  --exclude urls.json \
  --exclude '.env' \
  --exclude transfer-pack \
  --exclude 'google-shopping-transfer-*.zip' \
  "$ROOT/" "$DEST/google-shopping/"

if [[ "${INCLUDE_ENV:-0}" == "1" && -f "$ROOT/.env" ]]; then
  cp "$ROOT/.env" "$DEST/google-shopping/.env"
  echo "included .env (secrets) — do not email this zip"
else
  echo "skipped .env — copy it by hand or fill .env.example on the other Mac"
fi

WORKSPACE_CURSOR="$(cd "$ROOT/.." && pwd)/.cursor"
if [[ -d "$WORKSPACE_CURSOR/skills/google-shopping-full-run" ]]; then
  rsync -a "$WORKSPACE_CURSOR/skills/google-shopping-full-run/" \
    "$DEST/google-shopping/.cursor/skills/google-shopping-full-run/"
  rsync -a "$WORKSPACE_CURSOR/skills/google-shopping-full-run/" \
    "$DEST/cursor-for-parent-workspace/skills/google-shopping-full-run/"
fi
if [[ -f "$WORKSPACE_CURSOR/rules/google-shopping-full-run.mdc" ]]; then
  cp "$WORKSPACE_CURSOR/rules/google-shopping-full-run.mdc" \
    "$DEST/cursor-for-parent-workspace/rules/google-shopping-full-run.mdc"
fi

cp "$ROOT/TRANSFER.md" "$DEST/README.md"

rm -f "$ZIP"
ditto -c -k --keepParent "$DEST" "$ZIP"
echo "folder: $DEST"
echo "zip:    $ZIP"
