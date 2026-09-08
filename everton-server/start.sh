#!/usr/bin/env bash
# Start Everton scraper in background (unattended server).
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "Copy .env.example to .env and fill PROXY_PASS + SFTP_PASS"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  npm install
fi

if [[ ! -f urls.json ]]; then
  npm run seed
fi

mkdir -p logs

if [[ "${1:-}" == "--foreground" ]]; then
  exec npm start
fi

nohup npm start >> logs/nohup.out 2>&1 &
echo "Started PID $! — tail logs:"
echo "  tail -f logs/progress.log   # status snapshots"
echo "  tail -f logs/run.log        # full worker/server output"
