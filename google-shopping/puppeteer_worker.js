/**
 * Puppeteer worker — Google Shopping (US)
 *
 * Anti-block (same layout as johnlewis / rsonline / ghedirect):
 *   - Chrome for Testing 132, headed
 *   - pauses between navigations
 *   - Shopping homepage warmup, then location.assign (same-origin referrer)
 *   - wipe profile + new ProxyRack US port on block (or back off on VPN)
 *   - US locale headers; auto-switch to ProxyRack US if the VPN is not US
 *
 * Env:
 *   THREADS=1  WINDOWS=1  DELAY_MS=2500
 *   USE_PROXY=0   (US VPN — default)
 *   HEADLESS=0  HIDE_CHROME=1
 */
require('./env');
const puppeteer = require('puppeteer-core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execFile, execSync } = require('child_process');
const { detectChrome, isChromeForTesting, installHint } = require('./chrome');
const { forceUsShoppingUrl, buildCardUrl } = require('./card_url');
const { parseShoppingPage, looksLikeBlocked, looksLikeConsent, extractDomChunksFromPageFn } = require('./parse');
const { proveCard, competitorOffers, pickBestCard } = require('./proof');
const { resolveUsExit, confirmCountryInPage, isUnitedStates, envFlag } = require('./locale');
const { shoppingSearchUrl } = require('./query');
const { pageLooksLikeRecaptcha, solveRecaptchaIfPresent, isCaptchaSolving, setRecaptchaTilePicker } = require('./recaptcha');
const { createLlmTilePicker } = require('./llm_tile_picker');
const shell = require('./shell_client');

// Started by Scraper Shell 2 → its captcha service (model + human in the UI);
// standalone with LLM_CAPTCHA=1 → local model directly; else solution.json.
if (shell.enabled) setRecaptchaTilePicker(shell.recaptchaPicker);
else if (envFlag('LLM_CAPTCHA', false)) setRecaptchaTilePicker(createLlmTilePicker());

const SERVER_BASE = process.env.SERVER || 'http://127.0.0.1:5057';
const WINDOW_INDEX = parseInt(process.env.WINDOW_INDEX || '0', 10);
const THREADS = parseInt(process.env.THREADS || '1', 10);
const DELAY_MS = parseInt(process.env.DELAY_MS || '2500', 10);
const PROXY_COUNT = parseInt(process.env.PROXY_COUNT || '200', 10);
const HEADLESS = !['0', 'false', 'no'].includes(
  String(process.env.HEADLESS == null ? '0' : process.env.HEADLESS).toLowerCase()
);
const HIDE_CHROME = !HEADLESS && process.env.HIDE_CHROME !== '0';
const NAV_TIMEOUT_MS = parseInt(process.env.NAV_TIMEOUT_MS || '90000', 10);
const PROFILE = process.env.PROFILE || '/tmp/google-shopping-pp-profile-shared';
const ROTATE_COOLDOWN_MS = parseInt(process.env.ROTATE_COOLDOWN_MS || '12000', 10);
const HOME_URL = process.env.HOME_URL || 'https://www.google.com/shopping?gl=us&hl=en';
const SEARCH_CANDIDATES = parseInt(process.env.SEARCH_CANDIDATES || '5', 10);
const RAW_DIR = process.env.RAW_DIR || path.join(__dirname, 'data');

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

const BLOCK_TYPES = (process.env.BLOCK_TYPES !== undefined ? process.env.BLOCK_TYPES : '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const CLIENT_ALIASES = (process.env.CLIENT_MERCHANT_ALIASES || 'Drip Depot,DripDepot,dripdepot.com')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function asEscape(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

let preferredApp = 'Cursor';
function focusTick() {
  if (!HIDE_CHROME) return;
  execFile(
    'osascript',
    ['-e', 'tell application "System Events" to get name of first process whose frontmost is true'],
    { timeout: 2000 },
    (err, stdout) => {
      if (err) return;
      const name = String(stdout || '').trim();
      if (!name) return;
      if (/Chrome for Testing/i.test(name)) {
        const app = asEscape(preferredApp);
        execFile(
          'osascript',
          [
            '-e',
            `tell application "System Events"
              repeat with p in (every process whose name contains "Chrome for Testing")
                try
                  set frontmost of p to false
                end try
              end repeat
              try
                set frontmost of process "${app}" to true
              end try
            end tell`,
          ],
          { timeout: 3000 },
          () => {}
        );
      } else if (!/osascript|System Events|loginwindow/i.test(name)) {
        preferredApp = name;
      }
    }
  );
}

async function pushWindowOffscreen(page) {
  try {
    const client = await page.createCDPSession();
    const { windowId } = await client.send('Browser.getWindowForTarget');
    await client.send('Browser.setWindowBounds', {
      windowId,
      bounds: { left: -4000, top: 50, width: 1200, height: 800, windowPosition: 'normal' },
    });
  } catch (e) {}
}

let pauseFocusGuard = false;
if (HIDE_CHROME) {
  setInterval(() => {
    if (!pauseFocusGuard) focusTick();
  }, 400);
}

function proxyPort(i) {
  return 10000 + (i % PROXY_COUNT);
}

function isHardError(msg) {
  return /TARGET_CLOSED|Session closed|disconnected|detached Frame|ERR_TUNNEL|ERR_PROXY|ERR_CONNECTION|ERR_TIMED_OUT|ERR_NETWORK_CHANGED|Navigation timeout|net::/i.test(
    msg || ''
  );
}

function isChromeErrorUrl(url) {
  return /^chrome-error:/i.test(url || '') || /chromewebdata/i.test(url || '');
}

function clearSingletonLocks(dir) {
  for (const name of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
    try {
      fs.unlinkSync(path.join(dir, name));
    } catch (e) {}
  }
}

function suppressRestoreBubble(dir) {
  try {
    const prefsPath = path.join(dir, 'Default', 'Preferences');
    fs.mkdirSync(path.dirname(prefsPath), { recursive: true });
    let prefs = {};
    if (fs.existsSync(prefsPath)) {
      try {
        prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
      } catch (e) {
        prefs = {};
      }
    }
    prefs.profile = prefs.profile || {};
    prefs.profile.exit_type = 'Normal';
    prefs.profile.exited_cleanly = true;
    fs.writeFileSync(prefsPath, JSON.stringify(prefs));
  } catch (e) {}
}

function wipeProfile(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) {}
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {}
}

function killOrphanChromes() {
  try {
    execSync(`pkill -f 'user-data-dir=${PROFILE}' 2>/dev/null || true`, { stdio: 'ignore' });
  } catch (e) {}
}

async function fetchTask() {
  const res = await axios.get(`${SERVER_BASE}/get`, { timeout: 15000 });
  return res.data;
}

async function saveResult(ind, products, extra = {}) {
  await axios.post(`${SERVER_BASE}/save/`, { ind, products, ...extra }, { timeout: 30000 });
}

function clientFromTask(data) {
  return {
    product_name: data.product_name,
    title: data.product_name,
    brand: data.brand,
    mpn: data.mpn,
    gtin: data.gtin,
    productUrl: data.client_url || '',
    client_price_usd: data.client_price_usd,
    merchantAliases: CLIENT_ALIASES,
  };
}

function rowFromParse(task, parsed, extra = {}) {
  const client = clientFromTask(task);
  const card = {
    title: parsed.title,
    catalogid: parsed.catalogid || task.catalogid,
    gpcid: parsed.gpcid || task.gpcid,
    offers: parsed.offers || [],
  };
  const proof = extra.proof || proveCard(card, client);
  const competitors = competitorOffers(card, client);
  let status = extra.status;
  if (!status) {
    if (parsed.blocked) status = 'fetch_failed';
    else if (parsed.consent) status = 'fetch_failed';
    else if (!(parsed.offers || []).length) {
      status = extra.mode === 'search' && !(parsed.candidates || []).length ? 'no_candidates' : 'looked_empty';
    } else status = 'ok';
  }
  const catalogid = card.catalogid || '';
  const gpcid = card.gpcid || '';
  return {
    identifier: catalogid && gpcid ? `${catalogid}|${gpcid}` : task.product_name,
    product_name: task.product_name,
    brand: task.brand,
    mpn: task.mpn || '',
    gtin: task.gtin || '',
    client_price_usd: task.client_price_usd,
    catalogid,
    gpcid,
    card_url: extra.card_url || parsed.url || task.url,
    card_title: parsed.title || '',
    status,
    verdict_tier: proof.tier,
    proof_detail: proof.detail,
    offers_seen_in_browser: (parsed.offers || []).length,
    sellers_seen_by_api: task.sellers_seen_by_api == null ? '' : task.sellers_seen_by_api,
    offer_list_complete: parsed.offer_list_complete || 'unknown',
    competitor_count: status === 'ok' ? competitors.length : null,
    density: task.density || '',
    note: task.note || extra.note || '',
    offers: parsed.offers || [],
    candidates: parsed.candidates || extra.candidates || [],
    rival_card_ids: extra.rival_card_ids || [],
  };
}

async function setupPage(page, net) {
  if (net.useProxy) {
    await page.authenticate({ username: net.proxyUser, password: net.proxyPass });
  }
  if (isChromeForTesting(net.chrome || '')) {
    await page.setUserAgent(UA);
  }
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
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
}

function attachXhrCollector(page, bucket) {
  page.on('response', async (res) => {
    try {
      const u = res.url();
      const ct = res.headers()['content-type'] || '';
      if (res.status() !== 200) return;
      if (!/json|javascript|text/i.test(ct) && !/async|batchexecute|Shopping/i.test(u)) return;
      const text = await res.text();
      if (text.length > 1_500_000) return;
      if (!/catalogid|gpcid|"price"|merchant|offer/i.test(text)) return;
      bucket.push(text);
    } catch (e) {}
  });
}

async function dismissConsent(page) {
  try {
    return await page.evaluate(() => {
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
  } catch (e) {
    return null;
  }
}

async function expandOfferList(page) {
  try {
    const clicked = await page.evaluate(() => {
      const re = /compare prices|more stores|more sellers|view more stores|show more stores/i;
      const nodes = [...document.querySelectorAll('button, a, [role="button"]')];
      for (const el of nodes) {
        const t = `${el.innerText || ''} ${el.getAttribute('aria-label') || ''}`.replace(/\s+/g, ' ');
        if (re.test(t) && t.length < 90) {
          el.click();
          return t.trim().slice(0, 80);
        }
      }
      return null;
    });
    if (clicked) {
      console.log(`expanded offers via: ${clicked}`);
      await delay(3500);
    }
    await page.evaluate(() => window.scrollBy(0, 800));
    await delay(800);
  } catch (e) {}
}

async function warmupSession(page) {
  console.log(`window=${WINDOW_INDEX} warmup ${HOME_URL}`);
  await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
  await delay(3500);
  await dismissConsent(page);
  await delay(1200);
  const html = await page.content().catch(() => '');
  if (looksLikeBlocked(html, page.url())) throw new Error('warmup blocked');
  console.log(`window=${WINDOW_INDEX} warmup ok html=${html.length}`);
}

async function openLikeUser(page, pageUrl) {
  const target = forceUsShoppingUrl(pageUrl);
  const here = page.url() || '';
  if (!/google\./i.test(here) || isChromeErrorUrl(here) || looksLikeConsent(await page.content().catch(() => ''), here)) {
    await warmupSession(page);
  }
  try {
    await page.mouse.move(180 + Math.random() * 60, 240 + Math.random() * 40);
    await delay(300);
  } catch (e) {}
  try {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS }),
      page.evaluate((url) => {
        window.location.assign(url);
      }, target),
    ]);
  } catch (e) {}
  if (isChromeErrorUrl(page.url()) || !/google\./i.test(page.url() || '')) {
    await page.goto(target, {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT_MS,
      referer: HOME_URL,
    });
  }
  if (isChromeErrorUrl(page.url())) {
    throw new Error(`ERR_TUNNEL nav chrome-error (${pageUrl})`);
  }
}

