#!/usr/bin/env node
/**
 * Google Shopping 2 — one process, one Chrome, one tab.
 *
 *   for each target in input.csv:
 *     1. search (Brand + MPN, else Brand + name)
 *     2. match cards: text score + vision-model image check
 *     3. open each matched card's panel → sellers, prices, links, specs
 *
 * Captcha → solved (shell service or local model) and the crawl continues.
 * Blocked without a captcha → report to the shell, wait, retry; the spider
 * never wipes its profile or restarts Chrome on its own (the shell decides).
 *
 * Output (out/): matches.csv, offers.csv, domains.csv, images/, targets/<id>.json
 * Resume: finished targets are skipped (delete out/targets to start over).
 *
 * EXPORT_ONLY=1 rebuilds the CSVs from out/targets without opening Chrome.
 * Env: INPUT=input.csv  LIMIT=0  MAX_MATCHES=5  USE_IMAGES=1  HEADLESS=0  PORT (from shell)
 */
// Captcha defaults, set before lib/recaptcha.js reads them at load time:
// unattended → the model keeps trying rounds; standalone → nobody watches solution.json.
if (!process.env.LLM_CAPTCHA_ROUNDS) process.env.LLM_CAPTCHA_ROUNDS = '6';
if (!process.env.SHELL_URL && !process.env.CAPTCHA_WAIT_MS) process.env.CAPTCHA_WAIT_MS = '0';

const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer-core');
const { detectChrome } = require('./lib/chrome');
const { csvToObjects } = require('./lib/csv');
const { setRecaptchaTilePicker } = require('./lib/recaptcha');
const { createLlmTilePicker } = require('./lib/llm_tile_picker');
const shell = require('./lib/shell_client');
const google = require('./lib/google');
const { matchCards } = require('./lib/match');
const { extractIds } = require('./lib/ids');
const { cleanSpecs, specColumns, SPEC_COLUMNS } = require('./lib/specs');
const stats = require('./lib/stats');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'out');
const INPUT = path.resolve(ROOT, process.env.INPUT || 'input.csv');
const LIMIT = parseInt(process.env.LIMIT || '0', 10);
const MAX_MATCHES = parseInt(process.env.MAX_MATCHES || '12', 10);
const USE_IMAGES = process.env.USE_IMAGES !== '0';
const HEADLESS = process.env.HEADLESS === '1';
const PROFILE = process.env.PROFILE || '/tmp/gs2-profile';
const BLOCK_WAIT_MS = parseInt(process.env.BLOCK_WAIT_MS || '60000', 10);

setRecaptchaTilePicker(shell.enabled ? shell.recaptchaPicker : createLlmTilePicker({ log: (...a) => log(`  ${a.join(' ')}`) }));

// local time HH:MM:SS (the shell log shows the same clock as the Mac)
const log = (...a) => console.log(`[gs2 ${new Date().toTimeString().slice(0, 8)}]`, ...a);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- input / output ----------

function loadTargets() {
  const rows = csvToObjects(fs.readFileSync(INPUT, 'utf8'));
  const targets = rows.map((r, i) => ({
    // real id: input id, else Google catalogid/gpcid, else MPN (+row to keep it unique)
    id: String(r.id || r.catalogid || r.gpcid || (r.mpn ? `${r.mpn}-${i}` : i)),
    catalogid: r.catalogid || '',
    gpcid: r.gpcid || '',
    name: r.product_name || r.name || '',
    brand: r.brand || '',
    mpn: r.mpn || '',
    gtin: r.gtin || r.ean || '',
    price: parseFloat(r.client_price_usd || r.price) || null,
    imageUrl: r.image_url || '',
  }));
  return LIMIT ? targets.slice(0, LIMIT) : targets;
}

const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function writeCsv(file, header, rows) {
  fs.writeFileSync(file, [header.join(','), ...rows.map((r) => header.map((h) => cell(r[h])).join(','))].join('\n') + '\n');
}

