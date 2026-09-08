# Everton Server — standalone deploy

Self-contained Everton FC store scraper for an unattended Linux server.
No Cursor/AI required.

## Features

- Queue server + Puppeteer worker (single Chrome window, multiple tabs)
- **Live logs** you can `tail` anytime:
  - `logs/progress.log` — periodic status (`progress 1234/5000 …`)
  - `logs/run.log` — full server/worker output
- **Auto export** on completion (`everton.jsonl`, `everton.csv` + timestamped `archive/`)
- **SFTP upload** when crawl finishes
- **Resume** — completed URLs skipped via `data/products/{ind}.json`

## Quick start (Linux server)

```bash
# 1. Copy this folder to the server
scp -r everton-server user@your-server:/opt/everton-server

# 2. On the server
cd /opt/everton-server
cp .env.example .env
# Edit .env: PROXY_PASS, SFTP_PASS, SFTP_REMOTE_DIR

# 3. Install Chrome (Ubuntu example)
# wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
# sudo apt install ./google-chrome-stable_current_amd64.deb

npm install
chmod +x start.sh
./start.sh          # background
# or: ./start.sh --foreground
```

## Monitor progress

```bash
tail -f logs/progress.log
# [2026-07-28T08:00:00.000Z] progress 5000/12000 (42%) | pending 7000 | products 8500

tail -f logs/run.log

curl -s http://127.0.0.1:5054/status
```

## On completion

Supervisor will:

1. Export `everton.jsonl` + `everton.csv`
2. Copy to `archive/everton-YYYYMMDD-HHMMSS.*`
3. Upload both files to SFTP (`SFTP_REMOTE_DIR`)
4. Write `logs/uploaded.done`

Set `EXIT_ON_COMPLETE=1` (default) to stop processes after upload.

## Re-run

```bash
rm logs/uploaded.done
FORCE_RUN=1 ./start.sh
```

## Manual commands

```bash
npm run seed          # fresh crawl (home page only)
npm run export        # export from existing data/
npm run upload        # upload existing exports via SFTP
npm run test-parse    # offline parser test
```

## Env reference

| Var | Default | Description |
|-----|---------|-------------|
| `THREADS` | `4` | Chrome tabs |
| `USE_PROXY` | `1` | ProxyRack GB |
| `HEADLESS` | `1` | Headless Chrome |
| `STATUS_INTERVAL_MS` | `30000` | Progress log interval |
| `SFTP_REMOTE_DIR` | `Kitbag/Everton` | Remote upload folder |
| `SKIP_SFTP` | — | Set `1` to skip upload |
| `FORCE_RUN` | — | Set `1` to ignore `uploaded.done` |

## Folder layout

```
everton-server/
  run.js              # supervisor (npm start)
  server.js           # queue
  puppeteer_worker.js # Chrome scraper
  parse.js            # HTML → products
  lib/                # logger, sftp, export, progress
  data/products/      # per-URL results (resume checkpoint)
  logs/               # run.log, progress.log
  archive/            # timestamped exports
```