/**
 * A solved captcha redirects /sorry/ → the target. Reading the page too early
 * saw /sorry/ and wiped the profile although the captcha was fine. Wait for the
 * redirect; if the page still looks blocked, open the target once more.
 */
async function settleAfterCaptcha(page, pageUrl) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline && /\/sorry\//i.test(page.url())) await delay(500);
  await delay(2000);
  const html = await page.content().catch(() => '');
  if (!looksLikeBlocked(html, page.url())) return;
  console.log('captcha solved but page still looks blocked — reopening target once');
  await openLikeUser(page, pageUrl);
  await delay(2500);
  await dismissConsent(page);
}

async function scrapeUrl(page, pageUrl, xhrBucket, extra = {}) {
  xhrBucket.length = 0;
  focusTick();
  await openLikeUser(page, pageUrl);
  await delay(2500);
  await dismissConsent(page);
  // Solved captcha → keep scraping in the same Chrome. Google may chain a
  // second captcha; solve that too. Only a block with no captcha to solve
  // (or an unsolved one) goes to the blocked/refresh path.
  for (let attempt = 1; attempt <= 3 && (await pageLooksLikeRecaptcha(page)); attempt += 1) {
    pauseFocusGuard = true;
    let ok = false;
    try {
      ok = await solveRecaptchaIfPresent(page, { tab: extra.tab });
      if (ok) await settleAfterCaptcha(page, pageUrl);
    } finally {
      pauseFocusGuard = false;
    }
    if (!ok) break;
    if (attempt > 1) console.log(`captcha #${attempt} solved on this page — continuing`);
    await delay(1500);
  }
  if (looksLikeBlocked(await page.content().catch(() => ''), page.url())) {
    throw Object.assign(new Error('blocked'), { blocked: true });
  }
  await expandOfferList(page);
  await delay(1500);
  let html = '';
  try {
    html = await page.content();
  } catch (e) {
    await delay(2000);
    html = await page.content();
  }
  const parsed = parseShoppingPage({
    html,
    url: page.url() || pageUrl,
    xhrBodies: xhrBucket.slice(),
    title: await page.title().catch(() => ''),
    chunks: await page.evaluate(extractDomChunksFromPageFn()).catch(() => []),
  });
  return { html, parsed, finalUrl: page.url() };
}

