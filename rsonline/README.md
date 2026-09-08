# RS Online scraper

Crawls product pages on `uk.rs-online.com` and exports `rsonline.csv`.

Same architecture as the `bueromarkt` and `everton` spiders:

- `server.js` — queue server holding the URL list and the parsed results
- `puppeteer_worker.js` — Chrome for Testing + ProxyRack residential, fetches pages
- `parse.js` — turns a product page into a product record
- `run.js` — supervisor that runs both, waits for the queue to drain, exports, and exits

## How the parsing works

RS Online embeds a complete `schema.org/Product` block in every product page, so
the fields come from JSON-LD rather than CSS selectors. That survives redesigns
far better than selectors do, which matters here because the site is behind
Akamai and re-fetching a page just to debug a selector is expensive.

The RS stock number (`235-1607`) is used as the identifier. RS publishes no
GTIN but does publish a manufacturer part number, so `mpn` is carried in an
extra CSV column.

## Anti-bot

Akamai answers a suspicious request with a short `Access Denied` page rather
than a solvable challenge. The worker treats that as a signal to take a fresh
ProxyRack exit IP, wipe the Chrome profile (its cookies identify the old IP)
and retry.

If the page is instead an hCaptcha challenge, the same solver that already
worked on bueromarkt runs against that tab. That solver needs headed Chrome
for Testing — `npm start` launches two windows of ten tabs for that reason.

## Quick start

```bash
cd rsonline
npm install
cp .env.example .env          # fill in PROXY_PASS
npm run seed-sample           # 30 sample product URLs
npm start                     # crawl, export, exit
```

Crawl the full catalogue instead of the sample:

```bash
npm run seed-sitemap          # every uk_products_*.xml.gz sitemap (~1M URLs)
LIMIT=10000 npm run seed-sitemap   # or cap it
```

Run the pieces separately while debugging:

```bash
npm run start-server                 # terminal 1
npm run start-pp                     # terminal 2
npm run export-csv
curl -s http://127.0.0.1:5051/status
```

## Environment

| Variable | Default | Effect |
|---|---|---|
| `PROXY_USER` | `competitormonitor-country-uk` | ProxyRack country endpoint |
| `PROXY_PASS` | — | required unless `USE_PROXY=0`; the worker exits if missing |
| `USE_PROXY` | `1` | `0` crawls direct — expect blocks within a few pages |
| `THREADS` | `10` | tabs in each Chrome for Testing window |
| `WINDOWS` | `2` | two windows (the supervisor starts two worker processes) |
| `DELAY_MS` | `400` | pause between pages, plus jitter |
| `BLOCK_TYPES` | `image,font,media` | resource types dropped to save bandwidth |
| `HEADLESS` | `1` | `0` shows the browser for debugging |
| `PORT` | `5051` | queue server port; the platform assigns this per run |
| `MAX_PRODUCTS` | `0` | stop after N products — the quick way to verify the spider |
| `MIN_PRODUCTS` | `1` | fail the run if fewer products were extracted |
| `KEEP_HTML` | `0` | `1` also saves raw pages to `data/` (~250 KB each) |

## Output

`rsonline.csv` and `rsonline.jsonl` in the project root, rewritten on every run.
The platform collects the CSV and delivers it over SFTP as
`rsonline_<timestamp>.csv`; this spider contains no SFTP code of its own.

Columns: `identifier, name, sku, price, stock, brand, category, image_url, url,
shipping_cost, gtin, lead_time, condition, discount_%, old_price, mpn`.

`gtin`, `lead_time` and `condition` stay empty on this site — they are kept so
the file lines up with the other spiders' output.

## The old Chrome extension

`extension/` is the earlier approach, where a browser extension drove the crawl
and posted HTML back to the queue. It is kept as a manual fallback for when
Puppeteer cannot get past Akamai. It needs its proxy password filled into
`extension/credentials.js` and is unrelated to `npm start`.
