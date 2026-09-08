/**
 * Puppeteer worker — store.evertonfc.com (Fanatics / Akamai).
 *
 * ONE Chrome window only (one Dock icon). THREADS tabs share that window;
 * each URL uses page.goto() on its tab — never newPage() per URL (that steals focus).
 *
 * Env:
 *   THREADS=4
 *   DELAY_MS=400
 *   SERVER=http://127.0.0.1:5054
 *   USE_PROXY=0
 *   HEADLESS=0
 *   HIDE_CHROME=1
 *   PROXY_USER=competitormonitor-country-GB
 */
const puppeteer = require('puppeteer-core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execFile, execSync } = require('child_process');
const { parseEvertonHtml, looksLikeBlocked, prepareUrl } = require('./parse');

const SERVER_BASE = process.env.SERVER || 'http://127.0.0.1:5054';
const THREADS = parseInt(process.env.THREADS || '10', 10);
const DELAY_MS = parseInt(process.env.DELAY_MS || '400', 10);
const PROXY_USER = process.env.PROXY_USER || 'competitormonitor-country-GB';
const PROXY_PASS =
  process.env.PROXY_PASS || '';
const PROXY_HOST = process.env.PROXY_HOST || 'private.residential.proxyrack.net';
const PROXY_COUNT = parseInt(process.env.PROXY_COUNT || '200', 10);
const USE_PROXY = process.env.USE_PROXY !== '0';
// Without this the crawl would silently run unproxied or fail to authenticate.
if (USE_PROXY && !PROXY_PASS) {
  console.error('PROXY_PASS is not set — add it to .env, or set USE_PROXY=0 to crawl direct');
  process.exit(1);
}
const HEADLESS = !['0', 'false', 'no'].includes(
  String(process.env.HEADLESS == null ? '0' : process.env.HEADLESS).toLowerCase()
);
const HIDE_CHROME = !HEADLESS && process.env.HIDE_CHROME !== '0';
const PP_TIMEOUT = parseInt(process.env.PP_TIMEOUT || '25000', 10);
const PROFILE = process.env.PROFILE || '/tmp/everton-pp-profile-shared';
const ROTATE_COOLDOWN_MS = parseInt(process.env.ROTATE_COOLDOWN_MS || '12000', 10);
const CHROME =
  process.env.CHROME ||
  `${process.env.HOME}/chrome-for-testing/chrome/mac_arm-132.0.6834.83/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

const BLOCK_TYPES = (process.env.BLOCK_TYPES !== undefined ? process.env.BLOCK_TYPES : '')
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

if (HIDE_CHROME) {
  setInterval(focusTick, 400);
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
    execSync(`pkill -f 'user-data-dir=${PROFILE}' 2>/dev/null || true`, {
      stdio: 'ignore',
    });
  } catch (e) {}
}

async function fetchTask() {
  const res = await axios.get(`${SERVER_BASE}/get`, { timeout: 15000 });
  return res.data;
}

async function saveResult(ind, products, links) {
  await axios.post(
    `${SERVER_BASE}/save/`,
    { ind, products, links },
    { timeout: 30000 }
  );
}

async function setupPage(page) {
  if (USE_PROXY) {
    await page.authenticate({ username: PROXY_USER, password: PROXY_PASS });
  }
  await page.setUserAgent(UA);
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-GB,en;q=0.9',
  });
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

/**
 * Reuse existing tab — page.goto only. Never newPage/close (focus steal).
 */
async function scrapeWithPage(page, pageUrl) {
  const prepared = prepareUrl(pageUrl, pageUrl);
  focusTick();
  const response = await page.goto(prepared, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  focusTick();
  const status = response ? response.status() : 0;
  const finalUrl = page.url();

  try {
    await page.waitForSelector('.universal-header', { timeout: PP_TIMEOUT });
  } catch (e) {
    // Access Denied never shows the header.
  }

  await delay(500);
  focusTick();
  return { html: await page.content(), status, finalUrl };
}

function extractResult(html, pageUrl, mode, status, finalUrl) {
  const url = finalUrl || pageUrl;
  if (looksLikeBlocked(html, url, status)) {
    return { blocked: true, products: [], links: [] };
  }
  const parsed = parseEvertonHtml(html, url, mode);
  return {
    blocked: false,
    products: parsed.products || [],
    links: parsed.links || [],
  };
}

async function main() {
  const WINDOW_INDEX = parseInt(process.env.WINDOW_INDEX || '0', 10);
  let proxyIdx = WINDOW_INDEX * 17 + 1;
  let browser = null;
  let pages = [];
  let lastRotateAt = 0;
  let restartLock = Promise.resolve();

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

  async function closeBrowser({ killChrome = true } = {}) {
    if (browser) {
      try {
        if (killChrome) await browser.close();
        else browser.disconnect();
      } catch (e) {}
    }
    browser = null;
    pages = [];
    if (killChrome) {
      killOrphanChromes();
      await delay(400);
    }
  }

  async function openBrowser(opts = {}) {
    const force = !!opts.force;
    const reason = opts.reason || (force ? 'fresh-session' : 'recover');
    return withRestartLock(async () => {
      if (!force && browserAlive()) return { browser, pages };
      if (force && browserAlive() && Date.now() - lastRotateAt < ROTATE_COOLDOWN_MS) {
        return { browser, pages };
      }

      await closeBrowser();
      await delay(500);
      proxyIdx += 1;
      const port = USE_PROXY ? proxyPort(proxyIdx) : null;

      const shouldWipe = force && USE_PROXY;
      if (shouldWipe) {
        wipeProfile(PROFILE);
        console.log(`fresh sticky session reason=${reason} proxy=${port}`);
      } else {
        clearSingletonLocks(PROFILE);
        suppressRestoreBubble(PROFILE);
        fs.mkdirSync(PROFILE, { recursive: true });
        if (force) {
          console.log(
            `browser rotate reason=${reason} proxy=${USE_PROXY ? port : 'off'} profile kept`
          );
        }
      }
      await delay(400);

      const args = [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        `--user-data-dir=${PROFILE}`,
        '--window-size=1200,800',
      ];
      if (!HEADLESS && HIDE_CHROME) args.push('--window-position=-4000,50');
      if (USE_PROXY) args.unshift(`--proxy-server=http://${PROXY_HOST}:${port}`);

      let lastErr;
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
          console.error(`browser launch failed (${attempt}/3):`, e.message);
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
        `browser ready tabs=${pages.length} proxy=${USE_PROXY ? port : 'off'} profile=${PROFILE}`
      );
      return { browser, pages, port };
    });
  }

  await openBrowser({ force: true, reason: 'startup' });

  async function worker(slot) {
    let retries = 0;
    for (;;) {
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
      const mode = task.data.mode || (pageUrl.includes('/p-') ? 'pdp' : 'listing');

      try {
        if (!browserAlive() || !pages[slot] || pages[slot].isClosed()) {
          await openBrowser();
        }
        const page = pages[slot];
        console.log(`t${slot} fetch ind=${task.ind} mode=${mode}`);
        const { html, status, finalUrl } = await scrapeWithPage(page, pageUrl);
        const result = extractResult(html, pageUrl, mode, status, finalUrl);

        if (result.blocked) {
          retries += 1;
          const isPdp = mode === 'pdp' || pageUrl.includes('/p-');
          console.error(
            `t${slot} blocked ind=${task.ind} status=${status} url=${finalUrl}`
          );
          // Home/listing 403s must not hold the queue forever — skip and
          // keep going so product URLs can still run.
          if (!isPdp && retries >= 2) {
            await saveResult(task.ind, [], []);
            console.error(`t${slot} skipped blocked ${mode} ind=${task.ind}`);
            retries = 0;
            continue;
          }
          await openBrowser({ force: true, reason: `blocked-t${slot}-${task.ind}` });
          await delay(Math.min(8000, 1000 * retries));
          continue;
        }

        const { products, links } = result;
        const isPdp = mode === 'pdp' || pageUrl.includes('/p-');

        if (isPdp && !products.length) {
          retries += 1;
          console.error(
            `t${slot} empty pdp ind=${task.ind} html=${html.length} status=${status}`
          );
          if (status === 404 || retries >= 3) {
            await saveResult(task.ind, [], []);
            console.log(`t${slot} saved ind=${task.ind} products=0 (gone or empty)`);
            retries = 0;
            continue;
          }
          if (retries % 3 === 0) {
            await openBrowser({ force: true, reason: `empty-t${slot}-${task.ind}` });
          }
          await delay(2000);
          continue;
        }

        if (!isPdp && !links.length && !products.length) {
          retries += 1;
          console.error(`t${slot} empty listing ind=${task.ind} html=${html.length}`);
          if (retries < 3) {
            if (retries % 2 === 0) {
              await openBrowser({ force: true, reason: `empty-list-t${slot}` });
            }
            await delay(2000);
            continue;
          }
        }

        await saveResult(task.ind, products, links);
        console.log(
          `t${slot} saved ind=${task.ind} products=${products.length} links=${links.length}` +
            (products[0] ? ` price=${products[0].price}` : '')
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
    `Starting single-window ${THREADS}-tab workers -> ${SERVER_BASE} (headless=${HEADLESS}, proxy=${USE_PROXY ? 'GB' : 'off'}, hide=${HIDE_CHROME})`
  );
  await Promise.all(Array.from({ length: THREADS }, (_, i) => worker(i)));
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection:', err && err.message ? err.message : err);
});