function persistRaw(ind, html) {
  try {
    fs.mkdirSync(RAW_DIR, { recursive: true });
    fs.writeFileSync(path.join(RAW_DIR, `${ind}.html`), html || '');
  } catch (e) {}
}

async function scrapeCardTask(page, task, xhrBucket, extra = {}) {
  const { html, parsed } = await scrapeUrl(page, task.url, xhrBucket, extra);
  persistRaw('tmp-card', html);
  return { html, parsed };
}

async function scrapeSearchTask(page, task, xhrBucket, extra = {}) {
  const searchUrl = task.search_url || shoppingSearchUrl(task.search_query || task.product_name);
  const { html, parsed } = await scrapeUrl(page, searchUrl, xhrBucket, extra);
  persistRaw('tmp-serp', html);
  if (parsed.blocked) return { html, parsed, cards: [] };
  const candidates = (parsed.candidates || []).slice(0, SEARCH_CANDIDATES);
  const cards = [];
  for (const cand of candidates) {
    const url =
      cand.url ||
      buildCardUrl({
        q: task.search_query || task.product_name,
        catalogid: cand.catalogid,
        gpcid: cand.gpcid,
      });
    const one = await scrapeUrl(page, url, xhrBucket, extra);
    cards.push({
      ...cand,
      title: one.parsed.title || cand.title,
      offers: one.parsed.offers || [],
      catalogid: one.parsed.catalogid || cand.catalogid,
      gpcid: one.parsed.gpcid || cand.gpcid,
      url: one.finalUrl,
    });
    await delay(DELAY_MS);
  }
  return { html, parsed, cards };
}

