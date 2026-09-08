/**
 * Puppeteer worker — config of the successful 30/30 run, plus speedups.
 *
 * Successful baseline:
 *  - Persistent browser per thread (cookies stay)
 *  - NEW tab per URL (newPage → goto → close) — this is what worked
 *  - NO resource blocking by default (BLOCK_TYPES empty)
 *  - Rotate proxy on CF / empty / net errors (don't sit on a dead IP)
 *
 * Speedups vs that run:
 *  - THREADS default 4 (was 2)
 *  - Shorter inter-request delay
 *  - Optional BLOCK_TYPES=image,font (safe); leave stylesheet alone
 *  - Parallel tabs per browser via PAGE_CONCURRENCY (default 1; try 2)
 *
 * Env:
 *   THREADS=4
 *   PAGE_CONCURRENCY=1
 *   BLOCK_TYPES=          (empty = successful config)
 *   DELAY_MS=400
 *   SERVER=http://127.0.0.1:5052
 */
const puppeteer = require('puppeteer-core');
const axios = require('axios');
const fs = require('fs');
const { parseAutodocHtml, applyShipping, getUrlIdentifier, extractPrice } = require('./parse');

const SERVER_BASE = process.env.SERVER || 'http://127.0.0.1:5052';
const THREADS = parseInt(process.env.THREADS || '4', 10);
const PAGE_CONCURRENCY = parseInt(process.env.PAGE_CONCURRENCY || '1', 10);
const DELAY_MS = parseInt(process.env.DELAY_MS || '400', 10);
const PROXY_USER = process.env.PROXY_USER || 'competitormonitor-country-uk';
const PROXY_PASS =
  process.env.PROXY_PASS || '';
// Without this the crawl would silently fail to authenticate with the proxy.
if (!PROXY_PASS) {
  console.error('PROXY_PASS is not set — add it to .env');
  process.exit(1);
}
const PROXY_HOST = process.env.PROXY_HOST || 'private.residential.proxyrack.net';
const PROXY_COUNT = parseInt(process.env.PROXY_COUNT || '200', 10);
const CHROME =
  process.env.CHROME ||
  '/tmp/chrome-for-testing/chrome/mac_arm-132.0.6834.83/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

// Default EMPTY = successful 30/30. Set BLOCK_TYPES=image,font to save bandwidth later.
const BLOCK_TYPES = (process.env.BLOCK_TYPES !== undefined ? process.env.BLOCK_TYPES : '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function proxyPort(i) {
  return 10000 + (i % PROXY_COUNT);
}

function looksLikeCf(html) {
  return (
    /Just a moment|cf-browser-verification|challenge-platform|Attention Required|_cf_chl_opt/i.test(
      html || ''
    ) && (html || '').length < 20000
  );
}

function isHardError(msg) {
  return /TARGET_CLOSED|Session closed|disconnected|detached Frame|ERR_TUNNEL|ERR_PROXY|ERR_CONNECTION|ERR_TIMED_OUT|ERR_NETWORK_CHANGED|Navigation timeout|net::/i.test(
    msg || ''
  );
}

async function fetchTask() {
  const res = await axios.get(`${SERVER_BASE}/get`, { timeout: 15000 });
  return res.data;
}

async function saveProducts(ind, products) {
  await axios.post(`${SERVER_BASE}/save/`, { ind, products }, { timeout: 30000 });
}

function productFromApi(payload, pageUrl) {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload.data || payload.product || payload;
  const name = data.name || data.title || data.productName;
  if (!name) return null;
  const identifier = String(
    data.id || data.articleId || data.productId || getUrlIdentifier(pageUrl)
  );
  const brand =
    (typeof data.brand === 'string' ? data.brand : data.brand && data.brand.name) ||
    data.brandName ||
    '';
  const price = extractPrice(data.price || data.finalPrice || (data.offers && data.offers.price));
  return {
    identifier,
    url: pageUrl,
    name,
    sku: String(data.sku || data.articleNo || data.mpn || ''),
    brand,
    price,
    category: data.category || data.categoryPath || '',
    image_url: `https://cdn.autodoc.de/thumb?id=${identifier}`,
    stock: data.inStock === false ? 0 : null,
    shipping_cost: '',
    metadata: {
      headline_price: price,
      Condition: data.condition || '',
      'Discount_%': '',
      EAN: data.ean || '',
      MPN: data.mpn || data.articleNo || '',
      source: 'xhr',
    },
  };
}

function productFromOg(html, pageUrl) {
  const title = (html.match(/property="og:title"\s+content="([^"]+)"/i) || [])[1];
  if (!title) return null;
  const identifier = getUrlIdentifier(pageUrl);
  const name = title.replace(/\s*\|\s*AUTODOC.*$/i, '').trim();
  const brand = (name.match(/^[A-Z0-9][A-Z0-9\-]+/) || [])[0] || '';
  return {
    identifier,
    url: pageUrl,
    name,
    sku: '',
    brand,
    price: 0,
    category: '',
    image_url: `https://cdn.autodoc.de/thumb?id=${identifier}`,
    stock: null,
    shipping_cost: '',
    metadata: { headline_price: 0, source: 'og-meta', note: 'body empty — price missing' },
  };
}

