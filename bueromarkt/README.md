# Bueromarkt Node scraper

Same architecture as the successful Autodoc Puppeteer run:

- local queue server (`server.js`)
- Chrome for Testing + ProxyRack residential (`puppeteer_worker.js`)
- Cheerio parser matching the Scrapy field shape (`parse.js`)

## Quick start

```bash
cd bueromarkt
npm install
npm run seed-sample                    # 30 sample PDP URLs
# or seed more from sitemap (Incapsula — needs Chrome):
#   USE_PROXY=0 LIMIT=100 npm run seed-sitemap-pp
npm run start-server                   # terminal 1, port 5053
# disable VPN for ProxyRack, then:
npm run start-pp-direct                # headed, off-screen + auto-hide (no focus steal)
# debug with visible windows:
#   npm run start-pp-visible
```

First time auto-hide runs, macOS may ask to allow **Automation** for Terminal/Cursor
controlling System Events / Google Chrome for Testing — click Allow.

Status: `curl -s http://127.0.0.1:5053/status`

Export:

```bash
npm run export-jsonl
npm run export-csv
```

## Env

| Var | Default |
|-----|---------|
| `THREADS` | `4` |
| `PAGE_CONCURRENCY` | `1` |
| `DELAY_MS` | `400` |
| `BLOCK_TYPES` | empty (successful Autodoc baseline) |
| `HEADLESS` | `1` (no visible windows; set `0` to debug) |
| `PROXY_USER` | `competitormonitor-country-de` |
| `PROXY_PASS` | ProxyRack password |
| `CHROME` | Chrome for Testing 132 path |
| `SERVER` | `http://127.0.0.1:5053` |

Product variations (Neuware / B-Ware) discovered on a PDP are automatically enqueued.