async function main() {
  const CHROME = detectChrome();
  if (!CHROME) {
    console.error(installHint());
    process.exit(1);
  }

  let net;
  try {
    net = await resolveUsExit({ port: proxyPort(WINDOW_INDEX * 17) });
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  net.chrome = CHROME;
  console.log(
    `locale=US via=${net.useProxy ? 'proxy' : 'vpn'} ip=${net.geo.ip} city=${net.geo.city} chrome=for-testing`
  );

  let USE_PROXY = net.useProxy;
  let proxyIdx = WINDOW_INDEX * Math.max(11, Math.floor(PROXY_COUNT / 2));
  if (USE_PROXY) proxyIdx = Math.floor((net.proxyPort - 10000) % PROXY_COUNT);
  let browser = null;
  let pages = [];
  let lastRotateAt = 0;
  let vpnPauseUntil = 0;
  let vpnRefreshAt = 0;
  let restartLock = Promise.resolve();
  const xhrBuckets = [];

  async function waitVpnPause() {
    if (USE_PROXY) return;
    while (Date.now() < vpnPauseUntil) {
      await delay(Math.min(4000, vpnPauseUntil - Date.now()));
    }
  }

  function noteVpnBlock(retries) {
    const waitMs = Math.min(180000, 60000 + retries * 15000);
    vpnPauseUntil = Math.max(vpnPauseUntil, Date.now() + waitMs);
    return Math.max(0, vpnPauseUntil - Date.now());
  }

  function withRestartLock(fn) {
    const run = restartLock.then(fn, fn);
    restartLock = run.catch(() => {});
    return run;
  }

  function browserAlive() {
    return (
      browser &&
      browser.connected &&
      pages.length === THREADS &&
      pages.every((p) => p && !p.isClosed())
    );
  }

  async function closeBrowser() {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
    browser = null;
    pages = [];
    killOrphanChromes();
    await delay(400);
  }

  async function openBrowser(opts = {}) {
    const force = !!opts.force;
    const reason = opts.reason || (force ? 'fresh-session' : 'recover');
    return withRestartLock(async () => {
      if (isCaptchaSolving() && !force) {
        console.log('openBrowser deferred — captcha solve in progress');
        return;
      }
      if (!force && browserAlive()) return;
      const mustRotate = /blocked|warmup|captcha/i.test(reason);
      if (force && !mustRotate && browserAlive() && Date.now() - lastRotateAt < ROTATE_COOLDOWN_MS) {
        return;
      }
      await closeBrowser();
      proxyIdx += 1;
      const port = USE_PROXY ? proxyPort(proxyIdx) : null;
      if (USE_PROXY) {
        net.proxyPort = port;
      }
      if (force && (USE_PROXY || /blocked|warmup|vpn/i.test(reason))) {
        wipeProfile(PROFILE);
        console.log(
          `fresh session window=${WINDOW_INDEX} reason=${reason} proxy=${USE_PROXY ? port : 'off'} (profile wiped)`
        );
      } else {
        fs.mkdirSync(PROFILE, { recursive: true });
        clearSingletonLocks(PROFILE);
        suppressRestoreBubble(PROFILE);
        console.log(
          `session window=${WINDOW_INDEX} reason=${reason} proxy=${USE_PROXY ? port : 'off'} chrome=for-testing`
        );
      }

      const args = [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        `--user-data-dir=${PROFILE}`,
        '--window-size=1280,800',
        '--lang=en-US',
      ];
      if (!HEADLESS && HIDE_CHROME) args.push('--window-position=-4000,50');
      else args.push(`--window-position=${80 + WINDOW_INDEX * 640},80`);
      if (USE_PROXY) args.unshift(`--proxy-server=http://${net.proxyHost}:${port}`);

      let lastErr = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          clearSingletonLocks(PROFILE);
          browser = await puppeteer.launch({
            executablePath: CHROME,
            headless: HEADLESS,
            ignoreDefaultArgs: ['--enable-automation'],
            handleSIGINT: false,
            handleSIGTERM: false,
            handleSIGHUP: false,
            protocolTimeout: 180000,
            args,
          });
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          console.error(`browser launch failed (${attempt}/3): ${e.message}`);
          clearSingletonLocks(PROFILE);
          await delay(1500 * attempt);
        }
      }
      if (lastErr) throw lastErr;

      const existing = await browser.pages();
      pages = [];
      xhrBuckets.length = 0;
      for (let i = 0; i < THREADS; i += 1) {
        const page = existing[i] || (await browser.newPage());
        await setupPage(page, net);
        const bucket = [];
        xhrBuckets[i] = bucket;
        attachXhrCollector(page, bucket);
        if (HIDE_CHROME && i === 0) await pushWindowOffscreen(page);
        pages.push(page);
      }
      for (let i = THREADS; i < existing.length; i += 1) {
        try {
          await existing[i].close();
        } catch (e) {}
      }
      lastRotateAt = Date.now();
      focusTick();
      console.log(
        `browser ready tabs=${pages.length} proxy=${USE_PROXY ? port : 'off (system/VPN)'} profile=${PROFILE}`
      );
      try {
        if (opts.reason === 'startup') {
          const geo = await confirmCountryInPage(pages[0]);
          console.log(`browser exit ${geo.country} ip=${geo.ip} city=${geo.city}`);
          if (!isUnitedStates(geo.country)) {
            if (envFlag('STRICT_US', true)) {
              throw new Error(`browser exit is ${geo.country}, need US`);
            }
            console.warn(`STRICT_US=0 — crawling on ${geo.country}; US fixture ids may not match`);
          }
        }
        await warmupSession(pages[0]);
      } catch (e) {
        console.error(`window=${WINDOW_INDEX} ${e.message}`);
        if (/need US/i.test(e.message)) throw e;
      }
    });
  }

  await openBrowser({ force: true, reason: 'startup' });

  async function worker(slot) {
    let retries = 0;
    for (;;) {
      await waitVpnPause();
      let task;
      try {
        task = await fetchTask();
        if (!task || task.ind === undefined) {
          await delay(3000);
          continue;
        }
      } catch (e) {
        console.error(`t${slot} get:`, e.message);
        await delay(4000);
        continue;
      }

      const data = task.data || {};
      const mode = data.mode || 'card';
      try {
        if (!browserAlive() || !pages[slot] || pages[slot].isClosed()) {
          await openBrowser();
        }
        const page = pages[slot];
        const xhrBucket = xhrBuckets[slot] || [];
        console.log(`t${slot} fetch ind=${task.ind} mode=${mode} ${data.product_name || data.url}`);

        let html = '';
        let parsed;
        let row;
        if (mode === 'search') {
          const result = await scrapeSearchTask(page, data, xhrBucket, { tab: slot });
          html = result.html;
          parsed = result.parsed;
          if (parsed.blocked) {
            throw Object.assign(new Error('blocked'), { blocked: true, html });
          }
          const ranked = pickBestCard(result.cards, clientFromTask(data));
          const best = ranked[0];
          if (!best) {
            row = rowFromParse(data, parsed, { mode: 'search', status: 'no_candidates' });
          } else {
            const rivals = ranked
              .slice(1)
              .filter((x) => (x.offers || 0) > (best.offers || 0) || x.competitors > best.competitors)
              .map((x) => ({
                catalogid: x.card.catalogid,
                gpcid: x.card.gpcid,
                offers: x.offers,
              }));
            row = rowFromParse(
              data,
              { ...parsed, ...best.card, offers: best.card.offers, catalogid: best.card.catalogid, gpcid: best.card.gpcid },
              {
                mode: 'search',
                proof: best.proof,
                card_url: best.card.url,
                candidates: result.cards,
                rival_card_ids: rivals,
                note:
                  best.competitors === 0 && rivals.length
                    ? 'quiet card; busier rival exists'
                    : data.note,
              }
            );
          }
        } else {
          const result = await scrapeCardTask(page, data, xhrBucket, { tab: slot });
          html = result.html;
          parsed = result.parsed;
          if (parsed.blocked) {
            throw Object.assign(new Error('blocked'), { blocked: true, html });
          }
          row = rowFromParse(data, parsed, { mode: 'card', card_url: parsed.url });
        }

        persistRaw(task.ind, html);
        await saveResult(task.ind, [row], { html });
        console.log(
          `t${slot} saved ind=${task.ind} status=${row.status} tier=${row.verdict_tier} offers=${row.offers_seen_in_browser}`
        );
        retries = 0;
        await delay(DELAY_MS + Math.random() * DELAY_MS);
      } catch (e) {
        const msg = e.message || '';
        console.error(`t${slot} scrape ind=${task.ind}:`, msg);
        retries += 1;
        if (e.blocked || looksLikeBlocked(e.html || '', '')) {
          if (USE_PROXY) {
            await openBrowser({ force: true, reason: `blocked-t${slot}-${task.ind}` });
            await delay(Math.min(8000, 1000 * retries));
          } else {
            const waitMs = noteVpnBlock(retries);
            console.error(`t${slot} blocked (VPN IP) — pause ${Math.round(waitMs / 1000)}s`);
            if (Date.now() - vpnRefreshAt > 120000) {
              vpnRefreshAt = Date.now();
              await openBrowser({ force: true, reason: 'vpn-block' });
            }
            await waitVpnPause();
          }
          continue;
        }
        if (/detached Frame|Target closed|Session closed|Protocol error/i.test(msg)) {
          await openBrowser();
          await delay(400);
          continue;
        }
        if (isHardError(msg)) {
          await openBrowser({ force: true, reason: `hard-t${slot}-${task.ind}` });
        }
        if (retries >= 3) {
          const failRow = rowFromParse(task.data || {}, { offers: [], blocked: true, url: (task.data || {}).url }, {
            status: 'fetch_failed',
            note: msg,
          });
          await saveResult(task.ind, [failRow]);
          retries = 0;
        }
        await delay(2500);
      }
    }
  }

  console.log(
    `Starting ${THREADS}-tab workers -> ${SERVER_BASE} (headless=${HEADLESS}, proxy=${USE_PROXY ? 'us' : 'off/VPN'}, hide=${HIDE_CHROME})`
  );

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
      console.log(`${signal} — closing chrome`);
      await closeBrowser();
      process.exit(0);
    });
  }

  await Promise.all(Array.from({ length: THREADS }, (_, i) => worker(i)));
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection:', err && err.message ? err.message : err);
});
