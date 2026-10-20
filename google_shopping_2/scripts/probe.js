#!/usr/bin/env node
/**
 * Probe the live Google Shopping DOM for one query and write compact
 * structure summaries (not full HTML) to data/probe/:
 *   serp.json   — product cards found via price text + image
 *   panel.json  — the right-hand panel after clicking the first card
 * Full HTML + screenshots are saved too, for offline parser tests.
 *
 *   node scripts/probe.js "Munro CP3005B"
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { detectChrome } = require('../lib/chrome');
const { solveRecaptchaIfPresent, pageLooksLikeRecaptcha, setRecaptchaTilePicker } = require('../lib/recaptcha');
const { createLlmTilePicker } = require('../lib/llm_tile_picker');
const shell = require('../lib/shell_client');

const QUERY = process.argv[2] || 'Munro CP3005B';
const OUT = path.join(__dirname, '..', 'data', 'probe');
const PROFILE = '/tmp/gs2-probe-profile';

setRecaptchaTilePicker(shell.enabled ? shell.recaptchaPicker : createLlmTilePicker());
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/** Runs in the page: cards = smallest ancestor of a "$" price that also holds a sizeable image. */
function summarizeCards() {
  const priceRe = /^\$\s?[\d,]+(\.\d{2})?$/;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const cards = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!priceRe.test(n.textContent.trim())) continue;
    let el = n.parentElement;
    for (let i = 0; i < 12 && el; i += 1, el = el.parentElement) {
      const img = [...el.querySelectorAll('img')].find((im) => im.getBoundingClientRect().width >= 60);
      if (img) {
        cards.add(el);
        break;
      }
    }
  }
  const attrs = (el) =>
    [...el.attributes].filter((a) => !/^(style|src|srcset)$/.test(a.name)).map((a) => `${a.name}=${a.value.slice(0, 60)}`).join(' ');
  const chain = (el) => {
    const out = [];
    for (let e = el, i = 0; e && i < 4; e = e.parentElement, i += 1) out.push(`${e.tagName.toLowerCase()}[${attrs(e)}]`);
    return out;
  };
  return [...cards].slice(0, 12).map((el) => {
    const r = el.getBoundingClientRect();
    return {
      chain: chain(el),
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      text: el.innerText.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 10),
      imgs: [...el.querySelectorAll('img')].map((im) => ({ w: Math.round(im.getBoundingClientRect().width), alt: im.alt.slice(0, 60), src: (im.currentSrc || im.src).slice(0, 90) })).slice(0, 3),
      links: [...el.querySelectorAll('a[href]')].map((a) => a.href.slice(0, 160)).slice(0, 4),
      clickable: [...el.querySelectorAll('[jsaction],[role=button],[tabindex]')].map((c) => `${c.tagName.toLowerCase()}[${attrs(c)}]`).slice(0, 3),
    };
  });
}

/** Runs in the page: the container that holds "Visit site" buttons (the side panel). */
function summarizePanel() {
  const hits = [...document.querySelectorAll('a, button, [role=button], span, div')].filter(
    (e) => /^(Visit site|View details)$/i.test((e.innerText || '').trim())
  );
  if (!hits.length) return { found: false };
  let panel = hits[0];
  while (panel.parentElement && panel.getBoundingClientRect().height < 500) panel = panel.parentElement;
  const attrs = (el) =>
    [...el.attributes].filter((a) => !/^(style|src|srcset)$/.test(a.name)).map((a) => `${a.name}=${a.value.slice(0, 60)}`).join(' ');
  const r = panel.getBoundingClientRect();
  return {
    found: true,
    panel: `${panel.tagName.toLowerCase()}[${attrs(panel)}]`,
    rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    text: panel.innerText.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 120),
    links: [...panel.querySelectorAll('a[href]')]
      .map((a) => ({ text: a.innerText.trim().slice(0, 60), href: a.href.slice(0, 220), attrs: attrs(a).slice(0, 200) }))
      .slice(0, 40),
    imgs: [...panel.querySelectorAll('img')].map((im) => (im.currentSrc || im.src).slice(0, 120)).slice(0, 5),
    visitSite: hits.slice(0, 6).map((e) => `${e.tagName.toLowerCase()}[${attrs(e).slice(0, 200)}]`),
  };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME || detectChrome(),
    headless: false,
    userDataDir: PROFILE,
    defaultViewport: null,
    args: ['--window-size=1440,1000', '--lang=en-US'],
  });
  const page = (await browser.pages())[0];
  const url = `https://www.google.com/search?q=${encodeURIComponent(QUERY)}&gl=us&hl=en&udm=28`;
  console.log(`open ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await delay(2500);
  for (let i = 0; i < 3 && (await pageLooksLikeRecaptcha(page)); i += 1) {
    console.log('captcha — solving');
    await solveRecaptchaIfPresent(page, { tab: 0 });
    await delay(3000);
  }
  await delay(2000);
  fs.writeFileSync(path.join(OUT, 'serp.html'), await page.content());
  await page.screenshot({ path: path.join(OUT, 'serp.png') });
  const cards = await page.evaluate(summarizeCards);
  fs.writeFileSync(path.join(OUT, 'serp.json'), JSON.stringify({ url: page.url(), cards }, null, 1));
  console.log(`cards found: ${cards.length}`);

  if (cards.length) {
    const [x, y, w, h] = cards[0].rect;
    await page.mouse.click(x + w / 2, y + Math.min(h / 3, 80));
    const t0 = Date.now();
    await page
      .waitForFunction(() => [...document.querySelectorAll('a,button,span')].some((e) => /^Visit site$/i.test((e.innerText || '').trim())), { timeout: 20000 })
      .catch(() => {});
    console.log(`panel content after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    // scroll inside the panel so lazy seller rows load
    for (let i = 0; i < 6; i += 1) {
      await page.mouse.move(1200, 600);
      await page.mouse.wheel({ deltaY: 700 });
      await delay(700);
    }
    fs.writeFileSync(path.join(OUT, 'panel.html'), await page.content());
    await page.screenshot({ path: path.join(OUT, 'panel.png') });
    const panel = await page.evaluate(summarizePanel);
    fs.writeFileSync(path.join(OUT, 'panel.json'), JSON.stringify(panel, null, 1));
    console.log(`panel found: ${panel.found} lines=${(panel.text || []).length} links=${(panel.links || []).length}`);
    const details = await page.$$('a, button, [role=button]');
    let clicked = false;
    for (const d of details) {
      const t = await d.evaluate((e) => (e.innerText || '').trim()).catch(() => '');
      if (/^View details$/i.test(t)) {
        await d.evaluate((e) => e.scrollIntoView({ block: 'center' }));
        await delay(500);
        await d.click().catch(() => {});
        clicked = true;
        break;
      }
    }
    await delay(6000);
    for (let i = 0; i < 8; i += 1) {
      await page.mouse.wheel({ deltaY: 900 });
      await delay(600);
    }
    fs.writeFileSync(path.join(OUT, 'details.html'), await page.content());
    const det = await page.evaluate(() => ({
      url: location.href,
      text: document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean),
    }));
    fs.writeFileSync(path.join(OUT, 'details.json'), JSON.stringify(det, null, 1));
    console.log(`details clicked=${clicked} url=${det.url.slice(0, 120)} lines=${det.text.length}`);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
