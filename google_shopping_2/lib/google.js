/**
 * Google Shopping (udm=28) page access. Reads what is rendered, anchored on
 * stable things (price text, images, "More stores"/"Visit site" labels,
 * jsname=QS8Cxb cards) rather than on obfuscated class names.
 */
const { pageLooksLikeRecaptcha, solveRecaptchaIfPresent } = require('./recaptcha');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (min, max) => delay(min + Math.random() * (max - min));

class BlockedError extends Error {
  constructor(msg) {
    super(msg);
    this.blocked = true;
  }
}

function searchUrl(q) {
  return `https://www.google.com/search?q=${encodeURIComponent(q)}&gl=us&hl=en&udm=28`;
}

async function isBlockedPage(page) {
  const url = page.url();
  if (/\/sorry\//.test(url)) return true;
  const text = await page.evaluate(() => (document.body ? document.body.innerText.slice(0, 3000) : '')).catch(() => '');
  return /unusual traffic|not a robot/i.test(text);
}

async function dismissConsent(page) {
  const clicked = await page
    .evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /^(Accept all|Reject all|I agree)$/i.test(x.innerText.trim()));
      if (b) b.click();
      return !!b;
    })
    .catch(() => false);
  if (clicked) await delay(1500);
}

/** Captcha → solve and keep going; blocked without a solvable captcha → BlockedError. */
async function passGate(page, log) {
  for (let i = 1; i <= 3 && (await pageLooksLikeRecaptcha(page)); i += 1) {
    log(`captcha on ${page.url().slice(0, 60)} (#${i})`);
    const ok = await solveRecaptchaIfPresent(page, { tab: 0, log });
    if (!ok) break;
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline && /\/sorry\//.test(page.url())) await delay(500);
    await delay(1500);
  }
  if (await isBlockedPage(page)) throw new BlockedError('blocked: Google /sorry/ page');
}

async function openSearch(page, query, log) {
  await page.goto(searchUrl(query), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await jitter(1200, 2200);
  await dismissConsent(page);
  await passGate(page, log);
  if (!/udm=28|\/search/.test(page.url())) {
    // captcha redirect may land on a bare page: open the search once more
    await page.goto(searchUrl(query), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await jitter(1200, 2000);
    await passGate(page, log);
  }
  await page.waitForSelector('[jsname="QS8Cxb"]', { timeout: 15000 }).catch(() => {});
}

/** In page: product cards with title/price/store and a JPEG of the card image. */
function readCardsInPage(max) {
  const PRICE = /^\$\s?[\d,]+(\.\d{1,2})?$/;
  const BADGE = /% OFF|^LOW PRICE$|^SALE$|^\d+$|^NEW$|^POPULAR$/i;
  let els = [...document.querySelectorAll('[jsname="QS8Cxb"]')];
  if (!els.length) {
    // fallback: smallest ancestor of a price that holds a big image
    const set = new Set();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!PRICE.test(n.textContent.trim())) continue;
      for (let e = n.parentElement, i = 0; e && i < 12; e = e.parentElement, i += 1) {
        if ([...e.querySelectorAll('img')].some((im) => im.getBoundingClientRect().width >= 60)) {
          set.add(e);
          break;
        }
      }
    }
    els = [...set];
  }
  const toJpeg = (img) => {
    try {
      if (!img || !img.naturalWidth) return null;
      const c = document.createElement('canvas');
      const s = Math.min(1, 384 / Math.max(img.naturalWidth, img.naturalHeight));
      c.width = Math.round(img.naturalWidth * s);
      c.height = Math.round(img.naturalHeight * s);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.85).split(',')[1];
    } catch (e) {
      return null; // cross-origin image
    }
  };
  const num = (s) => parseFloat(String(s).replace(/[^\d.]/g, ''));
  return els.slice(0, max).map((el, idx) => {
    const lines = el.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
    const pi = lines.findIndex((l) => PRICE.test(l));
    const before = lines.slice(0, Math.max(pi, 0)).filter((l) => !BADGE.test(l));
    const title = before.sort((a, b) => b.length - a.length)[0] || '';
    let k = pi + 1;
    let oldPrice = null;
    if (pi >= 0 && lines[k] && (PRICE.test(lines[k]) || /^(Usually|Was) \$/.test(lines[k]))) {
      oldPrice = num(lines[k]);
      k += 1;
    }
    const img = [...el.querySelectorAll('img')].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
    // Google ids: data-cid = catalogid, data-gid = gpcid, data-oid = offer docid, data-pid = product id
    let idEl = el.closest('[data-cid]') || el.querySelector('[data-cid]');
    if (!idEl) for (let e = el.parentElement, i = 0; e && i < 4 && !idEl; e = e.parentElement, i += 1) idEl = e.querySelector('[data-cid]');
    const ids = idEl
      ? { catalogid: idEl.dataset.cid || '', gpcid: idEl.dataset.gid || '', offerDocid: idEl.dataset.oid || '', productId: idEl.dataset.pid || '' }
      : { catalogid: '', gpcid: '', offerDocid: '', productId: '' };
    return {
      idx,
      ...ids,
      title,
      price: pi >= 0 ? num(lines[pi]) : null,
      oldPrice,
      store: lines[k] || '',
      badges: lines.filter((l) => BADGE.test(l)),
      lines: lines.slice(0, 10),
      imageAlt: img ? img.alt : '',
      imageB64: toJpeg(img),
    };
  });
}