function domainOf(url) {
  try {
    const u = new URL(url);
    if (/google\./.test(u.hostname)) {
      const inner = u.searchParams.get('url') || u.searchParams.get('q') || u.searchParams.get('adurl');
      if (inner && /^https?:/.test(inner)) return new URL(inner).hostname.replace(/^www\./, '');
      return '';
    }
    return u.hostname.replace(/^www\./, '');
  } catch (e) {
    return '';
  }
}

const MARKETPLACES = /(^|\.)(ebay|amazon|walmart|etsy|aliexpress|temu|wish|target|newegg|mercari|poshmark|bonanza)\./;

function marketplaceOf(domain, store) {
  if (!MARKETPLACES.test(`${domain}.`)) return { isMarketplace: 0, seller: '' };
  const m = String(store || '').match(/^[^-–]+[-–]\s*(.+)$/);
  return { isMarketplace: 1, seller: m ? m[1].trim() : '' };
}

function priceFlag(price, target) {
  if (!price || !target) return '';
  const r = price / target;
  if (r > 1.8) return `high x${r.toFixed(2)}`;
  if (r < 0.55) return `low x${r.toFixed(2)}`;
  return '';
}

function writeOutputs(targets) {
  const matches = [];
  const offers = [];
  const summary = [];
  const specRows = [];
  const specsDone = new Set();
  const domains = new Map();
  for (const t of targets) {
    const f = path.join(OUT, 'targets', `${safeId(t.id)}.json`);
    if (!fs.existsSync(f)) continue;
    const r = JSON.parse(fs.readFileSync(f, 'utf8'));
    const matchId = (c) => `${t.id}-${c.catalogid || c.gpcid || `card${c.idx}`}`;
    for (const m of r.cards || []) {
      matches.push({
        match_id: m.matched ? matchId(m) : '',
        target_id: t.id,
        target_name: t.name,
        target_mpn: t.mpn,
        target_price: t.price,
        status: r.status,
        card_idx: m.idx,
        catalogid: m.catalogid,
        gpcid: m.gpcid,
        card_title: m.title,
        card_price: m.price,
        card_old_price: m.oldPrice || '',
        card_store: m.store,
        score: m.score,
        matched: m.matched ? 1 : 0,
        why: m.why || '',
        reasons: m.reasons.join('; '),
        image: m.imageFile || '',
      });
    }
    // sellers, deduped per target by domain (first seen = from the strongest match)
    const seen = new Set();
    let nOffers = 0;
    for (const p of r.panels || []) {
      const card = (r.cards || []).find((c) => c.idx === p.cardIdx) || {};
      for (const o of p.offers || []) {
        const url = o.shopUrl || o.direct || o.url;
        const domain = domainOf(url);
        const key = domain || o.store;
        if (seen.has(key)) continue;
        seen.add(key);
        nOffers += 1;
        const specs = cleanSpecs(p.specs);
        const sc = specColumns(specs);
        const g = extractIds(t, { specs, titles: [o.title, card.title].filter(Boolean) });
        if (!specsDone.has(matchId(card))) {
          specsDone.add(matchId(card));
          for (const [k, v] of Object.entries(specs)) specRows.push({ match_id: matchId(card), target_id: t.id, catalogid: card.catalogid || '', key: k, value: v });
        }
        // confirmed match → target identifiers apply; Google-seen values win when present
        const mpn = g.mpn || t.mpn;
        const gtin = g.gtin || t.gtin;
        const ean = gtin.length === 13 ? gtin : gtin.length === 12 ? `0${gtin}` : '';
        const src = [g.mpn ? 'mpn:google' : t.mpn ? 'mpn:input' : '', g.gtin ? 'gtin:google' : t.gtin ? 'gtin:input' : ''].filter(Boolean).join('; ');
        const mk = marketplaceOf(domain, o.store);
        offers.push({
          offer_id: `${matchId(card)}-${domain || o.store.replace(/\W+/g, '').toLowerCase()}`,
          match_id: matchId(card),
          target_id: t.id,
          target_name: t.name,
          target_price: t.price,
          catalogid: card.catalogid || '',
          gpcid: card.gpcid || '',
          match_why: card.why || '',
          match_score: p.score,
          product_title: card.title || p.title,
          store: o.store,
          domain,
          is_marketplace: mk.isMarketplace,
          seller: mk.seller,
          price: o.price,
          old_price: o.oldPrice || '',
          price_flag: priceFlag(o.price, t.price),
          offer_title: o.title,
          stock: o.stock,
          brand: specs.Brand || t.brand,
          mpn,
          gtin,
          ean,
          id_source: src,
          ...sc,
          specs_json: Object.keys(specs).length ? JSON.stringify(specs) : '',
          image_url: p.imageUrl || '',
          image_file: p.imageFile || '',
          url,
          url_resolved: /google\./.test(url) ? 0 : 1,
        });
        if (domain && !mk.isMarketplace && !domains.has(domain)) {
          domains.set(domain, { domain, store: o.store, sample_url: url, sample_title: o.title || card.title, sample_price: o.price, mpn, gtin, target_id: t.id });
        }
      }
    }
    const near = (r.cards || []).filter((c) => !c.matched).slice(0, 3);
    summary.push({
      target_id: t.id,
      target_name: t.name,
      brand: t.brand,
      mpn: t.mpn,
      price: t.price,
      status: r.status,
      query: r.query || '',
      cards_seen: (r.cards || []).length,
      matched_cards: (r.cards || []).filter((c) => c.matched).length,
      offers: nOffers,
      near_misses: near.map((c) => `[${c.score}] ${c.title.slice(0, 60)} $${c.price} — ${c.why || c.reasons.slice(-2).join(', ')}`).join(' | '),
    });
  }
  writeCsv(path.join(OUT, 'matches.csv'), ['match_id', 'target_id', 'target_name', 'target_mpn', 'target_price', 'status', 'card_idx', 'catalogid', 'gpcid', 'card_title', 'card_price', 'card_old_price', 'card_store', 'score', 'matched', 'why', 'reasons', 'image'], matches);
  writeCsv(path.join(OUT, 'offers.csv'), ['offer_id', 'match_id', 'target_id', 'target_name', 'target_price', 'catalogid', 'gpcid', 'match_why', 'match_score', 'product_title', 'store', 'domain', 'is_marketplace', 'seller', 'price', 'old_price', 'price_flag', 'offer_title', 'stock', 'brand', 'mpn', 'gtin', 'ean', 'id_source', ...SPEC_COLUMNS, 'specs_json', 'image_url', 'image_file', 'url', 'url_resolved'], offers);
  writeCsv(path.join(OUT, 'specs.csv'), ['match_id', 'target_id', 'catalogid', 'key', 'value'], specRows);
  writeCsv(path.join(OUT, 'summary.csv'), ['target_id', 'target_name', 'brand', 'mpn', 'price', 'status', 'query', 'cards_seen', 'matched_cards', 'offers', 'near_misses'], summary);
  writeCsv(path.join(OUT, 'domains.csv'), ['domain', 'store', 'sample_url', 'sample_title', 'sample_price', 'mpn', 'gtin', 'target_id'], [...domains.values()]);
  return { matches: matches.length, offers: offers.length, domains: domains.size };
}

