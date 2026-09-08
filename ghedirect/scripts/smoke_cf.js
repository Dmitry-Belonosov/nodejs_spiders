/**
 * Standalone CF smoke test for ghedirect.co.uk
 * Usage: USE_PROXY=1 node scripts/smoke_cf.js
 */
const puppeteer = require('puppeteer-core');
const { looksLikeBlocked, parseGheHtml } = require('../parse');
const { solveTurnstileIfPresent, pageLooksChallenged } = require('../turnstile');

const PROXY_USER = process.env.PROXY_USER || 'competitormonitor-country-GB';
const PROXY_PASS =
  process.env.PROXY_PASS || '';
const PROXY_HOST = process.env.PROXY_HOST || 'private.residential.proxyrack.net';
const USE_PROXY = process.env.USE_PROXY !== '0';
// Without this the crawl would silently run unproxied or fail to authenticate.
if (USE_PROXY && !PROXY_PASS) {
  console.error('PROXY_PASS is not set — add it to .env, or set USE_PROXY=0 to crawl direct');
  process.exit(1);
}
const PORT = 10000 + Math.floor(Math.random() * 20);
const CHROME =
  process.env.CHROME ||
  `${process.env.HOME}/chrome-for-testing/chrome/mac_arm-132.0.6834.83/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const URLS = [
  { url: 'https://ghedirect.co.uk/', mode: 'home' },
  { url: 'https://ghedirect.co.uk/product-sitemap.xml', mode: 'sitemap' },
];

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchOne(page, pageUrl) {
  const started = Date.now();
  const response = await page.goto(pageUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  try {
    if (await pageLooksChallenged(page)) {
      console.log('  turnstile challenge — clicking checkbox…');
      await solveTurnstileIfPresent(page, {
        timeout: 60000,
        log: (m) => console.log('  ' + m),
      });
    }
  } catch (e) {
    console.log('  turnstile error:', e.message || e);
  }
  try {
    await page.waitForFunction(
      () => {
        const t = (document.body && document.body.innerText) || '';
        const title = document.title || '';
        const href = location.href || '';
        return (
          !/Checking your browser/i.test(t) &&
          !/Just a moment/i.test(title) &&
          !/Verify you are human/i.test(t) &&
          !href.includes('ki-cf-botcl')
        );
      },
      { timeout: 45000 }
    );
  } catch (e) {
    console.log('  waitForFunction timeout (challenge may remain)');
  }
  await delay(2500);
  let html = '';
  try {
    html = await page.content();
  } catch (e) {
    await delay(3000);
    html = await page.content();
  }
  const status = response ? response.status() : 0;
  const finalUrl = page.url();
  const blocked = looksLikeBlocked(html, finalUrl, status);
  const parsed = blocked ? null : parseGheHtml(html, finalUrl, null);
  return {
    status,
    finalUrl,
    blocked,
    bytes: html.length,
    ms: Date.now() - started,
    links: (parsed && parsed.links) || [],
    products: (parsed && parsed.products) || [],
    title: (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '',
  };
}

(async () => {
  const args = [
    '--no-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1280,900',
  ];
  if (USE_PROXY) {
    args.push(`--proxy-server=http://${PROXY_HOST}:${PORT}`);
    console.log(`proxy ${PROXY_HOST}:${PORT} user=${PROXY_USER}`);
  } else {
    console.log('proxy OFF');
  }

  const headless = !['0', 'false', 'no'].includes(
    String(process.env.HEADLESS == null ? '0' : process.env.HEADLESS).toLowerCase()
  );
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless,
    args,
    defaultViewport: { width: 1280, height: 900 },
  });
  console.log(`headless=${headless}`);
  const page = await browser.newPage();
  if (USE_PROXY) {
    await page.authenticate({ username: PROXY_USER, password: PROXY_PASS });
  }
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'
  );

  const results = [];
  for (const item of URLS) {
    console.log(`\n>> ${item.mode} ${item.url}`);
    try {
      const r = await fetchOne(page, item.url);
      results.push({ ...item, ...r });
      console.log(
        `  status=${r.status} blocked=${r.blocked} bytes=${r.bytes} ms=${r.ms}`
      );
      console.log(`  final=${r.finalUrl}`);
      console.log(`  title=${r.title.slice(0, 80)}`);
      console.log(`  links=${r.links.length} products=${r.products.length}`);
      if (r.links.length) {
        console.log(
          '  sample links:',
          r.links.slice(0, 5).map((l) => l.url)
        );
      }
      // If sitemap gave products, fetch one PDP
      const pdp = r.links.find((l) => l.mode === 'pdp');
      if (pdp && item.mode === 'sitemap') {
        console.log(`\n>> pdp ${pdp.url}`);
        const pr = await fetchOne(page, pdp.url);
        results.push({ url: pdp.url, mode: 'pdp', ...pr });
        console.log(
          `  status=${pr.status} blocked=${pr.blocked} bytes=${pr.bytes} products=${pr.products.length}`
        );
        if (pr.products[0]) {
          console.log('  sample product:', JSON.stringify(pr.products[0], null, 2).slice(0, 500));
        }
      }
    } catch (e) {
      console.log('  ERROR', e.message || e);
      results.push({ ...item, error: String(e.message || e) });
    }
  }

  await browser.close();
  const ok = results.some((r) => !r.blocked && !r.error && r.bytes > 500);
  console.log('\n==== SUMMARY ====');
  console.log(JSON.stringify(results.map((r) => ({
    mode: r.mode,
    status: r.status,
    blocked: r.blocked,
    bytes: r.bytes,
    links: (r.links || []).length,
    products: (r.products || []).length,
    error: r.error || null,
  })), null, 2));
  process.exit(ok ? 0 : 2);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
