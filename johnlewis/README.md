# John Lewis Node scraper

Chrome-for-Testing spider for [johnlewis.com](https://www.johnlewis.com/). It
opens the homepage, then `/brands`, then every brand listing (with pagination)
and every product. Colour / size options on a product page become one CSV row
each — same columns as the Portmerion `john1.js` GraphQL scrapers.

Anti-block matches the other spiders in this folder:

- Chrome for Testing 132 (not Google Chrome.app)
- two windows × 10 tabs
- pauses between navigations
- homepage warmup, then `location.assign` so Akamai sees a same-origin referrer
- profile wipe + new ProxyRack IP on block (or a wait if you are on VPN)
- hCaptcha **"I am human"** checkbox (`hcaptcha_solver.js`)
- Cloudflare Turnstile **"Verify you are human"** (`turnstile.js`)

Optional: `npm install @xenova/transformers` enables CLIP tile solving for
hCaptcha (same as bueromarkt). Without it the spider still clicks the checkbox
and dumps tiles under `/tmp/johnlewis-captcha` if a grid appears.

## Run

```bash
cd johnlewis
cp .env.example .env   # fill PROXY_PASS only if USE_PROXY=1
npm install
npm start
```

VPN (Happ / system) is the default (`USE_PROXY=0`). Disable the VPN and set
`USE_PROXY=1` to go through ProxyRack GB/UK instead.

Smoke a few products without a full catalogue crawl:

```bash
MAX_PRODUCTS=20 npm start
```

## Layout

| file | role |
|---|---|
| `run.js` | supervisor — starts queue + Chrome workers, exports, exits |
| `server.js` | URL queue on `PORT` (default 5056) |
| `puppeteer_worker.js` | Chrome for Testing windows / tabs |
| `parse.js` | `__NEXT_DATA__` → brands, listings, variant rows |
| `export_csv.js` | `johnlewis.csv` |

CSV columns: `title,differentiators,price,old_price,promo1,promo2,promo3,lead_time,category,stock,sku,brand,image_url,url`.