const safeId = (id) => String(id).replace(/[^\w.-]+/g, '_');

// ---------- browser ----------

let browser = null;
let page = null;

async function openBrowser() {
  if (browser) await browser.close().catch(() => {});
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME || detectChrome(),
    headless: HEADLESS,
    userDataDir: PROFILE,
    defaultViewport: null,
    args: ['--window-size=1440,1000', '--window-position=60,60', '--lang=en-US', '--no-first-run', '--no-default-browser-check'],
  });
  page = (await browser.pages())[0] || (await browser.newPage());
  log(`chrome ready (profile ${PROFILE})`);
}

const BROWSER_DEAD = /Target closed|Session closed|Protocol error|detached Frame|Connection closed|browser has disconnected/i;

// ---------- one target ----------

async function refImageFor(t) {
  if (!t.imageUrl) return null;
  try {
    const res = await fetch(t.imageUrl, { signal: AbortSignal.timeout(15000) });
    return Buffer.from(await res.arrayBuffer()).toString('base64');
  } catch (e) {
    log(`t${t.id} image_url failed: ${e.message}`);
    return null;
  }
}

/** google.com/goto?url=… → shop URL (one 302, read Location); tracking params dropped. */
async function resolveShopUrl(url) {
  let u = url;
  try {
    if (/google\.[a-z.]+\/(goto|url|aclk)/.test(u)) {
      for (let i = 0; i < 3; i += 1) {
        const res = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(10000) }).catch(() => null);
        const loc = res && res.headers.get('location');
        if (loc) {
          u = new URL(loc, u).href;
          break;
        }
        await delay(1000 * (i + 1));
      }
    }
    const clean = new URL(u);
    for (const k of [...clean.searchParams.keys()]) {
      if (/^(utm_|srsltid$|gclid$|gad_source$|x429$)/.test(k)) clean.searchParams.delete(k);
    }
    return clean.href;
  } catch (e) {
    return url;
  }
}

