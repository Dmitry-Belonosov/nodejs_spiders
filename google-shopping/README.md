# Google Shopping card crawler

Chrome-for-Testing spider for Google Shopping cards (`catalogid` + `gpcid`).
US locale throughout (`gl=us&hl=en`). A UK/DE/RU exit is a different dataset.

Anti-block matches the other spiders in this folder:

- Chrome for Testing 132 (not Google Chrome.app)
- one headed window, one tab (Google is sensitive to parallel tabs)
- pauses between navigations
- Shopping homepage warmup, then `location.assign` so the referrer is same-origin
- profile wipe + new ProxyRack US IP on block (or a wait if you are on a US VPN)
- `navigator.webdriver` hidden, automation flag stripped

The system VPN on this Mac is often not US. **Testing without a US exit is OK
for parser/pipeline work** (`STRICT_US=0`). Turn the US VPN on later and set
`STRICT_US=1` before trusting catalog ids and prices against the fixture.

If several tabs hit an image captcha at once, they queue: one grid is solved,
then the next tab starts. Dumps go to `/tmp/google-shopping-captcha/grid.png`.
Write `{"indices":[6,10,11]}` to `/tmp/google-shopping-captcha/solution.json`
(0-based tiles) to finish that round.

## Run (current: no US VPN)

```bash
cd google-shopping
npm install
npm test
npm run seed-sample
STRICT_US=0 USE_PROXY=0 COMPLETE_STABLE_POLLS=1 npm start
npm run check-live
```

Search-mode needs a US exit. On a RU IP, `ibp=oshop` without card ids is an empty
product overlay, and a plain Shopping SERP (`udm=28`) hits the unusual-traffic
page. After the US VPN is on:

```bash
STRICT_US=1 USE_PROXY=0 npm run seed-search-one
SEARCH_CANDIDATES=3 COMPLETE_STABLE_POLLS=1 npm start
```

When the US VPN is ready, stop using `STRICT_US=0`. Direct card URLs already
work without US; ids and prices will only match the fixture after the switch:

```bash
STRICT_US=1 USE_PROXY=0 npm run seed-sample
STRICT_US=1 USE_PROXY=0 COMPLETE_STABLE_POLLS=1 npm start
```

Full 50-card fixture (US VPN on):

```bash
npm run seed
STRICT_US=1 USE_PROXY=0 npm start
```

Smoke without a full catalogue:

```bash
MAX_PRODUCTS=3 npm start
```

## Layout

| file | role |
|---|---|
| `run.js` | supervisor — starts queue + Chrome worker, exports, exits |
| `server.js` | task queue on `PORT` (default 5057) |
| `puppeteer_worker.js` | Chrome for Testing |
| `parse.js` | SERP candidates + card offers |
| `proof.js` | VERIFIED_GTIN / URL / MPN / DOMAIN_* |
| `query.js` | brand + name, strip client variant syntax |
| `export_csv.js` | `google-shopping.csv` |

CSV columns: product identity, card ids, `status`, `verdict_tier`,
`offers_seen_in_browser`, `competitor_count` (`null` when we did not look).

`status` is never implied by an empty offer list: `ok`, `looked_empty`,
`fetch_failed`, `no_candidates`, `not_looked` are distinct.
