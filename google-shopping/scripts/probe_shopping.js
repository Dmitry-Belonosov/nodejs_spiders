/**
 * Dump live Google Shopping structure via Chrome for Testing.
 *
 *   node scripts/probe_shopping.js
 *
 * Writes HTML + JSON under /tmp/gs-probe/
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
require('../env');
const { detectChrome, installHint } = require('../chrome');
const { resolveUsExit, confirmCountryInPage, isUnitedStates, envFlag } = require('../locale');
const { forceUsShoppingUrl } = require('../card_url');
const { parseShoppingPage, looksLikeBlocked, looksLikeConsent } = require('../parse');
const { csvToObjects } = require('../csv');

const OUT = process.env.PROBE_OUT || '/tmp/gs-probe';
const HEADLESS = !['0', 'false', 'no'].includes(
  String(process.env.HEADLESS == null ? '0' : process.env.HEADLESS).toLowerCase()
);
const NAV_TIMEOUT = 90000;
const PROFILE = '/tmp/gs-probe-profile';
const HOME = 'https://www.google.com/shopping?gl=us&hl=en';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function write(name, data) {
  fs.mkdirSync(OUT, { recursive: true });
  const p = path.join(OUT, name);
  fs.writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  console.log('wrote', p);
  return p;
}

async function dismissConsent(page) {
  try {
    const clicked = await page.evaluate(() => {
      const labels = /accept all|i agree|reject all|alle akzeptieren|ich stimme zu/i;
      const nodes = [...document.querySelectorAll('button, [role="button"], input[type="submit"]')];
      for (const el of nodes) {
        const text = `${el.innerText || ''} ${el.value || ''} ${el.getAttribute('aria-label') || ''}`;
        if (labels.test(text)) {
          el.click();
          return text.replace(/\s+/g, ' ').trim().slice(0, 80);
        }
      }
      const known = document.querySelector('#L2AGLb, #W0wltc');
      if (known) {
        known.click();
        return known.id;
      }
      return null;
    });
    if (clicked) console.log('consent clicked:', clicked);
    return clicked;
  } catch (e) {
    return null;
  }
}

async function inspect(page, label, xhrBodies) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      await delay(800);
      const info = await page.evaluate(() => {
        const text = (el) => (el && (el.innerText || el.textContent) || '').replace(/\s+/g, ' ').trim();
        const links = [...document.querySelectorAll('a[href]')].map((a) => ({
          href: a.href,
          text: text(a).slice(0, 100),
        }));
        const prds = links.filter((l) => /prds=|catalogid:|gpcid:|shopping\/product/i.test(l.href));
        const buttons = [...document.querySelectorAll('button,[role="button"]')]
          .map((b) => ({
            text: text(b).slice(0, 80),
            aria: b.getAttribute('aria-label') || '',
          }))
          .filter((b) => b.text || b.aria)
          .slice(0, 60);
        const prices = (document.body && document.body.innerText.match(/\$\d[\d,]*\.\d{2}/g)) || [];
        const chunks = [];
        for (const el of document.querySelectorAll('div, a, li')) {
          const t = text(el);
          if (t.length < 12 || t.length > 220) continue;
          if (!/\$\d/.test(t)) continue;
          const a = el.closest('a') || el.querySelector('a');
          chunks.push({
            text: t,
            href: a ? a.href : '',
            cls: String(el.className || '').slice(0, 80),
          });
          if (chunks.length >= 60) break;
        }
        return {
          href: location.href,
          title: document.title,
          h1: text(document.querySelector('h1')).slice(0, 200),
          htmlLen: document.documentElement.outerHTML.length,
          bodyHead: text(document.body).slice(0, 500),
          linkCount: links.length,
          prdsLinkCount: prds.length,
          prdsSample: prds.slice(0, 8),
          buttonSample: buttons.slice(0, 25),
          priceSample: prices.slice(0, 15),
          priceCount: prices.length,
          offerChunks: chunks.slice(0, 25),
        };
      });
      const html = await page.content();
      info.blocked = looksLikeBlocked(html, info.href);
      info.consent = looksLikeConsent(html, info.href);
      const parsed = parseShoppingPage({ html, url: info.href, xhrBodies, title: info.title });
      info.parsedOffers = parsed.offers.length;
      info.parsedCandidates = parsed.candidates.length;
      info.catalogid = parsed.catalogid;
      info.gpcid = parsed.gpcid;
      console.log(
        `\n== ${label} ==\n  url=${info.href}\n  title=${info.title}\n  html=${info.htmlLen} blocked=${info.blocked} consent=${info.consent}\n  prdsLinks=${info.prdsLinkCount} offers=${info.parsedOffers} candidates=${info.parsedCandidates} prices=${info.priceCount}`
      );
      write(`${label}.json`, info);
      write(`${label}.html`, html);
      write(`${label}-parsed.json`, parsed);
      return { info, html, parsed };
    } catch (e) {
      lastErr = e;
      if (!/context was destroyed|Execution context|detached/i.test(e.message)) throw e;
      console.log(`inspect ${label} retry ${attempt}: ${e.message}`);
      await delay(1500);
    }
  }
  throw lastErr;
}

async function go(page, url) {
  try {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
      page.evaluate((href) => window.location.assign(href), url),
    ]);
  } catch (e) {}
  await delay(4000);
  await dismissConsent(page);
  await delay(1500);
}

(async () => {
  const chrome = detectChrome();
  if (!chrome) {
    console.error(installHint());
    process.exit(1);
  }
  const exitInfo = await resolveUsExit();
  console.log(
    `exit US via=${exitInfo.useProxy ? 'proxy' : 'vpn'} ip=${exitInfo.geo.ip} city=${exitInfo.geo.city}`
  );

  fs.mkdirSync(OUT, { recursive: true });
  try {
    fs.rmSync(PROFILE, { recursive: true, force: true });
  } catch (e) {}
  fs.mkdirSync(PROFILE, { recursive: true });

  const portsToTry = exitInfo.useProxy
    ? [exitInfo.proxyPort, exitInfo.proxyPort + 1, exitInfo.proxyPort + 3, exitInfo.proxyPort + 7]
    : [null];

  let browser = null;
  let page = null;
  let lastErr = null;
  for (const port of portsToTry) {
    const args = [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      `--user-data-dir=${PROFILE}`,
      '--window-size=1280,900',
      '--lang=en-US',
    ];
    if (port) {
      args.unshift(`--proxy-server=http://${exitInfo.proxyHost}:${port}`);
      console.log('proxy ON', exitInfo.proxyHost, port);
    } else {
      console.log('proxy OFF (system/VPN)');
    }
    try {
      if (browser) {
        try {
          await browser.close();
        } catch (e) {}
        browser = null;
      }
      try {
        fs.rmSync(PROFILE, { recursive: true, force: true });
      } catch (e) {}
      fs.mkdirSync(PROFILE, { recursive: true });
      browser = await puppeteer.launch({
        executablePath: chrome,
        headless: HEADLESS,
        ignoreDefaultArgs: ['--enable-automation'],
        args,
      });
      page = (await browser.pages())[0] || (await browser.newPage());
      if (port) {
        await page.authenticate({ username: exitInfo.proxyUser, password: exitInfo.proxyPass });
      }
      await page.setUserAgent(UA);
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });
      const geo = await confirmCountryInPage(page);
      console.log(`browser exit ${geo.country} ip=${geo.ip} city=${geo.city} org=${geo.org} source=${geo.source}`);
      write('geo.json', geo);
      if (!isUnitedStates(geo.country)) {
        if (envFlag('STRICT_US', true)) {
          throw new Error(`browser exit is ${geo.country}, need US`);
        }
        console.warn(`STRICT_US=0 — probing on ${geo.country} anyway`);
      }
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      console.error(`probe launch/locale failed on port ${port}:`, e.message);
    }
  }
  if (lastErr || !page) {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
    throw lastErr || new Error('failed to open Chrome');
  }

  const xhrBodies = [];
  page.on('response', async (res) => {
    try {
      const u = res.url();
      const ct = res.headers()['content-type'] || '';
      if (!/json|javascript|text/i.test(ct) && !/async|batchexecute|Shopping/i.test(u)) return;
      if (res.status() !== 200) return;
      const text = await res.text();
      if (!/catalogid|gpcid|offer|merchant|price/i.test(text) && text.length < 500) return;
      if (text.length > 2_000_000) return;
      xhrBodies.push({ url: u.slice(0, 300), ct, len: text.length, body: text.slice(0, 200000) });
    } catch (e) {}
  });

  console.log('>> home', HOME);
  await page.goto(HOME, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await delay(4000);
  await dismissConsent(page);
  await delay(1500);
  await inspect(page, 'home', xhrBodies.slice());

  const rows = csvToObjects(fs.readFileSync(path.join(__dirname, '..', 'test-cards.csv'), 'utf8'));
  const cyclone = rows.find((r) => /Cyclone II/i.test(r.product_name)) || rows[2];
  const cardUrl = forceUsShoppingUrl(cyclone.card_url);
  console.log('>> card', cardUrl);
  await go(page, cardUrl);
  const cardDump = await inspect(page, 'card', xhrBodies.slice());

  try {
    await page.evaluate(() => {
      const re = /compare prices|more stores|more sellers|view more|see more/i;
      const nodes = [...document.querySelectorAll('button, a, [role="button"], span, div')];
      for (const el of nodes) {
        const t = (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ');
        if (re.test(t) && t.length < 80) {
          el.click();
          return t;
        }
      }
      return null;
    });
    await delay(4000);
  } catch (e) {}
  await inspect(page, 'card-expanded', xhrBodies.slice());

  const searchUrl = cyclone.card_url.replace(/&prds=[^&]+/, '');
  console.log('>> serp', searchUrl);
  xhrBodies.length = 0;
  await go(page, searchUrl);
  await inspect(page, 'serp', xhrBodies.slice());

  write('xhr-meta.json', xhrBodies.map((x) => ({ url: x.url, ct: x.ct, len: x.len })));
  await browser.close();

  const ok =
    !cardDump.info.blocked &&
    (cardDump.parsed.offers.length > 0 || cardDump.info.priceCount > 0 || cardDump.info.prdsLinkCount > 0);
  console.log('\nprobe done ->', OUT, ok ? 'STRUCTURE_OK' : 'STRUCTURE_WEAK');
  if (!ok) process.exit(2);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
