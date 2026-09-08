/**
 * Try Shopping SERP URL shapes and report which ones return candidate cards.
 *
 *   STRICT_US=0 USE_PROXY=0 HEADLESS=0 node scripts/probe_search_urls.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
require('../env');
const { detectChrome, installHint } = require('../chrome');
const { resolveUsExit, confirmCountryInPage, isUnitedStates, envFlag } = require('../locale');
const { parseShoppingPage, looksLikeBlocked, looksLikeConsent } = require('../parse');

const OUT = process.env.PROBE_OUT || path.join(__dirname, '..', 'probe-out');
const PROFILE = '/tmp/gs-search-probe-profile';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';
const Q = process.env.PROBE_Q || 'Little Giant Smoker Fuel';
const NAV_TIMEOUT = 90000;

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function enc(q) {
  return encodeURIComponent(q);
}

const URLS = [
  ['ibp+udm', `https://www.google.com/search?ibp=oshop&q=${enc(Q)}&gl=us&hl=en&udm=28`],
  ['udm28', `https://www.google.com/search?q=${enc(Q)}&gl=us&hl=en&udm=28`],
  ['tbmshop', `https://www.google.com/search?q=${enc(Q)}&tbm=shop&gl=us&hl=en`],
  ['shopping-q', `https://www.google.com/shopping?q=${enc(Q)}&gl=us&hl=en`],
  ['udm+tbm', `https://www.google.com/search?q=${enc(Q)}&udm=28&tbm=shop&gl=us&hl=en`],
];

async function dismissConsent(page) {
  try {
    await page.evaluate(() => {
      const labels = /accept all|i agree|reject all|alle akzeptieren|ich stimme zu/i;
      const nodes = [...document.querySelectorAll('button, [role="button"], input[type="submit"]')];
      for (const el of nodes) {
        const text = `${el.innerText || ''} ${el.value || ''} ${el.getAttribute('aria-label') || ''}`;
        if (labels.test(text)) {
          el.click();
          return;
        }
      }
      const known = document.querySelector('#L2AGLb, #W0wltc');
      if (known) known.click();
    });
  } catch (e) {}
}

(async () => {
  const chrome = detectChrome();
  if (!chrome) {
    console.error(installHint());
    process.exit(1);
  }
  const exitInfo = await resolveUsExit();
  console.log(`exit ${exitInfo.geo.country} ip=${exitInfo.geo.ip} city=${exitInfo.geo.city}`);
  try {
    fs.rmSync(PROFILE, { recursive: true, force: true });
  } catch (e) {}
  fs.mkdirSync(PROFILE, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: !['0', 'false', 'no'].includes(String(process.env.HEADLESS == null ? '0' : process.env.HEADLESS).toLowerCase())
      ? true
      : false,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      `--user-data-dir=${PROFILE}`,
      '--window-size=1280,900',
      '--lang=en-US',
      '--window-position=-4000,50',
    ],
  });
  const page = (await browser.pages())[0] || (await browser.newPage());
  await page.setUserAgent(UA);
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const geo = await confirmCountryInPage(page);
  console.log(`browser ${geo.country} ${geo.city}`);
  if (!isUnitedStates(geo.country) && envFlag('STRICT_US', true)) {
    throw new Error(`need US, got ${geo.country}`);
  }

  await page.goto('https://www.google.com/shopping?gl=us&hl=en', {
    waitUntil: 'domcontentloaded',
    timeout: NAV_TIMEOUT,
  });
  await delay(2500);
  await dismissConsent(page);
  await delay(800);

  const rows = [];
  for (const [label, url] of URLS) {
    console.log('\n>>', label, url);
    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
        page.evaluate((href) => window.location.assign(href), url),
      ]);
    } catch (e) {}
    await delay(4000);
    await dismissConsent(page);
    await delay(1200);
    const html = await page.content();
    const href = page.url();
    const title = await page.title();
    const parsed = parseShoppingPage({ html, url: href, title });
    const body = await page.evaluate(() =>
      (document.body && document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 280)
    );
    const prds = await page.evaluate(
      () => [...document.querySelectorAll('a[href]')].filter((a) => /prds=|catalogid:|gpcid:/i.test(a.href)).length
    );
    const row = {
      label,
      start: url,
      href,
      title,
      htmlLen: html.length,
      blocked: looksLikeBlocked(html, href),
      consent: looksLikeConsent(html, href),
      candidates: parsed.candidates.length,
      offers: parsed.offers.length,
      prdsLinks: prds,
      emptyProduct: /Details aren't available/i.test(html + body),
      body,
    };
    rows.push(row);
    fs.writeFileSync(path.join(OUT, `search-${label}.html`), html);
    fs.writeFileSync(path.join(OUT, `search-${label}.json`), JSON.stringify(row, null, 2));
    console.log(
      `  title=${title} cand=${row.candidates} prds=${prds} empty=${row.emptyProduct} blocked=${row.blocked}`
    );
    console.log('  body=', body.slice(0, 180));
  }
  fs.writeFileSync(path.join(OUT, 'search-url-probe.json'), JSON.stringify(rows, null, 2));
  await browser.close();
  const winner = rows.find((r) => r.candidates > 0 || r.prdsLinks > 0);
  console.log('\nwinner', winner ? winner.label : 'NONE');
  process.exit(winner ? 0 : 2);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
