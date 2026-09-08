#!/bin/bash
# Chrome for Testing fallback (MV2) — use when axios workers stay blocked.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
CHROME="/tmp/chrome-for-testing/chrome/mac_arm-132.0.6834.83/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
EXT=/tmp/autodoc-extension
PROFILE=/tmp/autodoc-cft-profile

if [[ ! -x "$CHROME" ]]; then
  echo "Installing Chrome for Testing 132..."
  npx --yes @puppeteer/browsers install chrome@132.0.6834.83 --path /tmp/chrome-for-testing
fi

pkill -f 'user-data-dir=/tmp/autodoc-cft-profile' 2>/dev/null || true
rm -rf "$EXT"
cp -R "$ROOT/extension" "$EXT"
mkdir -p "$PROFILE"

echo "Queue server must be running: npm run start-server"
echo "Click the extension icon to start browser scrape."
exec "$CHROME" \
  --user-data-dir="$PROFILE" \
  --load-extension="$EXT" \
  --disable-extensions-except="$EXT" \
  --disable-features=ExtensionManifestV2Unsupported,ExtensionManifestV2Disabled \
  --enable-features=AllowLegacyMV2Extensions \
  --no-first-run \
  --no-default-browser-check \
  about:blank
