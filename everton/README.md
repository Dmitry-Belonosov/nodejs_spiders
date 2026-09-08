# Everton FC Store Node scraper

Port of the Scrapy `EvertonStoreSpider` (`kitbag-evertonfc.com`) to the same
Node architecture as the successful Bueromarkt / Autodoc runs:

- local queue server (`server.js`) — discovers categories, pagination, PDPs
- Chrome for Testing + ProxyRack residential GB (`puppeteer_worker.js`)
- Cheerio parser matching Scrapy field shape (`parse.js` — `pdp-data` JSON + sizes)

## Quick start

```bash
cd everton
npm install
npm run seed-sample                    # home + a few category listings
npm run start-server                   # terminal 1, port 5054
# disable VPN for ProxyRack, then:
npm run start-pp                       # headless + GB residential
# debug with visible windows:
#   npm run start-pp-visible
```

Status: `curl -s http://127.0.0.1:5054/status`

Export:

```bash
npm run export-jsonl
npm run export-csv
```

## How it mirrors the Python spider

| Scrapy | Node |
|--------|------|
| Start `store.evertonfc.com/en/?cur=GBP` | `urls.sample.json` home + listings |
| Nav / `/t-` / `/p-` / pagination | `parse.js` `extractLinks` → server enqueue |
| `pdp-data` JSON + size variants | `parse.js` `parsePdp` |
| `proxy_country = 'GB'` | `PROXY_USER=...-country-GB` |
| `pp_waitforelem = '.universal-header'` | `waitForSelector('.universal-header')` |
| Akamai / non-UK host = blocked | rotate sticky ProxyRack exit |
| Force UK host + `cur=GBP` | `prepareUrl` / `canonicalizeUkHost` |

Products are one row per size (identifier `productId-SIZE`), same as Scrapy.

## Env

| Var | Default |
|-----|---------|
| `THREADS` | `4` |
| `PAGE_CONCURRENCY` | `1` |
| `DELAY_MS` | `400` |
| `PP_TIMEOUT` | `25000` (header wait; fail fast on Access Denied) |
| `HEADLESS` | `1` |
| `USE_PROXY` | `1` |
| `PROXY_USER` | `competitormonitor-country-GB` |
| `PROXY_PASS` | ProxyRack password |
| `CHROME` | Chrome for Testing 132 path |
| `SERVER` | `http://127.0.0.1:5054` |
| `PORT` | `5054` |
