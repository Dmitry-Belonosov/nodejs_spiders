/**
 * Puppeteer worker — bueromarkt-ag.de
 *
 * ONE Chrome window only (one Dock icon). Multiple workers share that window
 * as separate tabs created once at start; each URL uses page.goto() on its tab.
 *
 * Earlier setup launched THREADS separate browsers (different user-data-dirs),
 * which created many "TEST" Dock icons and stole focus constantly.
 *
 * Env:
 *   THREADS=4              // tabs inside the single browser
 *   BLOCK_TYPES=
 *   DELAY_MS=400
 *   SERVER=http://127.0.0.1:5053
 *   USE_PROXY=0
 *   HEADLESS=0
 *   HIDE_CHROME=1
 *   FRESH_ON_EMPTY=1   // wipe profile + new ProxyRack sticky port on empty/captcha
 */
const puppeteer = require('puppeteer-core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execFile, execSync } = require('child_process');
const { parseBueromarktHtml, looksLikeCf } = require('./parse');
const {
  solveHcaptcha,
  pageLooksLikeHcaptcha,
  isCaptchaSolving,
  CAPTCHA_GIVE_UP_MS,
} = require('./hcaptcha_solver');

const SERVER_BASE = process.env.SERVER || 'http://127.0.0.1:5053';
const THREADS = parseInt(process.env.THREADS || '10', 10);
const DELAY_MS = parseInt(process.env.DELAY_MS || '400', 10);
const PROXY_USER = process.env.PROXY_USER || 'competitormonitor-country-de';
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
const FRESH_ON_EMPTY = process.env.FRESH_ON_EMPTY !== '0';
const HEADLESS = !['0', 'false', 'no'].includes(
  String(process.env.HEADLESS == null ? '0' : process.env.HEADLESS).toLowerCase()
);
const HIDE_CHROME = !HEADLESS && process.env.HIDE_CHROME !== '0';
const CHROME =
  process.env.CHROME ||
  `${process.env.HOME}/chrome-for-testing/chrome/mac_arm-132.0.6834.83/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const PROFILE = process.env.PROFILE || '/tmp/bueromarkt-pp-profile-shared';
const ROTATE_COOLDOWN_MS = parseInt(process.env.ROTATE_COOLDOWN_MS || '12000', 10);

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

function wipeProfile(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (e) {}
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {}
}

function clearSingletonLocks(dir) {
  for (const name of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
    try {
      fs.unlinkSync(path.join(dir, name));
    } catch (e) {}
  }
}

/** Avoid Chromium "Restore pages?" bubble that can block captcha clicks. */
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

async function fetchTask() {
  const res = await axios.get(`${SERVER_BASE}/get`, { timeout: 15000 });
  return res.data;
}

async function saveResult(ind, products, options) {
  await axios.post(
    `${SERVER_BASE}/save/`,
    { ind, products, options },
    { timeout: 30000 }
  );
}

async function setupPage(page) {
  if (USE_PROXY) {
    await page.authenticate({ username: PROXY_USER, password: PROXY_PASS });
  }
  await page.setUserAgent(UA);
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
    // Prefer a real click on the green AKZEPTIEREN button (exact label on this site).
    const clicked = await page.evaluate(() => {
      const texts = [
        /^akzeptieren$/i,
        /alle akzeptieren/i,
        /accept all/i,
        /zustimmen/i,
        /einverstanden/i,
      ];
      const nodes = Array.from(
        document.querySelectorAll('button, a, [role="button"], input[type="button"], .btn')
      );
      for (const el of nodes) {
        const label = `${el.textContent || ''} ${el.getAttribute('aria-label') || ''}`
          .replace(/\s+/g, ' ')
          .trim();
        if (!label) continue;
        if (texts.some((re) => re.test(label))) {
          el.click();
          return label;
        }
      }
      const sel = [
        '#accept-cookies',
        '.cookie-accept',
        '[data-testid="uc-accept-all-button"]',
        '#uc-btn-accept-banner',
        'button.cm-btn-success',
        'button.accept',
      ];
      for (const s of sel) {
        const el = document.querySelector(s);
        if (el) {
          el.click();
          return s;
        }
      }
      return '';
    });
    if (clicked) {
      console.log(`cookie banner dismissed via: ${clicked}`);
      await delay(800);
    }
  } catch (e) {}
}

async function scrapeWithPage(page, pageUrl) {
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  focusTick();
  await dismissCookieBanner(page);
  // Banner can appear slightly after first paint.
  await delay(500);
  await dismissCookieBanner(page);

  // Do NOT reload while Incapsula is solving — reload resets the challenge.
  try {
    await page.waitForFunction(
      () => {
        const html = (document.body && document.body.innerHTML) || '';
        const hasPrice = !!document.querySelector(
          'span.product_price.mainPrice, span[class*="mainPrice"]'
        );
        const cookieWall = /Datenschutzeinwilligung|Cookie-Einstellungen/i.test(html);
        const incapsula =
          html.includes('Incapsula_Resource') || html.includes('_Incapsula');
        const challenge =
          /just a moment|sicherheitsfrage|hcaptcha/i.test(document.title || '') ||
          !!document.querySelector('iframe[src*="hcaptcha"]');
        // Cookie wall: don't treat as ready — keep waiting while caller re-dismisses.
        if (cookieWall && !hasPrice) return false;
        return !challenge && !incapsula && (html.length > 5000 || hasPrice);
      },
      { timeout: 45000, polling: 1000 }
    );
  } catch (e) {
    await dismissCookieBanner(page);
    const preview = await page.content().catch(() => '');
    if (
      /Incapsula|_Incapsula|Just a moment|Sicherheitsfrage|hcaptcha/i.test(preview) ||
      preview.length < 2000
    ) {
      await delay(3000);
    } else if (/Datenschutzeinwilligung|Cookie-Einstellungen/i.test(preview)) {
      await dismissCookieBanner(page);
      await delay(1000);
    } else {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await dismissCookieBanner(page);
      await delay(2000);
    }
  }

  await dismissCookieBanner(page);
  focusTick();
  return { html: await page.content() };
}

function killOrphanChromes() {
  // Old ProxyRack / failed-close Chrome windows reuse the same profile and
  // show up as extra "TEST" Dock icons with frozen tabs.
  try {
    execSync(
      `pkill -f 'user-data-dir=${PROFILE}' 2>/dev/null || true`,
      { stdio: 'ignore' }
    );
  } catch (e) {}
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
      // Ensure no orphan Chrome windows keep the shared profile open.
      killOrphanChromes();
      await delay(400);
    }
  }

  /**
   * @param {{ force?: boolean, reason?: string }} [opts]
   * force=true: always new ProxyRack sticky port + wiped Chrome profile
   *   (skips if another tab already rotated within ROTATE_COOLDOWN_MS)
   */
  async function openBrowser(opts = {}) {
    // Never rotate Chrome while another tab is mid-captcha (causes twitch + lost challenge).
    if (isCaptchaSolving() && !opts.forceDuringCaptcha) {
      console.log('openBrowser deferred — captcha solve in progress');
      while (isCaptchaSolving()) await delay(1000);
      if (browserAlive()) return { browser, pages };
    }
    const force = !!opts.force;
    const reason = opts.reason || (force ? 'fresh-session' : 'recover');
    return withRestartLock(async () => {
      if (!force && browserAlive()) return { browser, pages };
      // Several tabs often hit empty at once — one fresh sticky session is enough.
      if (force && browserAlive() && Date.now() - lastRotateAt < ROTATE_COOLDOWN_MS) {
        return { browser, pages };
      }

      await closeBrowser();
      await delay(500);
      proxyIdx += 1;
      const port = USE_PROXY ? proxyPort(proxyIdx) : null;

      // Wipe profile ONLY for ProxyRack sticky IP changes. Never wipe on VPN/direct
      // (startup or rotate) — wiping kills cookies and any open captcha challenge.
      const shouldWipe = force && USE_PROXY;
      if (shouldWipe) {
        wipeProfile(PROFILE);
        console.log(
          `fresh sticky session reason=${reason} proxy=${port} profile wiped`
        );
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
      if (!HEADLESS) args.push('--window-position=-4000,50');
      if (USE_PROXY) args.unshift(`--proxy-server=http://${PROXY_HOST}:${port}`);

      let lastErr;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          clearSingletonLocks(PROFILE);
          browser = await puppeteer.launch({
            executablePath: CHROME,
            headless: HEADLESS ? true : false,
            ignoreDefaultArgs: ['--enable-automation'],
            // Keep Chrome alive if the worker process is killed/restarted so an
            // open captcha is not wiped by a code reload.
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

      // Reuse Chrome's default tab so we don't leave a spare about:blank.
      const existing = await browser.pages();
      pages = [];
      for (let i = 0; i < THREADS; i += 1) {
        const page = existing[i] || (await browser.newPage());
        await setupPage(page);
        if (i === 0) await pushWindowOffscreen(page);
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

  // Prefer attaching to an already-running Chrome so a worker restart does not
  // wipe/dismiss an open hCaptcha ("I am human") challenge.
  async function attachExistingChrome() {
    try {
      const portFile = path.join(PROFILE, 'DevToolsActivePort');
      if (!fs.existsSync(portFile)) return false;
      const [dbgPort] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
      if (!dbgPort) return false;
      const attached = await puppeteer.connect({
        browserURL: `http://127.0.0.1:${dbgPort}`,
        defaultViewport: null,
        protocolTimeout: 180000,
      });
      const existing = await attached.pages();
      if (!existing.length) {
        attached.disconnect();
        return false;
      }
      browser = attached;
      pages = [];
      for (let i = 0; i < THREADS; i += 1) {
        const page = existing[i] || (await browser.newPage());
        await setupPage(page);
        pages.push(page);
      }
      // Drop leftover tabs when THREADS was lowered (e.g. 15 → 10).
      for (let i = THREADS; i < existing.length; i += 1) {
        try {
          await existing[i].close();
        } catch (e) {}
      }
      console.log(
        `reused existing Chrome tabs=${pages.length} proxy=off profile kept (no wipe)`
      );
      return true;
    } catch (e) {
      console.log(`attach existing Chrome failed: ${e.message}`);
      return false;
    }
  }

  if (USE_PROXY || !(await attachExistingChrome())) {
    await openBrowser({ force: true, reason: 'startup' });
  }

  async function worker(slot) {
    let retries = 0;
    for (;;) {
      // Pause other tabs while captcha is being solved in one tab.
      while (isCaptchaSolving()) await delay(1000);

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
      const condition = task.data.condition || '';

      try {
        if (!browserAlive() || !pages[slot] || pages[slot].isClosed()) {
          await openBrowser();
        }
        const page = pages[slot];
        console.log(`t${slot} fetch ind=${task.ind}`);
        let { html } = await scrapeWithPage(page, pageUrl);

        if (looksLikeCf(html) || pageLooksLikeHcaptcha(html, await page.title().catch(() => ''))) {
          retries += 1;
          if (isCaptchaSolving()) {
            console.error(
              `t${slot} captcha page — waiting (other tab is solving; checkbox stays idle)`
            );
            while (isCaptchaSolving()) await delay(1000);
          }
          console.error(`t${slot} captcha/CF ind=${task.ind} -> try hcaptcha solver (no reload yet)`);
          const captchaStarted = Date.now();
          let solved = await solveHcaptcha(page).catch((e) => {
            console.error(`t${slot} hcaptcha solve error:`, e.message);
            return false;
          });
          // Keep trying until solved or 4-minute give-up, then reload.
          while (!solved && Date.now() - captchaStarted < CAPTCHA_GIVE_UP_MS) {
            const left = Math.round((CAPTCHA_GIVE_UP_MS - (Date.now() - captchaStarted)) / 1000);
            console.error(`t${slot} captcha not solved — retry (${left}s until reload)…`);
            await delay(8000);
            if (isCaptchaSolving()) {
              while (isCaptchaSolving()) await delay(1000);
            }
            solved = await solveHcaptcha(page).catch(() => false);
            if (solved) break;
            if (
              !pageLooksLikeHcaptcha(
                await page.content().catch(() => ''),
                await page.title().catch(() => '')
              )
            ) {
              // Challenge gone / page moved on
              break;
            }
          }
          if (solved) {
            const again = await scrapeWithPage(page, pageUrl);
            html = again.html;
          } else if (USE_PROXY) {
            console.error(
              `t${slot} captcha unsolved for ~${Math.round(
                (Date.now() - captchaStarted) / 1000
              )}s -> reload Chrome`
            );
            await openBrowser({
              force: true,
              reason: `captcha-timeout-t${slot}-${task.ind}`,
            });
            await delay(3000);
            continue;
          } else {
            // Direct/VPN: never kill Chrome on captcha timeout — keep retrying
            // "I am human" on the same page instead of wiping the challenge.
            console.error(
              `t${slot} captcha unsolved for ~${Math.round(
                (Date.now() - captchaStarted) / 1000
              )}s — keep page, retry I am human (no Chrome reload)`
            );
            await delay(5000);
            continue;
          }
        }

        let parsed = parseBueromarktHtml(html, pageUrl, condition);
        let products = parsed.products || [];
        let options = parsed.options || [];

        if (!products.length) {
          retries += 1;
          console.error(`t${slot} empty ind=${task.ind} html=${html.length}`);
          if (pageLooksLikeHcaptcha(html, '') || html.length < 2500) {
            const solved = await solveHcaptcha(page).catch((e) => {
              console.error(`t${slot} hcaptcha solve error:`, e.message);
              return false;
            });
            if (solved) {
              const again = await scrapeWithPage(page, pageUrl);
              parsed = parseBueromarktHtml(again.html, pageUrl, condition);
              products = parsed.products || [];
              options = parsed.options || [];
            }
          }
          if (!products.length) {
            // Never rotate Chrome on VPN/direct for empty pages — that kills
            // any open captcha in other tabs. ProxyRack sticky rotate only.
            if (
              FRESH_ON_EMPTY &&
              USE_PROXY &&
              !isCaptchaSolving() &&
              (html.length < 2000 || retries % 3 === 0)
            ) {
              await openBrowser({
                force: true,
                reason: `empty-t${slot}-${task.ind}-html${html.length}`,
              });
            }
            await delay(2000);
            continue;
          }
        }

        await saveResult(task.ind, products, options);
        console.log(
          `t${slot} saved ind=${task.ind} products=${products.length} price=${products[0].price} options=${options.length}`
        );
        retries = 0;
        await delay(DELAY_MS + Math.random() * DELAY_MS);
      } catch (e) {
        const msg = e.message || '';
        console.error(`t${slot} scrape ind=${task.ind}:`, msg);
        retries += 1;

        if (isCaptchaSolving()) {
          await delay(2000);
          continue;
        }

        // Sibling tab rotated the shared browser — just pick up the new pages.
        if (/detached Frame|Target closed|Session closed|Protocol error/i.test(msg)) {
          await openBrowser();
          await delay(400);
          continue;
        }

        // Timeouts: retry same sticky session. Only wipe after repeated failures
        // so one slow tab doesn't kill the tabs that are still saving.
        if (/ERR_TIMED_OUT|Navigation timeout|ERR_CONNECTION|ERR_PROXY|ERR_TUNNEL/i.test(msg)) {
          if (retries >= 3) {
            console.error(`t${slot} repeated timeouts -> fresh sticky session`);
            await openBrowser({
              force: true,
              reason: `timeouts-t${slot}-${task.ind}`,
            });
            retries = 0;
          }
          await delay(2500);
          continue;
        }

        if (isHardError(msg)) {
          await openBrowser({ reason: `hard-t${slot}-${task.ind}` });
        }
        await delay(2500);
      }
    }
  }

  console.log(
    `Starting single-window ${THREADS}-tab workers -> ${SERVER_BASE} (headless=${HEADLESS}, proxy=${USE_PROXY ? 'on' : 'off'})`
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
