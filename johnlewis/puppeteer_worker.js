/**
 * Puppeteer worker — www.johnlewis.com
 *
 * One Chrome-for-Testing window with THREADS tabs. The supervisor starts two
 * of these (separate profiles) so a run is 2 windows × 10 tabs.
 *
 * Anti-block (same layout as rsonline / ghedirect / bueromarkt):
 *   - pauses between navigations
 *   - homepage warmup so Akamai sensor cookies exist before a PDP
 *   - location.assign from the homepage (same-origin referrer)
 *   - wipe profile + new ProxyRack port on block (or back off on VPN)
 *   - hCaptcha "I am human" + tile solver
 *   - Cloudflare Turnstile "Verify you are human"
 *
 * Env:
 *   THREADS=10  WINDOWS=2  DELAY_MS=800
 *   USE_PROXY=0   (VPN — default)
 *   HEADLESS=0  HIDE_CHROME=1
 */
const puppeteer = require('puppeteer-core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile, execSync } = require('child_process');
const { parseJohnLewisHtml, looksLikeBlocked, prepareUrl, productIdFromUrl } = require('./parse');
const { solveTurnstileIfPresent, pageLooksChallenged } = require('./turnstile');
const {
  solveHcaptcha,
  pageLooksLikeHcaptcha,
  isCaptchaSolving,
  CAPTCHA_GIVE_UP_MS,
} = require('./hcaptcha_solver');

const SERVER_BASE = process.env.SERVER || 'http://127.0.0.1:5056';
const WINDOW_INDEX = parseInt(process.env.WINDOW_INDEX || '0', 10);
const THREADS = parseInt(process.env.THREADS || '10', 10);
const DELAY_MS = parseInt(process.env.DELAY_MS || '800', 10);
const PROXY_USER = process.env.PROXY_USER || 'competitormonitor-country-uk';
const PROXY_PASS = process.env.PROXY_PASS || '';
const PROXY_HOST = process.env.PROXY_HOST || 'private.residential.proxyrack.net';
const PROXY_COUNT = parseInt(process.env.PROXY_COUNT || '200', 10);
const USE_PROXY = !['0', 'false', 'no', 'off'].includes(
  String(process.env.USE_PROXY == null ? '0' : process.env.USE_PROXY).toLowerCase()
);
const HOME_URL = process.env.HOME_URL || 'https://www.johnlewis.com/';
if (USE_PROXY && !PROXY_PASS) {
  console.error('PROXY_PASS is not set — add it to .env, or set USE_PROXY=0 to crawl on VPN');
  process.exit(1);
}
const HEADLESS = !['0', 'false', 'no'].includes(
  String(process.env.HEADLESS == null ? '0' : process.env.HEADLESS).toLowerCase()
);
const HIDE_CHROME = !HEADLESS && process.env.HIDE_CHROME !== '0';
const PP_TIMEOUT = parseInt(process.env.PP_TIMEOUT || '25000', 10);
const NAV_TIMEOUT_MS = parseInt(process.env.NAV_TIMEOUT_MS || '90000', 10);
const READY_TIMEOUT_MS = parseInt(process.env.READY_TIMEOUT_MS || '25000', 10);
const PROFILE = process.env.PROFILE || '/tmp/johnlewis-pp-profile-shared';
const ROTATE_COOLDOWN_MS = parseInt(process.env.ROTATE_COOLDOWN_MS || '12000', 10);

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

const BLOCK_TYPES = (process.env.BLOCK_TYPES !== undefined ? process.env.BLOCK_TYPES : '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function detectChrome() {
  if (process.env.CHROME && fs.existsSync(process.env.CHROME)) return process.env.CHROME;
  const mac =
    'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
  const candidates = [
    path.join(
      os.homedir(),
      'chrome-for-testing/chrome/mac_arm-132.0.6834.83/chrome-mac-arm64',
      mac
    ),
    path.join(os.homedir(), 'chrome-for-testing/chrome/mac-132.0.6834.83/chrome-mac-x64', mac),
    `/tmp/chrome-for-testing/chrome/mac_arm-132.0.6834.83/chrome-mac-arm64/${mac}`,
    path.join(os.homedir(), 'chrome-for-testing/chrome/linux-132.0.6834.83/chrome-linux64/chrome'),
    '/opt/chrome-for-testing/chrome',
  ];
  return candidates.find((c) => fs.existsSync(c)) || null;
}

const CHROME = detectChrome();
if (!CHROME) {
  console.error(
    'Chrome for Testing not found. Install with:\n  npx @puppeteer/browsers install chrome@132.0.6834.83 --path ~/chrome-for-testing'
  );
  process.exit(1);
}
const IS_CHROME_FOR_TESTING = /chrome for testing|chrome-for-testing/i.test(CHROME);

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
    [
      '-e',
      'tell application "System Events" to get name of first process whose frontmost is true',
    ],
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

async function bringWindowOnscreen(page) {
  try {
    const client = await page.createCDPSession();
    const { windowId } = await client.send('Browser.getWindowForTarget');
    await client.send('Browser.setWindowBounds', {
      windowId,
      bounds: { left: 80, top: 60, width: 1280, height: 900, windowPosition: 'normal' },
    });
  } catch (e) {}
}

let pauseFocusGuard = false;
if (HIDE_CHROME) {
  setInterval(() => {
    if (!pauseFocusGuard) focusTick();
  }, 400);
  console.log('Chrome focus-guard on (single window + tabs)');
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

async function saveResult(ind, products, links) {
  await axios.post(`${SERVER_BASE}/save/`, { ind, products, links }, { timeout: 30000 });
}

async function setupPage(page) {
  if (USE_PROXY) {
    await page.authenticate({ username: PROXY_USER, password: PROXY_PASS });
  }
  if (IS_CHROME_FOR_TESTING) {
    await page.setUserAgent(UA);
  }
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-GB,en;q=0.9' });
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

async function dismissCookieBanner(page) {
  try {
    await page.evaluate(() => {
      const selectors = [
        '#onetrust-accept-btn-handler',
        '#onetrust-reject-all-handler',
        'button[id*="onetrust-accept"]',
        'button[aria-label="Accept All Cookies"]',
        'button[data-testid="accept-cookies"]',
      ];
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) {
          el.click();
          return;
        }
      }
    });
  } catch (e) {}
}

async function maybeSolveCaptcha(page) {
  const html = await page.content().catch(() => '');
  const title = await page.title().catch(() => '');

  if (await pageLooksChallenged(page)) {
    pauseFocusGuard = true;
    await bringWindowOnscreen(page);
    try {
      await solveTurnstileIfPresent(page, {
        timeout: Math.max(PP_TIMEOUT, 60000),
        log: (m) => console.log(m),
        onBeforeClick: async () => {
          await bringWindowOnscreen(page);
        },
      });
    } catch (e) {
      console.log('turnstile solve error:', e.message || e);
    }
    pauseFocusGuard = false;
    if (HIDE_CHROME) {
      await pushWindowOffscreen(page);
      focusTick();
    }
  }

  if (pageLooksLikeHcaptcha(html, title) || /I am human/i.test(html + title)) {
    pauseFocusGuard = true;
    await bringWindowOnscreen(page);
    const captchaStarted = Date.now();
    let solved = await solveHcaptcha(page).catch((e) => {
      console.error('hcaptcha solve error:', e.message);
      return false;
    });
    while (!solved && Date.now() - captchaStarted < CAPTCHA_GIVE_UP_MS) {
      await delay(8000);
      solved = await solveHcaptcha(page).catch(() => false);
      const still = pageLooksLikeHcaptcha(
        await page.content().catch(() => ''),
        await page.title().catch(() => '')
      );
      if (!still) break;
    }
    pauseFocusGuard = false;
    if (HIDE_CHROME) {
      await pushWindowOffscreen(page);
      focusTick();
    }
    return solved;
  }
  return true;
}

async function ensureHomepage(page) {
  const here = page.url() || '';
  const html = await page.content().catch(() => '');
  const onJl = /johnlewis\.com/i.test(here) && !isChromeErrorUrl(here);
  if (onJl && html.length > 20000 && !looksLikeBlocked(html, here)) return;
  console.log(`window=${WINDOW_INDEX} opening homepage before page`);
  await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
  await delay(3000);
  await dismissCookieBanner(page);
  await maybeSolveCaptcha(page);
  await delay(1500);
}

async function warmupSession(page) {
  try {
    console.log(`window=${WINDOW_INDEX} warmup ${HOME_URL}`);
    await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    await delay(4000);
    await dismissCookieBanner(page);
    await maybeSolveCaptcha(page);
    await delay(1500);
    const html = await page.content().catch(() => '');
    if (looksLikeBlocked(html, page.url())) {
      throw new Error('warmup Access Denied');
    }
    console.log(`window=${WINDOW_INDEX} warmup ok html=${html.length}`);
  } catch (e) {
    throw new Error(`warmup failed: ${e.message}`);
  }
}

async function openLikeUser(page, pageUrl) {
  const target = prepareUrl(pageUrl, pageUrl) || pageUrl;
  if (/johnlewis\.com\/?(\?|$)/i.test(target) || target === HOME_URL) {
    await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    await delay(2500);
    await dismissCookieBanner(page);
    return;
  }

  await ensureHomepage(page);
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
  } catch (e) {
    /* timeout / chrome-error — referred goto below */
  }

  if (isChromeErrorUrl(page.url()) || !/johnlewis\.com/i.test(page.url() || '')) {
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

async function waitUntilReady(page, pageUrl, mode) {
  if (mode === 'home') {
    await delay(2000);
    return;
  }
  const wantPdp = mode === 'pdp' || !!productIdFromUrl(pageUrl);
  const wantBrands = mode === 'brands' || /\/brands\/?(\?|$)/.test(pageUrl);
  try {
    await page.waitForFunction(
      (pdp, brands) => {
        const html = document.documentElement ? document.documentElement.outerHTML : '';
        if (/Access Denied|You don't have permission to access|Pardon Our Interruption/i.test(html)) {
          return true;
        }
        const next = document.getElementById('__NEXT_DATA__');
        if (!next || !next.textContent) return false;
        if (pdp) return next.textContent.includes('"variants"') || next.textContent.includes('"product"');
        if (brands) return next.textContent.includes('"brands"');
        return (
          next.textContent.includes('productListingData') &&
          (next.textContent.includes('pagesAvailable') || next.textContent.includes('"products"'))
        );
      },
      { timeout: READY_TIMEOUT_MS, polling: 400 },
      wantPdp,
      wantBrands
    );
  } catch (e) {}
}

async function scrapeWithPage(page, pageUrl, mode) {
  focusTick();
  await openLikeUser(page, pageUrl);
  focusTick();
  await delay(2000);
  await dismissCookieBanner(page);
  await maybeSolveCaptcha(page);
  await waitUntilReady(page, pageUrl, mode);
  await delay(1500);
  focusTick();

  let html = '';
  try {
    html = await page.content();
  } catch (e) {
    await delay(3000);
    html = await page.content();
  }
  return { html, finalUrl: page.url() };
}

function extractResult(html, pageUrl, mode, finalUrl) {
  const url = finalUrl || pageUrl;
  if (looksLikeBlocked(html, url)) {
    return { blocked: true, products: [], links: [] };
  }
  const parsed = parseJohnLewisHtml(html, url, mode);
  return {
    blocked: false,
    products: parsed.products || [],
    links: parsed.links || [],
  };
}

async function main() {
  let proxyIdx = WINDOW_INDEX * Math.max(11, Math.floor(PROXY_COUNT / 2));
  let browser = null;
  let pages = [];
  let lastRotateAt = 0;
  let vpnPauseUntil = 0;
  let vpnRefreshAt = 0;
  let restartLock = Promise.resolve();

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
    if (isCaptchaSolving()) {
      console.log('openBrowser deferred — captcha solve in progress');
      while (isCaptchaSolving()) await delay(1000);
      if (browserAlive()) return;
    }
    const force = !!opts.force;
    const reason = opts.reason || (force ? 'fresh-session' : 'recover');

    return withRestartLock(async () => {
      if (!force && browserAlive()) return;
      const mustRotate = /blocked|captcha|warmup/i.test(reason);
      if (force && !mustRotate && browserAlive() && Date.now() - lastRotateAt < ROTATE_COOLDOWN_MS) {
        return;
      }

      await closeBrowser();
      proxyIdx += 1;
      const port = USE_PROXY ? proxyPort(proxyIdx) : null;

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
        '--lang=en-GB',
      ];
      if (!HEADLESS && HIDE_CHROME) args.push('--window-position=-4000,50');
      else args.push(`--window-position=${80 + WINDOW_INDEX * 640},80`);
      if (USE_PROXY) args.unshift(`--proxy-server=http://${PROXY_HOST}:${port}`);

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
      for (let i = 0; i < THREADS; i += 1) {
        const page = existing[i] || (await browser.newPage());
        await setupPage(page);
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
        await warmupSession(pages[0]);
      } catch (e) {
        console.error(`window=${WINDOW_INDEX} ${e.message}`);
      }
    });
  }

  await openBrowser({ force: true, reason: 'startup' });

  async function worker(slot) {
    let retries = 0;
    for (;;) {
      while (isCaptchaSolving()) await delay(1000);
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

      const pageUrl = task.data.url;
      const mode =
        task.data.mode ||
        (productIdFromUrl(pageUrl)
          ? 'pdp'
          : /\/brands\/?(\?|$)/.test(pageUrl)
            ? 'brands'
            : /\/brand\//.test(pageUrl)
              ? 'listing'
              : 'home');

      try {
        if (!browserAlive() || !pages[slot] || pages[slot].isClosed()) {
          await openBrowser();
        }
        const page = pages[slot];
        console.log(`t${slot} fetch ind=${task.ind} mode=${mode}`);
        const { html, finalUrl } = await scrapeWithPage(page, pageUrl, mode);
        const result = extractResult(html, pageUrl, mode, finalUrl);

        if (result.blocked) {
          retries += 1;
          if (USE_PROXY) {
            console.error(`t${slot} blocked ind=${task.ind} url=${finalUrl} -> new exit IP`);
            await openBrowser({ force: true, reason: `blocked-t${slot}-${task.ind}` });
            await delay(Math.min(8000, 1000 * retries));
          } else {
            const waitMs = noteVpnBlock(retries);
            console.error(
              `t${slot} blocked ind=${task.ind} html=${html.length} (VPN IP) — window pause ${Math.round(waitMs / 1000)}s`
            );
            if (Date.now() - vpnRefreshAt > 120000) {
              vpnRefreshAt = Date.now();
              await openBrowser({ force: true, reason: 'vpn-block' });
            }
            await waitVpnPause();
          }
          continue;
        }

        const { products, links } = result;
        const isPdp = mode === 'pdp' || !!productIdFromUrl(pageUrl);
        const isBrands = mode === 'brands';
        const isListing = mode === 'listing';

        if (isPdp && !products.length) {
          retries += 1;
          console.error(
            `t${slot} empty pdp ind=${task.ind} html=${html.length} url=${finalUrl}`
          );
          if (html.length < 20000) {
            if (USE_PROXY && retries % 3 === 0) {
              await openBrowser({ force: true, reason: `empty-t${slot}-${task.ind}` });
            } else {
              await delay(2000);
            }
            continue;
          }
          await saveResult(task.ind, [], []);
          console.log(`t${slot} saved ind=${task.ind} products=0 (no product on page)`);
          retries = 0;
          await delay(DELAY_MS);
          continue;
        }

        if ((isBrands || isListing) && !links.length && !products.length) {
          retries += 1;
          console.error(`t${slot} empty ${mode} ind=${task.ind} html=${html.length}`);
          if (retries < 3) {
            if (USE_PROXY && retries % 2 === 0) {
              await openBrowser({ force: true, reason: `empty-list-t${slot}` });
            }
            await delay(2000);
            continue;
          }
        }

        await saveResult(task.ind, products, links);
        console.log(
          `t${slot} saved ind=${task.ind} products=${products.length} links=${links.length}` +
            (products[0] ? ` sku=${products[0].sku} price=${products[0].price}` : '')
        );
        retries = 0;
        await delay(DELAY_MS + Math.random() * DELAY_MS);
      } catch (e) {
        const msg = e.message || '';
        console.error(`t${slot} scrape ind=${task.ind}:`, msg);
        retries += 1;

        if (/detached Frame|Target closed|Session closed|Protocol error/i.test(msg)) {
          await openBrowser();
          await delay(400);
          continue;
        }

        if (isHardError(msg)) {
          await openBrowser({ force: true, reason: `hard-t${slot}-${task.ind}` });
        }
        await delay(2500);
      }
    }
  }

  console.log(
    `Starting single-window ${THREADS}-tab workers -> ${SERVER_BASE} (headless=${HEADLESS}, proxy=${USE_PROXY ? 'uk' : 'off/VPN'}, hide=${HIDE_CHROME})`
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