function dedupeCards(cards) {
  const best = new Map();
  for (const c of cards) {
    const key = c.catalogid || c.gpcid || `idx${c.idx}`;
    const info = (c.title ? 2 : 0) + (c.price ? 2 : 0) + (c.store && !/\$|% OFF/.test(c.store) ? 1 : 0) + (c.imageB64 ? 1 : 0);
    const prev = best.get(key);
    if (!prev || info > prev.info) best.set(key, { ...c, info });
  }
  return [...best.values()].map(({ info, ...c }) => c).sort((a, b) => a.idx - b.idx);
}

async function readCards(page, max = 80) {
  // scrolling loads further rows
  for (let i = 0; i < 5; i += 1) {
    await page.mouse.wheel({ deltaY: 900 });
    await delay(600);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(300);
  return dedupeCards(await page.evaluate(readCardsInPage, max));
}

/** Click card #idx and wait until its panel has content. */
async function openCard(page, idx) {
  const box = await page.evaluate((i) => {
    const el = document.querySelectorAll('[jsname="QS8Cxb"]')[i];
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + Math.min(r.height / 3, 90) };
  }, idx);
  if (!box) return false;
  await jitter(300, 700);
  await page.mouse.click(box.x, box.y);
  const ok = await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('a,button,span,div')].some(
          (e) =>
            /^(Visit site|More stores|Best price|About this product|Price history|Track price|Price Insights)$/i.test((e.innerText || '').trim()) &&
            e.getBoundingClientRect().left > window.innerWidth * 0.45 &&
            e.getBoundingClientRect().width > 0
        ),
      { timeout: 20000 }
    )
    .then(() => true)
    .catch(() => false);
  await delay(800);
  return ok;
}

