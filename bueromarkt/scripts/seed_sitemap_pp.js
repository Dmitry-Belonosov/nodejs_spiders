/**
 * Seed urls.json from Bueromarkt product sitemaps via Chrome + ProxyRack.
 * Axios alone gets Incapsula/Cloudflare HTML — browser is required.
 *
 * Env:
 *   LIMIT=30
 *   OUT=urls.json
 *   SITEMAP_MAX=5
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const LIMIT = parseInt(process.env.LIMIT || '30', 10);
const OUT = process.env.OUT || 'urls.json';
const SITEMAP_MAX = parseInt(process.env.SITEMAP_MAX || '5', 10);
const PROXY_HOST = process.env.PROXY_HOST || 'private.residential.proxyrack.net';
const PROXY_PORT = parseInt(process.env.PROXY_PORT || '10000', 10);
const PROXY_USER = process.env.PROXY_USER || 'competitormonitor-country-de';
const PROXY_PASS =
  process.env.PROXY_PASS || '';
const USE_PROXY = process.env.USE_PROXY !== '0';
// Without this the crawl would silently run unproxied or fail to authenticate.
if (USE_PROXY && !PROXY_PASS) {
  console.error('PROXY_PASS is not set — add it to .env, or set USE_PROXY=0 to crawl direct');
  process.exit(1);
}
const CHROME =
  process.env.CHROME ||
  `${process.env.HOME}/chrome-for-testing/chrome/mac_arm-132.0.6834.83/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

function extractLocs(text) {
  const locs = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(text || ''))) locs.push(m[1].trim());
  return locs;
}

async function main() {
  if (!fs.existsSync(CHROME)) {
    throw new Error(`Chrome not found at ${CHROME}`);
  }

  const profile = '/tmp/bueromarkt-sitemap-profile';
  fs.mkdirSync(profile, { recursive: true });

  const args = [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    `--user-data-dir=${profile}`,
    '--window-size=1200,800',
  ];
  if (USE_PROXY) args.unshift(`--proxy-server=http://${PROXY_HOST}:${PROXY_PORT}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    ignoreDefaultArgs: ['--enable-automation'],
    args,
  });

  const page = await browser.newPage();
  if (USE_PROXY) {
    await page.authenticate({ username: PROXY_USER, password: PROXY_PASS });
  }
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'
  );
  console.log(`proxy=${USE_PROXY ? PROXY_HOST + ':' + PROXY_PORT : 'off'}`);

  const urls = [];
  const seen = new Set();
  let emptyStreak = 0;

  try {
    for (let n = 1; n <= SITEMAP_MAX; n += 1) {
      if (LIMIT > 0 && urls.length >= LIMIT) break;
      const sitemapUrl = `https://www.bueromarkt-ag.de/sitemaps/sitemap-products_${n}.xml`;
      console.log(`fetch ${sitemapUrl}`);

      let text = '';
      let ok = false;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          if (page.isClosed()) page = await browser.newPage();
          await page.goto(sitemapUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
          await new Promise((r) => setTimeout(r, 4000));
          try {
            text = await page.evaluate(() => {
              const body = document.body;
              if (body && body.innerText) return body.innerText;
              return document.documentElement ? document.documentElement.outerHTML : '';
            });
          } catch (e) {
            text = await page.content().catch(() => '');
          }
          if (!text || text.length < 1000) {
            text = await page.content().catch(() => '');
          }
          ok = true;
          break;
        } catch (e) {
          console.error(`  attempt ${attempt} failed: ${e.message}`);
          try {
            await page.close().catch(() => {});
          } catch (_) {}
          page = await browser.newPage();
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      if (!ok) {
        console.error(`  giving up on sitemap ${n}`);
        continue;
      }

      const locs = extractLocs(text).filter((u) => /p-/i.test(u));
      console.log(`  found ${locs.length} product locs (body=${(text || '').length})`);
      if (!locs.length) {
        // Two consecutive empties → likely past the last sitemap.
        emptyStreak += 1;
        if (emptyStreak >= 2) break;
        continue;
      }
      emptyStreak = 0;
      for (const loc of locs) {
        if (seen.has(loc)) continue;
        seen.add(loc);
        urls.push({ url: loc, mode: 'pdp', condition: '' });
        if (LIMIT > 0 && urls.length >= LIMIT) break;
      }
      // Checkpoint so a later crash keeps partial seed.
      fs.writeFileSync(OUT, JSON.stringify(urls, null, 2));
      console.log(`  checkpoint ${urls.length} -> ${OUT}`);
    }
  } finally {
    await browser.close().catch(() => {});
  }

  fs.writeFileSync(OUT, JSON.stringify(urls, null, 2));
  console.log(`wrote ${urls.length} -> ${OUT}`);
  if (!urls.length) process.exit(2);
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
