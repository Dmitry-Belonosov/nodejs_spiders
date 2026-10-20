# Google Shopping 2

For each target product: search Google Shopping, find the cards that are the
same product, and collect every seller with price, link and identifiers.
Rebuilt from `google-shopping/` with one process, one Chrome tab, no warm-up and
no self-refresh.

| Step | How |
|---|---|
| 1. Search | `Brand MPN`, then `Brand name` if the code finds nothing |
| 2. Match | text score (MPN/GTIN token, brand, name words, price ±25/50%) + local vision model compares card images with the reference (`image_url` column, else the best text match) |
| 3. Panel | click each matched card, expand "More stores" / "More details", read sellers; Google `goto` links are resolved to the shop URL |
| ids | MPN/GTIN/EAN from Google specs or titles (check-digit validated); empty when Google doesn't show them, which is common |

Captcha → solved (Scraper Shell 2 service, or the local model when run alone)
and the crawl continues; a "none" grid presses Skip, an unanswerable grid asks
for a new one. Blocked without a captcha → reported to the shell, 60 s wait,
retry. The spider never wipes its profile or restarts Chrome by itself.

## Run

From Scraper Shell 2: select **Google Shopping 2** → Start (progress via `/status`).

Alone:
```bash
npm install          # puppeteer-core
LIMIT=5 npm start    # first 5 rows of input.csv
```

Env: `INPUT=input.csv` `LIMIT=0` `MAX_MATCHES=5` `USE_IMAGES=1` `HEADLESS=0` `BLOCK_WAIT_MS=60000`

Input columns: `product_name, brand, mpn, gtin, client_price_usd` (+ optional `id`, `image_url`).

## Output (`out/`)

- `matches.csv` — every card per target with score, reasons, matched flag
- `offers.csv` — one row per seller of each matched product: store, domain, price, old price, title, stock, brand, mpn, gtin, ean, specs, image, shop url
- `domains.csv` — unique shop domains with a sample product (input for step 4: spider generation)
- `images/` — matched card images; `targets/<id>.json` — raw per-target result

Resume: finished targets are skipped. Delete `out/` to start over.

`npm test` — offline tests. `npm run probe "query"` — dump the live page structure to `data/probe/`.
