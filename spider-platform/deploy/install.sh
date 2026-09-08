#!/usr/bin/env bash
#
# Install the Spider Platform on a Debian/Ubuntu server, alongside anything
# already running there. It only creates its own user and its own directory
# and never touches an existing Python spider system.
#
# Usage (as root, from the unpacked spider-platform folder):
#   bash deploy/install.sh
#
# Review the variables below before running.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/spider-platform}"
APP_USER="${APP_USER:-spiders}"
NODE_MAJOR="${NODE_MAJOR:-20}"
INSTALL_CHROME="${INSTALL_CHROME:-1}"

log()  { echo -e "\n\033[1;34m==>\033[0m $*"; }
warn() { echo -e "\033[1;33mwarning:\033[0m $*"; }
die()  { echo -e "\033[1;31merror:\033[0m $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run this as root"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ -f "$SOURCE_DIR/server.js" ] || die "run this from inside the spider-platform folder"

log "Installing base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg unzip

log "Ensuring Node.js >= $NODE_MAJOR"
if command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge "$NODE_MAJOR" ]; then
  echo "found $(node -v)"
else
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
  echo "installed $(node -v)"
fi

if [ "$INSTALL_CHROME" = "1" ]; then
  log "Ensuring Google Chrome (needed by Puppeteer spiders)"
  if command -v google-chrome-stable >/dev/null 2>&1; then
    echo "found $(google-chrome-stable --version)"
  else
    curl -fsSL https://dl.google.com/linux/linux_signing_key.pub |
      gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg
    CHROME_REPO="deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg]"
    CHROME_REPO="$CHROME_REPO http://dl.google.com/linux/chrome/deb/ stable main"
    echo "$CHROME_REPO" > /etc/apt/sources.list.d/google-chrome.list
    apt-get update -qq
    apt-get install -y -qq google-chrome-stable
    echo "installed $(google-chrome-stable --version)"
  fi
fi

log "Creating service user '$APP_USER'"
if id "$APP_USER" >/dev/null 2>&1; then
  echo "user already exists"
else
  useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
fi

log "Copying the application to $APP_DIR"
mkdir -p "$APP_DIR"
if [ "$SOURCE_DIR" != "$APP_DIR" ]; then
  # data/ and .env are deliberately preserved across re-installs.
  for entry in server.js package.json package-lock.json lib public scripts examples deploy README.md .env.example; do
    [ -e "$SOURCE_DIR/$entry" ] && cp -R "$SOURCE_DIR/$entry" "$APP_DIR/"
  done
fi
mkdir -p "$APP_DIR/data"

log "Installing dependencies"
cd "$APP_DIR"
mkdir -p node_modules
if [ -f package-lock.json ]; then
  npm ci --omit=dev --no-audit --no-fund
else
  npm install --omit=dev --no-audit --no-fund
fi

if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  warn "created $APP_DIR/.env from the example — set ADMIN_PASSWORD, SESSION_SECRET, proxy and SFTP credentials"
fi
chmod 600 "$APP_DIR/.env"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

log "Installing the systemd service"
cp "$APP_DIR/deploy/spider-platform.service" /etc/systemd/system/spider-platform.service
systemctl daemon-reload
systemctl enable spider-platform

cat <<EOF

Installed into $APP_DIR.

Next steps:
  1. Edit $APP_DIR/.env  (ADMIN_PASSWORD, SESSION_SECRET, PROXY_*, SFTP_*)
  2. systemctl start spider-platform
  3. systemctl status spider-platform   /   journalctl -u spider-platform -f
  4. Put nginx in front using deploy/nginx.conf.example, then set
     BEHIND_PROXY=1 and COOKIE_SECURE=1 in .env and restart the service.

The platform listens on 127.0.0.1:8080 by default and is not reachable from
outside until nginx is configured.
EOF
