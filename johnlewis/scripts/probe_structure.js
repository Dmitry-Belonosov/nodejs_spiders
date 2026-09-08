/**
 * Dump the live johnlewis.com page structure via Chrome for Testing.
 *
 *   USE_PROXY=0 HEADLESS=0 node scripts/probe_structure.js
 *
 * Writes HTML + JSON under /tmp/jl-probe/
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const HOME = 'https://www.johnlewis.com/';
const BRANDS = 'https://www.johnlewis.com/brands';
const OUT = process.env.PROBE_OUT || '/tmp/jl-probe';
const CHROME =
  process.env.CHROME ||
  `${process.env.HOME}/chrome-for-testing/chrome/mac_arm-132.0.6834.83/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const USE_PROXY = !['0', 'false', 'no', 'off'].includes(
  String(process.env.USE_PROXY == null ? '0' : process.env.USE_PROXY).toLowerCase()
);
const PROXY_USER = process.env.PROXY_USER || 'competitormonitor-country-uk';
const PROXY_PASS = process.env.PROXY_PASS || '';
const PROXY_HOST = process.env.PROXY_HOST || 'private.residential.proxyrack.net';
const PROXY_PORT = parseInt(process.env.PROXY_PORT || '10001', 10);
const HEADLESS = !['0', 'false', 'no'].includes(
  String(process.env.HEADLESS == null ? '0' : process.env.HEADLESS).toLowerCase()
);
const NAV_TIMEOUT = 90000;
const PROFILE = '/tmp/jl-probe-profile';

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function write(name, data) {
  fs.mkdirSync(OUT, { recursive: true });
  const p = path.join(OUT, name);
  fs.writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  console.log('wrote', p);
}

async function dismissCookies(page) {
  try {
    await page.evaluate(() => {
      const sels = [
        '#onetrust-accept-btn-handler',
        'button#onetrust-accept-btn-handler',
        'button[id*="accept"]',
        'button[aria-label*="Accept"]',
        'button[data-test="accept-cookies"]',
      ];
      for (const s of sels) {
        const el = document.querySelector(s);
        if (el) {
          el.click();
          return s;
        }
      }
      return null;
    });
  } catch (e) {}
}

async function inspect(page, label) {
  const info = await page.evaluate(() => {
    const abs = (href) => {
      try {
        return new URL(href, location.href).href;
      } catch (e) {
        return href;
      }
    };
    const links = [...document.querySelectorAll('a[href]')].map((a) => ({
      href: abs(a.getAttribute('href')),
      text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    }));
    const pathCounts = {};
    for (const l of links) {
      try {
        const u = new URL(l.href);
        const parts = u.pathname.split('/').filter(Boolean);
        const key = '/' + parts.slice(0, 2).join('/');
        pathCounts[key] = (pathCounts[key] || 0) + 1;
      } catch (e) {}
    }
    const brandLinks = links.filter(
      (l) =>
        /\/brand\//i.test(l.href) ||
        /\/brands\//i.test(l.href) ||
        /\/browse\/.*brand/i.test(l.href)
    );
    const productLinks = links.filter((l) => /\/p\d+(\?|$)/i.test(l.href));
    const scripts = [...document.querySelectorAll('script')].map((s) => ({
      type: s.type || '',
      id: s.id || '',
      src: s.src || '',
      hasNext: (s.textContent || '').includes('__NEXT_DATA__'),
      hasApollo: /apollo|__APOLLO/i.test(s.textContent || ''),
      hasPdp: /pdp|productV2|productsV2|__PRELOADED/i.test(s.textContent || ''),
      len: (s.textContent || '').length,
    }));
    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map(
      (s) => {
        try {
          return JSON.parse(s.textContent);
        } catch (e) {
          return s.textContent.slice(0, 400);
        }
      }
    );
    const nextEl = document.getElementById('__NEXT_DATA__');
    let nextData = null;
    if (nextEl) {
      try {
        nextData = JSON.parse(nextEl.textContent);
      } catch (e) {
        nextData = { parseError: true, len: nextEl.textContent.length };
      }
    }
    const frames = [...document.querySelectorAll('iframe')].map((f) => f.src || f.id || f.title);
    const buttons = [...document.querySelectorAll('button,[role="button"]')]
      .slice(0, 80)
      .map((b) => ({
        text: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
        aria: b.getAttribute('aria-label') || '',
        name: b.getAttribute('name') || '',
        data: Object.keys(b.dataset || {}).join(','),
        className: String(b.className || '').slice(0, 80),
      }));
    const inputs = [...document.querySelectorAll('select,input, [data-test], [data-testid]')]
      .slice(0, 120)
      .map((el) => ({
        tag: el.tagName,
        type: el.getAttribute('type') || '',
        name: el.getAttribute('name') || '',
        test: el.getAttribute('data-test') || el.getAttribute('data-testid') || '',
        aria: el.getAttribute('aria-label') || '',
        className: String(el.className || '').slice(0, 80),
      }));
    const h1 = (document.querySelector('h1') && document.querySelector('h1').innerText) || '';
    const title = document.title;
    const bodyText = (document.body && document.body.innerText) || '';
    return {
      href: location.href,
      title,
      h1: h1.replace(/\s+/g, ' ').trim().slice(0, 200),
      htmlLen: document.documentElement.outerHTML.length,
      bodyLen: bodyText.length,
      bodyHead: bodyText.replace(/\s+/g, ' ').trim().slice(0, 400),
      linkCount: links.length,
      pathCounts,
      brandLinks: brandLinks.slice(0, 40),
      brandLinkCount: brandLinks.length,
      productLinks: productLinks.slice(0, 20),
      productLinkCount: productLinks.length,
      jsonLd,
      nextDataKeys: nextData && typeof nextData === 'object' ? Object.keys(nextData) : null,
      nextPageProps:
        nextData && nextData.props && nextData.props.pageProps
          ? Object.keys(nextData.props.pageProps)
          : null,
      scripts: scripts.filter((s) => s.src || s.hasNext || s.hasApollo || s.hasPdp || s.len > 2000).slice(0, 40),
      frames,
      buttons: buttons.filter((b) => b.text || b.aria).slice(0, 40),
      inputs: inputs.filter((i) => i.test || i.name || i.aria).slice(0, 50),
      challenged: /just a moment|verify you are human|i am human|access denied|attention required|checking your browser|captcha/i.test(
        title + ' ' + bodyText
      ),
    };
  });
  info.label = label;
  console.log(
    `\n== ${label} ==\n  url=${info.href}\n  title=${info.title}\n  h1=${info.h1}\n  html=${info.htmlLen} challenged=${info.challenged}\n  brands=${info.brandLinkCount} products=${info.productLinkCount} links=${info.linkCount}`
  );
  console.log('  pathCounts', JSON.stringify(info.pathCounts));
  if (info.brandLinks[0]) console.log('  sample brand', info.brandLinks[0]);
  if (info.productLinks[0]) console.log('  sample product', info.productLinks[0]);
  if (info.jsonLd.length) console.log('  jsonLd types', info.jsonLd.map((j) => j['@type'] || typeof j));
  if (info.frames.length) console.log('  frames', info.frames);
  write(`${label}.json`, info);
  const html = await page.content();
  write(`${label}.html`, html);
  return { info, html };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(PROFILE, { recursive: true });
  const args = [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled',
    `--user-data-dir=${PROFILE}`,
    '--window-size=1280,900',
    '--lang=en-GB',
  ];
  if (USE_PROXY) {
    if (!PROXY_PASS) {
      console.error('PROXY_PASS missing');
      process.exit(1);
    }
    args.unshift(`--proxy-server=http://${PROXY_HOST}:${PROXY_PORT}`);
    console.log('proxy ON', PROXY_HOST, PROXY_PORT);
  } else {
    console.log('proxy OFF (system/VPN)');
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: HEADLESS,
    ignoreDefaultArgs: ['--enable-automation'],
    args,
  });
  const page = (await browser.pages())[0] || (await browser.newPage());
  if (USE_PROXY) await page.authenticate({ username: PROXY_USER, password: PROXY_PASS });
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-GB,en;q=0.9' });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const graphqlHits = [];
  page.on('response', async (res) => {
    try {
      const u = res.url();
      if (/graphql|catalogue|product/i.test(u) && /johnlewis/i.test(u)) {
        const ct = res.headers()['content-type'] || '';
        graphqlHits.push({ url: u.slice(0, 180), status: res.status(), ct, type: res.request().resourceType() });
      }
    } catch (e) {}
  });

  console.log('>> home', HOME);
  await page.goto(HOME, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await delay(4000);
  await dismissCookies(page);
  await delay(1500);
  await inspect(page, 'home');

  console.log('>> brands', BRANDS);
  await page.evaluate((url) => window.location.assign(url), BRANDS);
  await delay(5000);
  await dismissCookies(page);
  const brands = await inspect(page, 'brands');

  let brandUrl =
    (brands.info.brandLinks.find((l) => /le-creuset|portmeirion|denby|kitchenaid/i.test(l.href + l.text)) ||
      brands.info.brandLinks[0] ||
      {}).href;
  if (!brandUrl) {
    // fallback: any listing-looking link besides /brands itself
    const extra = await page.evaluate(() =>
      [...document.querySelectorAll('a[href]')]
        .map((a) => a.href)
        .filter((h) => /johnlewis\.com\/(?!brands\/?$)(brand|browse|our-brands)/i.test(h))
        .slice(0, 5)
    );
    brandUrl = extra[0];
    console.log('fallback brand candidates', extra);
  }

  let listing = null;
  if (brandUrl) {
    console.log('>> brand', brandUrl);
    await page.evaluate((url) => window.location.assign(url), brandUrl);
    await delay(6000);
    listing = await inspect(page, 'brand');
  }

  let productUrl = listing && listing.info.productLinks[0] && listing.info.productLinks[0].href;
  if (!productUrl) {
    productUrl =
      'https://www.johnlewis.com/le-creuset-signature-cast-iron-round-casserole-24cm/p231628567';
    console.log('using fallback product url');
  }
  console.log('>> pdp', productUrl);
  await page.evaluate((url) => window.location.assign(url), productUrl);
  await delay(8000);
  await dismissCookies(page);
  const pdp = await inspect(page, 'pdp');

  // Extra PDP selectors / option widgets
  const pdpExtra = await page.evaluate(() => {
    const text = (el) => (el && (el.innerText || el.textContent) || '').replace(/\s+/g, ' ').trim();
    const qs = (s) => document.querySelector(s);
    const qsa = (s) => [...document.querySelectorAll(s)];
    const priceSels = [
      '[data-test="product-price"]',
      '[data-testid="product-price"]',
      '[itemprop="price"]',
      '.price',
      '[class*="Price"]',
    ];
    const prices = {};
    for (const s of priceSels) {
      const el = qs(s);
      if (el) prices[s] = text(el).slice(0, 80);
    }
    const optionGroups = qsa(
      '[data-test*="variant"], [data-testid*="variant"], [data-test*="colour"], [data-test*="size"], fieldset, [role="radiogroup"]'
    )
      .slice(0, 20)
      .map((g) => ({
        test: g.getAttribute('data-test') || g.getAttribute('data-testid') || '',
        legend: text(g.querySelector('legend,h2,h3,[class*="legend"]')).slice(0, 80),
        options: qsa.call
          ? [...g.querySelectorAll('button,input,a,[role="radio"],label')]
              .slice(0, 12)
              .map((o) => ({
                tag: o.tagName,
                text: text(o).slice(0, 40),
                value: o.getAttribute('value') || o.getAttribute('aria-label') || '',
                disabled: !!(o.disabled || o.getAttribute('aria-disabled') === 'true'),
              }))
          : [],
      }));
    return {
      prices,
      sku:
        text(qs('[data-test*="sku"], [itemprop="sku"]')) ||
        (document.documentElement.outerHTML.match(/sku["']?\s*[:=]\s*["']?([A-Z0-9-]+)/i) || [])[1] ||
        '',
      optionGroups,
      metaSku: (qs('meta[itemprop="sku"]') && qs('meta[itemprop="sku"]').content) || '',
    };
  });
  write('pdp-extra.json', pdpExtra);
  console.log('pdp extra', JSON.stringify(pdpExtra, null, 2).slice(0, 2500));

  write('graphql-hits.json', graphqlHits);
  console.log('graphql-ish responses', graphqlHits.length, graphqlHits.slice(0, 15));

  await browser.close();
  console.log('\nprobe done ->', OUT);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
