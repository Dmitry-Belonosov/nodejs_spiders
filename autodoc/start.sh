#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [[ ! -f urls.json ]]; then
  cp urls.sample.json urls.json
  echo "Seeded urls.json from sample (30 products)"
fi

echo "Starting Autodoc queue server on :5052 ..."
node server.js &
SERVER_PID=$!
sleep 1
curl -s http://127.0.0.1:5052/status || true
echo
echo "Starting workers (THREADS=${THREADS:-20}) ..."
THREADS="${THREADS:-20}" node axios_worker.js &
WORKER_PID=$!

trap 'kill $SERVER_PID $WORKER_PID 2>/dev/null || true' EXIT
wait $WORKER_PID