/** Search queries to try in order: code first, then words (Google may not index the code). */
function queriesFor(t) {
  const name = t.name.replace(/\s*-\s*(Size|Pack Of|HP|Voltage)\b.*$/i, '').replace(/["']/g, ' ').trim();
  const qs = [];
  if (t.mpn) qs.push(`${t.brand} ${t.mpn}`.trim());
  qs.push(`${t.brand} ${name}`.trim());
  return [...new Set(qs)];
}

async function processTarget(t) {
  const refImage = await refImageFor(t);
  let query = '';
  let cards = [];
  let match = null;
  for (const q of queriesFor(t)) {
    query = q;
    log(`  search "${q}"`);
    await google.openSearch(page, q, log);
    cards = await google.readCards(page);
    if (!cards.length) continue;
    match = await matchCards(t, cards, { refImage, useImages: USE_IMAGES, log });
    if (match.scored.some((s) => s.matched)) break;
    await google.jitter(1000, 2000);
  }
  if (!match) return { status: 'no_results', query, cards: [], panels: [] };
  const { scored, refFrom } = match;
  const imgDir = path.join(OUT, 'images');
  fs.mkdirSync(imgDir, { recursive: true });
  const cardRows = scored.map((s) => {
    let imageFile = '';
    if (s.matched && s.card.imageB64) {
      imageFile = path.join('images', `${safeId(t.id)}-${s.card.catalogid || `card${s.card.idx}`}.jpg`);
      fs.writeFileSync(path.join(OUT, imageFile), Buffer.from(s.card.imageB64, 'base64'));
    }
    const { imageB64, lines, ...card } = s.card;
    return { ...card, score: s.score, matched: s.matched, why: s.why, gates: s.gates, reasons: s.reasons, imageFile };
  });
  const matched = cardRows.filter((c) => c.matched).slice(0, MAX_MATCHES);
  log(`  ${cards.length} cards on the page, ${matched.length} matched (reference image: ${refFrom || 'none'})`);

  const panels = [];
  for (const c of matched) {
    const before = new Set(await browser.pages());
    const searchUrl = page.url();
    let opened = await google.openCard(page, c.idx);
    if (!opened) {
      await google.closePanel(page);
      await google.jitter(800, 1500);
      opened = await google.openCard(page, c.idx);
    }
    if (!opened) {
      // Some single-shop cards open the shop itself instead of a panel.
      const opened = (await browser.pages()).find((p) => !before.has(p));
      let shopUrl = '';
      if (opened) {
        await delay(1500);
        shopUrl = opened.url();
        await opened.close().catch(() => {});
      } else if (!/google\./.test(new URL(page.url()).hostname)) {
        shopUrl = page.url();
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
      }
      if (shopUrl && /^https?:/.test(shopUrl)) {
        panels.push({ cardIdx: c.idx, score: c.score, imageFile: c.imageFile, title: c.title, specs: {}, image: '', offers: [{ store: c.store, price: c.price, oldPrice: c.oldPrice, title: c.title, stock: '', url: shopUrl, shopUrl: await resolveShopUrl(shopUrl) }] });
        log(`  card ${c.idx}: opened the shop directly → ${shopUrl.slice(0, 80)}`);
      } else {
        log(`  card ${c.idx}: panel did not open`);
      }
      continue;
    }
    const panel = await google.readPanel(page);
    if (!panel || !panel.offers.length) log(`  card ${c.idx}: panel opened but no sellers read`);
    if (panel) {
      for (const o of panel.offers) o.shopUrl = await resolveShopUrl(o.direct || o.url);
      panels.push({ cardIdx: c.idx, score: c.score, imageFile: c.imageFile, ...panel });
      log(`  card ${c.idx}: panel read, ${panel.offers.length} seller(s)`);
    }
    await google.closePanel(page);
    await google.jitter(800, 1800);
  }
  return { status: matched.length ? 'ok' : 'no_match', query, cards: cardRows, panels };
}

// ---------- product log ----------

const money = (v) => (v || v === 0 ? `$${v}` : '-');

/** Readable block per product: matches, near-misses, every extracted seller. */
function logProduct(t, r, seconds, seenDomains) {
  const matched = r.cards.filter((c) => c.matched);
  const sellers = [];
  const seen = new Set();
  for (const p of r.panels) {
    for (const o of p.offers) {
      const domain = domainOf(o.shopUrl || o.direct || o.url);
      if (seen.has(domain || o.store)) continue;
      seen.add(domain || o.store);
      sellers.push({ ...o, domain });
    }
  }
  const newSites = sellers.filter((o) => o.domain && !seenDomains.has(o.domain));
  for (const o of sellers) if (o.domain) seenDomains.add(o.domain);
  const markets = sellers.filter((o) => marketplaceOf(o.domain, o.store).isMarketplace).length;
  const flagged = sellers.filter((o) => priceFlag(o.price, t.price)).length;

  log(`  RESULT ${r.status.toUpperCase()} in ${Math.round(seconds)}s · ${matched.length} matched card(s) · ${sellers.length} seller(s) on ${new Set(sellers.map((o) => o.domain).filter(Boolean)).size} website(s) (${newSites.length} new) · ${markets} marketplace · ${flagged} price-flagged`);
  for (const c of matched) {
    log(`  ✓ MATCH [${c.why}] ${c.title.slice(0, 70)} · ${money(c.price)} · ${c.store.slice(0, 30)}${c.catalogid ? ` · catalogid ${c.catalogid}` : ''}`);
  }
  if (!matched.length) {
    for (const c of r.cards.slice(0, 3)) log(`  ✗ near-miss [${c.score}] ${c.title.slice(0, 60)} · ${money(c.price)} — ${c.why || c.reasons.slice(-2).join(', ')}`);
  }
  const p0 = r.panels[0];
  if (p0) {
    const specs = cleanSpecs(p0.specs);
    const ids = extractIds(t, { specs, titles: [p0.title, matched[0] && matched[0].title].filter(Boolean) });
    const sc = specColumns(specs);
    const facts = [
      `brand ${specs.Brand || t.brand || '-'}`,
      `mpn ${ids.mpn || t.mpn || '-'}`,
      `gtin ${ids.gtin || t.gtin || '-'}`,
      ...Object.entries(sc).filter(([, v]) => v).slice(0, 5).map(([k, v]) => `${k} ${String(v).slice(0, 30)}`),
    ];
    log(`  PRODUCT ${(matched[0] ? matched[0].title : p0.title).slice(0, 80)} · ${facts.join(' · ')}`);
  }
  for (const o of sellers) {
    const flag = priceFlag(o.price, t.price);
    const mk = marketplaceOf(o.domain, o.store).isMarketplace ? ' [marketplace]' : '';
    log(`    • ${o.store.slice(0, 28).padEnd(28)} ${money(o.price).padStart(10)}${o.oldPrice ? ` (was ${money(o.oldPrice)})` : ''} ${o.domain || '?'} · ${o.stock}${mk}${flag ? ` ⚠ ${flag}` : ''}`);
  }
  stats.addProduct({ id: t.id, mpn: t.mpn, name: t.name, status: r.status, seconds: Math.round(seconds), cards: r.cards.length, matched: matched.length, sellers: sellers.length, domains: sellers.map((o) => o.domain).filter(Boolean), query: r.query });
}

// ---------- main ----------

async function main() {
  fs.mkdirSync(path.join(OUT, 'targets'), { recursive: true });
  const targets = loadTargets();
  const doneFile = (t) => path.join(OUT, 'targets', `${safeId(t.id)}.json`);
  const status = () => ({ total: targets.length, progress: targets.filter((t) => fs.existsSync(doneFile(t))).length });

  if (process.env.PORT) {
    http
      .createServer((req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(status()));
      })
      .listen(parseInt(process.env.PORT, 10), '127.0.0.1');
  }

  if (process.env.EXPORT_ONLY === '1') {
    const c = writeOutputs(targets);
    log(`export only: ${c.matches} card rows, ${c.offers} offers, ${c.domains} domains → ${OUT}`);
    return;
  }
  const blockedIds = new Set();
  log(`${targets.length} target(s), ${status().progress} already done, input ${path.basename(INPUT)}`);
  const seenDomains = new Set();
  let n = 0;
  await openBrowser();

  for (const t of targets) {
    if (fs.existsSync(doneFile(t))) continue;
    n += 1;
    log(`── [${status().progress + 1}/${targets.length}] ${t.brand} ${t.mpn} · ${t.name.slice(0, 70)} · ${money(t.price)}`);
    const t0 = Date.now();
    let result = null;
    for (let attempt = 1; attempt <= 3 && !result; attempt += 1) {
      try {
        result = await processTarget(t);
      } catch (e) {
        if (e.blocked) {
          log(`  BLOCKED (attempt ${attempt}/3) — waiting ${BLOCK_WAIT_MS / 1000}s`);
          shell.report('blocked', { line: `google-shopping-2 t${t.id} blocked without captcha` });
          await delay(BLOCK_WAIT_MS);
        } else if (BROWSER_DEAD.test(e.message)) {
          log(`  browser error (${e.message.slice(0, 60)}) — reopening Chrome`);
          await openBrowser();
        } else {
          log(`  ERROR ${e.message}`);
          result = { status: 'error', error: e.message, cards: [], panels: [] };
        }
      }
    }
    if (!result) {
      // not saved as done: the next run (after a VPN change) retries it
      blockedIds.add(t.id);
      log(`  RESULT BLOCKED — not saved, will retry on the next run`);
      stats.addProduct({ id: t.id, mpn: t.mpn, name: t.name, status: 'blocked', seconds: Math.round((Date.now() - t0) / 1000), cards: 0, matched: 0, sellers: 0, domains: [] });
      continue;
    }
    fs.writeFileSync(doneFile(t), JSON.stringify({ target: t, at: new Date().toISOString(), ...result }, null, 1));
    logProduct(t, result, (Date.now() - t0) / 1000, seenDomains);
    if (n % 5 === 0) stats.printTotals(log, targets.length - (status().progress - n));
    await google.jitter(1000, 3000);
  }

  const counts = writeOutputs(targets);
  stats.printTotals(log, n, 'FINAL (this run)');
  stats.writeReport(path.join(OUT, 'run_report.json'), n);
  log(`files: ${counts.offers} sellers in offers.csv, ${counts.domains} shop domains in domains.csv, report out/run_report.json → ${OUT}`);
  if (blockedIds.size) log(`${blockedIds.size} target(s) blocked and not saved — run again to retry: ${[...blockedIds].join(', ')}`);
  await browser.close().catch(() => {});
  process.exit(status().progress ? 0 : 1);
}

process.on('SIGTERM', async () => {
  log('SIGTERM — closing chrome');
  try {
    writeOutputs(loadTargets());
  } catch (e) {}
  if (browser) await browser.close().catch(() => {});
  process.exit(143);
});

main().catch(async (e) => {
  console.error(e);
  if (browser) await browser.close().catch(() => {});
  process.exit(1);
});
