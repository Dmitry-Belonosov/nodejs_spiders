# GHE Direct Node scraper

Port of Scrapy `DiscountHydro_GHEDirect` using the same Node architecture as
Everton / Bueromarkt:

- local queue server (`server.js`, port **5055**)
- Chrome for Testing + ProxyRack residential GB (`puppeteer_worker.js`)
- Cheerio parser for WooCommerce PDPs + sitemap `<loc>` (`parse.js`)
- Waits out Kinsta Cloudflare (`ki-cf-botcl` / “Checking your browser…”)
- Clicks Turnstile **Verify you are human** checkbox (`turnstile.js`)

## Smoke test

```bash
cd "/Users/dmitry/Downloads/For Dmitry/ghedirect"
# headed CF smoke (clicks Turnstile checkbox):
USE_PROXY=0 HEADLESS=0 node scripts/smoke_cf.js

npm run seed-sample
npm run start-server          # terminal 1
# disable VPN (Happ) for ProxyRack, then:
HEADLESS=0 HIDE_CHROME=0 npm run start-pp   # terminal 2 — keep Chrome visible for Turnstile
```

Status: `npm run status` → expect `products` / `progress` to climb.

Export:

```bash
npm run export-jsonl
npm run export-csv
```