async function launchBrowser(threadIndex, proxyIdx) {
  const port = proxyPort(proxyIdx);
  const profile = `/tmp/autodoc-pp-profile-${threadIndex}`;
  fs.mkdirSync(profile, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      `--proxy-server=http://${PROXY_HOST}:${port}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      `--user-data-dir=${profile}`,
      '--window-size=1365,900',
    ],
  });
  return { browser, port };
}

/**
 * Successful-run scrape: fresh tab every URL (same browser/cookies).
 */
async function scrapeWithNewTab(browser, pageUrl) {
  const page = await browser.newPage();
  const apiHits = [];
  try {
    await page.authenticate({ username: PROXY_USER, password: PROXY_PASS });
    await page.setUserAgent(UA);
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    if (BLOCK_TYPES.length) {
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        try {
          if (BLOCK_TYPES.includes(req.resourceType())) return req.abort();
          return req.continue();
        } catch (e) {
          try {
            req.continue();
          } catch (e2) {}
        }
      });
    }

    page.on('response', async (res) => {
      try {
        const ct = (res.headers()['content-type'] || '').toLowerCase();
        if (!ct.includes('json')) return;
        const u = res.url();
        if (!/product|article|catalog|pdp|offer/i.test(u) && !u.includes('autodoc')) return;
        const text = await res.text();
        if (text.length < 50 || text.length > 2000000) return;
        apiHits.push({ url: u, text });
      } catch (e) {}
    });

    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });

    try {
      await page.waitForFunction(
        () => {
          const bodyLen = (document.body && document.body.innerHTML.length) || 0;
          const hasLd = !!document.querySelector('script[type="application/ld+json"]');
          const challenge = /just a moment/i.test(document.title || '');
          return !challenge && (bodyLen > 5000 || hasLd);
        },
        { timeout: 45000, polling: 1000 }
      );
    } catch (e) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await delay(8000);
    }

    const html = await page.content();
    return { html, apiHits };
  } finally {
    await page.close().catch(() => {});
  }
}

function extractProducts(html, apiHits, pageUrl, mode) {
  let products = (parseAutodocHtml(html, pageUrl, mode).products || []).map(applyShipping);

  if (!products.length) {
    for (const hit of apiHits) {
      try {
        const p = productFromApi(JSON.parse(hit.text), pageUrl);
        if (p) {
          products = [applyShipping(p)];
          break;
        }
      } catch (e) {}
    }
  }

  if (!products.length && /og:title/i.test(html) && !looksLikeCf(html)) {
    const og = productFromOg(html, pageUrl);
    if (og) products = [applyShipping(og)];
  }

  return products;
}

async function thread(index) {
  let proxyIdx = index * 17 + 1;
  let session = null;
  let browserLock = Promise.resolve();

  function withBrowserLock(fn) {
    const run = browserLock.then(fn, fn);
    browserLock = run.catch(() => {});
    return run;
  }

  async function ensureBrowser(forceNew) {
    return withBrowserLock(async () => {
      if (session && !forceNew) {
        try {
          if (session.browser.connected) return session;
        } catch (e) {}
      }
      if (session) {
        try {
          await session.browser.close();
        } catch (e) {}
      }
      proxyIdx += 1;
      session = await launchBrowser(index, proxyIdx);
      console.log(
        `t${index} browser proxy=${session.port} block=[${BLOCK_TYPES.join(',') || 'none'}]`
      );
      return session;
    });
  }

  await ensureBrowser(true);

  const runners = [];
  for (let slot = 0; slot < PAGE_CONCURRENCY; slot += 1) {
    runners.push(
      (async function loop() {
        let retries = 0;
        for (;;) {
          let task;
          try {
            task = await fetchTask();
            if (!task || task.ind === undefined) {
              await delay(3000);
              continue;
            }
          } catch (e) {
            console.error(`t${index}s${slot} get:`, e.message);
            await delay(4000);
            continue;
          }

          const pageUrl = task.data.url;
          const mode = task.data.mode || 'pdp';

          try {
            await ensureBrowser(false);
            console.log(`t${index}s${slot} fetch ind=${task.ind}`);
            const { html, apiHits } = await scrapeWithNewTab(session.browser, pageUrl);

            if (looksLikeCf(html)) {
              retries += 1;
              console.error(`t${index}s${slot} CF ind=${task.ind} -> rotate`);
              await ensureBrowser(true);
              await delay(Math.min(8000, 1000 * retries));
              continue;
            }

            const products = extractProducts(html, apiHits, pageUrl, mode);

            if (!products.length) {
              retries += 1;
              console.error(
                `t${index}s${slot} empty ind=${task.ind} html=${html.length} api=${apiHits.length}`
              );
              if (retries % 3 === 0) await ensureBrowser(true);
              await delay(2000);
              continue;
            }

            await saveProducts(task.ind, products);
            console.log(
              `t${index}s${slot} saved ind=${task.ind} products=${products.length} price=${
                products[0].price
              } src=${(products[0].metadata && products[0].metadata.source) || 'html'}`
            );
            retries = 0;
            await delay(DELAY_MS + Math.random() * DELAY_MS);
          } catch (e) {
            console.error(`t${index}s${slot} scrape ind=${task.ind}:`, e.message);
            retries += 1;
            if (isHardError(e.message)) await ensureBrowser(true);
            await delay(2500);
          }
        }
      })()
    );
  }

  await Promise.all(runners);
}

console.log(
  `Starting ${THREADS}x${PAGE_CONCURRENCY} puppeteer workers -> ${SERVER_BASE} (successful-config + speed)`
);
for (let i = 0; i < THREADS; i += 1) thread(i);