/** In page: the side panel — offers (one per store link that shows a price), specs, main image. */
function readPanelInPage() {
  const PRICE = /^\$\s?[\d,]+(\.\d{1,2})?$/;
  const num = (s) => parseFloat(String(s).replace(/[^\d.]/g, ''));
  const anchors = [...document.querySelectorAll('a,button,span,div')].filter((e) =>
    /^(Visit site|More stores|Best price|About this product|Price Insights|Price history|Track price)$/i.test((e.innerText || '').trim())
  );
  const right = anchors.filter((e) => e.getBoundingClientRect().left > window.innerWidth * 0.45);
  if (!right.length) return null;
  let root = right[0];
  while (root.parentElement && root.innerText.length < 400) root = root.parentElement;
  while (root.parentElement && root.parentElement.getBoundingClientRect().left > window.innerWidth * 0.4) root = root.parentElement;

  const text = root.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
  const cut = text.findIndex((l) => /^(Ask anything in AI Mode|More options|Lower-priced options)$/i.test(l));
  const body = cut > 0 ? text.slice(0, cut) : text;

  const external = (href) => href && (!/google\./.test(new URL(href).hostname) || /\/goto\?|\/url\?|aclk/.test(href));
  const offers = [];
  const seen = new Set();
  for (const a of root.querySelectorAll('a[href]')) {
    if (!external(a.href)) continue;
    const lines = a.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
    const pi = lines.findIndex((l) => PRICE.test(l));
    if (pi < 0) continue;
    const store = lines.slice(0, pi).find((l) => !/^Best price$/i.test(l)) || '';
    if (!store || seen.has(store)) continue;
    seen.add(store);
    const rest = lines.slice(pi + 1);
    const OLD = /^(Usually |Was )?\$\s?[\d,]+(\.\d{1,2})?$/;
    const oldIdx = rest.findIndex((l) => OLD.test(l));
    const stockLine = rest.find((l) => /in stock|out of stock|limited stock|pre-?order|backorder|sold out/i.test(l)) || '';
    offers.push({
      store,
      price: num(lines[pi]),
      oldPrice: oldIdx >= 0 ? num(rest[oldIdx]) : null,
      title: rest.filter((l) => !OLD.test(l) && !/% off$/i.test(l) && !/in stock|out of stock|limited stock|pre-?order|\d(\.\d)?\/5|^\(?\d+ (store )?reviews?\)?$/i.test(l))[0] || '',
      stock: /out of stock|sold out/i.test(stockLine) ? 'out_of_stock' : /limited/i.test(stockLine) ? 'limited' : /pre-?order|backorder/i.test(stockLine) ? 'preorder' : /in stock/i.test(stockLine) ? 'in_stock' : 'unknown',
      url: a.href,
    });
  }
  // single-seller panels: the store row may not be a link, "Visit site" is
  const visit = [...root.querySelectorAll('a[href]')].find((a) => /^Visit site$/i.test(a.innerText.trim()));
  if (visit && !offers.some((o) => o.url === visit.href)) {
    const pi = body.findIndex((l) => PRICE.test(l));
    if (pi > 0 && !offers.length) {
      offers.push({ store: body[pi - 1], price: num(body[pi]), oldPrice: null, title: body[pi + 1] || '', stock: (body.find((l) => /in stock/i.test(l)) || ''), url: visit.href });
    } else if (offers.length && !offers[0].direct) {
      offers[0].direct = visit.href;
    }
  }

  // specs: label/value pairs after "About this product"
  const specs = {};
  const ai = body.findIndex((l) => /^About this product$/i.test(l));
  if (ai >= 0) {
    const tail = body.slice(ai + 1, ai + 160);
    for (let i = 0; i < tail.length - 1; i += 1) {
      if (/^(User reviews|Reviews|Ask anything in AI Mode)$/i.test(tail[i])) break;
      if (/^(More details|Less|\.\.\.More)$/i.test(tail[i])) continue;
      if (tail[i].length <= 40 && tail[i + 1].length <= 200 && /^[A-Z][A-Za-z0-9 ()/&.,-]+$/.test(tail[i]) && !/^[A-Z][a-z]+ [a-z]/.test(tail[i + 1].slice(0, 0))) {
        specs[tail[i]] = tail[i + 1];
        i += 1;
      }
    }
  }
  const img = [...root.querySelectorAll('img')].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
  return {
    title: body.find((l) => l.length > 12 && !PRICE.test(l) && !/Price Insights|Best price/.test(l)) || '',
    offers,
    specs,
    image: img ? img.currentSrc || img.src : '',
    imageUrl: img && /^https?:/.test(img.currentSrc || img.src) ? img.currentSrc || img.src : '',
  };
}

/** Expand "More stores" (a few times), then "More details" (specs), then read the panel. */
async function readPanel(page) {
  for (let i = 0; i < 4; i += 1) {
    // "More stores" is a plain div with a jsaction handler: find it by text, click its handler element
    const box = await page.evaluate(() => {
      const hits = [...document.querySelectorAll('*')].filter(
        (e) => /^More stores$/i.test((e.innerText || '').trim()) && e.getBoundingClientRect().left > window.innerWidth * 0.45 && e.getBoundingClientRect().width > 0
      );
      const el = hits.find((e) => e.hasAttribute('jsaction')) || (hits[0] && hits[0].closest('[jsaction]')) || hits[0];
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!box) break;
    const countOffers = () =>
      page.evaluate(() => {
        return [...document.querySelectorAll('a[href]')].filter(
          (a) => a.getBoundingClientRect().left > window.innerWidth * 0.45 && /\$\s?[\d,]+/.test(a.innerText || '')
        ).length;
      });
    const before = await countOffers();
    await page.mouse.click(box.x, box.y);
    // new rows arrive as grey placeholders first: wait until real rows are added
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline && (await countOffers()) <= before) await delay(500);
    await delay(800);
    await jitter(1200, 1800);
  }
  await page.evaluate(() => {
    const e = [...document.querySelectorAll('a,button,span,div[role=button]')].find(
      (x) => /^More details$/i.test((x.innerText || '').trim()) && x.getBoundingClientRect().left > window.innerWidth * 0.45
    );
    if (e) e.click();
  });
  await delay(1200);
  for (let i = 0; i < 6; i += 1) {
    const panel = await page.evaluate(readPanelInPage);
    if (panel && (panel.offers.length || i === 5)) return panel;
    await delay(1000);
  }
  return null;
}

async function closePanel(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await delay(400);
}

module.exports = { searchUrl, openSearch, readCards, openCard, readPanel, closePanel, passGate, BlockedError, jitter, readCardsInPage, readPanelInPage };
