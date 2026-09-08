/**
 * Puppeteer worker — uk.rs-online.com
 *
 * One Chrome-for-Testing window with THREADS tabs. The supervisor starts two
 * of these (separate profiles) so a run is 2 windows × 10 tabs.
 *
 * Akamai usually answers with "Access Denied" (rotate the exit IP). If the
 * page is instead an hCaptcha challenge, the solver that already worked on
 * bueromarkt is used — that needs headed Chrome, which is why HEADLESS
 * defaults to 0.
 */
const puppeteer = require('puppeteer-core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { parseRsonlineHtml, looksLikeBlocked } = require('./parse');
const {
  solveHcaptcha,
  pageLooksLikeHcaptcha,
  isCaptchaSolving,
  CAPTCHA_GIVE_UP_MS,
} = require('./hcaptcha_solver');

const SERVER_BASE = process.env.SERVER || 'http://127.0.0.1:5051';
const WINDOW_INDEX = parseInt(process.env.WINDOW_INDEX || '0', 10);
// Akamai Access Denied is not a captcha: parallel tabs on one sticky IP
// get banned. One tab per window (two windows = two IPs) is the layout
// that can actually load a product page.
const THREADS = parseInt(process.env.THREADS || '1', 10);
const DELAY_MS = parseInt(process.env.DELAY_MS || '2000', 10);
const PROXY_USER = process.env.PROXY_USER || 'competitormonitor-country-uk';
const PROXY_PASS = process.env.PROXY_PASS || '';
const PROXY_HOST = process.env.PROXY_HOST || 'private.residential.proxyrack.net';
const PROXY_COUNT = parseInt(process.env.PROXY_COUNT || '200', 10);
const USE_PROXY = !['0', 'false', 'no', 'off'].includes(
  String(process.env.USE_PROXY == null ? '1' : process.env.USE_PROXY).toLowerCase()
);
const HOME_URL = process.env.HOME_URL || 'https://uk.rs-online.com/';
// Without this the crawl would silently run unproxied or fail to authenticate.
if (USE_PROXY && !PROXY_PASS) {
  console.error('PROXY_PASS is not set — add it to .env, or set USE_PROXY=0 to crawl direct');
  process.exit(1);
}
const HEADLESS = !['0', 'false', 'no'].includes(
  String(process.env.HEADLESS == null ? '0' : process.env.HEADLESS).toLowerCase()
);
const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CFT_CHROME = `${process.env.HOME}/chrome-for-testing/chrome/mac_arm-132.0.6834.83/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const CHROME =
  process.env.CHROME || (fs.existsSync(MAC_CHROME) ? MAC_CHROME : CFT_CHROME);
const IS_CHROME_FOR_TESTING = /chrome for testing|chrome-for-testing/i.test(CHROME);
const PROFILE = process.env.PROFILE || '/tmp/rsonline-pp-profile-shared';
// Several tabs usually get blocked at once; one fresh exit IP covers them all.
const ROTATE_COOLDOWN_MS = parseInt(process.env.ROTATE_COOLDOWN_MS || '12000', 10);
const NAV_TIMEOUT_MS = parseInt(process.env.NAV_TIMEOUT_MS || '90000', 10);
const READY_TIMEOUT_MS = parseInt(process.env.READY_TIMEOUT_MS || '30000', 10);

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

// Empty by default: aborting images/fonts is a strong Akamai tell.
const BLOCK_TYPES = (process.env.BLOCK_TYPES !== undefined ? process.env.BLOCK_TYPES : '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

/** Chrome refuses to reuse a profile it thinks crashed, and shows a restore bubble. */
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
    prefs.profile = { ...(prefs.profile || {}), exit_type: 'Normal', exited_cleanly: true };
    fs.writeFileSync(prefsPath, JSON.stringify(prefs));
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

async function saveResult(ind, products) {
  await axios.post(`${SERVER_BASE}/save/`, { ind, products }, { timeout: 30000 });
}

async function setupPage(page) {
  if (USE_PROXY) {
    await page.authenticate({ username: PROXY_USER, password: PROXY_PASS });
  }
  if (IS_CHROME_FOR_TESTING) {
    await page.setUserAgent(UA);
  }
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

async function ensureHomepage(page) {
  const here = page.url() || '';
  const html = await page.content().catch(() => '');
  const onHome =
    /rs-online\.com\/?$/.test(here.replace(/https?:\/\//, '')) ||
    /uk\.rs-online\.com\/?(?:\?.*)?$/.test(here);
  if (onHome && html.length > 20000 && !looksLikeBlocked(html)) return;
  console.log(`window=${WINDOW_INDEX} opening homepage before product`);
  await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
  await delay(3000);
  await dismissCookieBanner(page);
  await delay(1500);
}

function isChromeErrorUrl(url) {
  return /^chrome-error:/i.test(url || '') || /chromewebdata/i.test(url || '');
}

/**
 * Product URLs are denied when Puppeteer calls page.goto() with no referrer
 * (CDP navigate, sec-fetch-site: none). Assigning location from the homepage
 * sends a same-origin referrer. If that still lands on chrome-error (typical
 * ProxyRack CONNECT blip), fall back to goto() with an explicit Referer.
 */
async function openProductLikeUser(page, pageUrl) {
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
      }, pageUrl),
    ]);
  } catch (e) {
    /* chrome-error or timeout — try a referred goto below */
  }

  if (isChromeErrorUrl(page.url()) || !/\/web\/p\//i.test(page.url() || '')) {
    await page.goto(pageUrl, {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT_MS,
      referer: HOME_URL,
    });
  }

  if (isChromeErrorUrl(page.url())) {
    throw new Error(`ERR_TUNNEL product nav chrome-error (${pageUrl})`);
  }
}

/** Akamai sets sensor cookies on the homepage. Hitting a PDP cold is denied. */
async function warmupSession(page) {
  try {
    console.log(`window=${WINDOW_INDEX} warmup ${HOME_URL}`);
    await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    await delay(4000);
    await dismissCookieBanner(page);
    await delay(1500);
    const html = await page.content().catch(() => '');
    if (looksLikeBlocked(html)) {
      throw new Error('warmup Access Denied');
    }
    console.log(`window=${WINDOW_INDEX} warmup ok html=${html.length}`);
  } catch (e) {
    throw new Error(`warmup failed: ${e.message}`);
  }
}

/** RS Online uses a OneTrust banner; it overlays the page but not the markup. */
async function dismissCookieBanner(page) {
  try {
    await page.evaluate(() => {
      const selectors = [
        '#onetrust-accept-btn-handler',
        '#truste-consent-button',
        'button[aria-label="Accept All Cookies"]',
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

async function scrapeWithPage(page, pageUrl) {
  await openProductLikeUser(page, pageUrl);
  // The old extension waited 8s for JSON-LD; the product payload is late.
  await delay(8000);
  await dismissCookieBanner(page);

  try {
    await page.waitForFunction(
      () => {
        const html = document.documentElement ? document.documentElement.outerHTML : '';
        if (/Access Denied|You don't have permission to access/i.test(html)) return true;
        return html.includes('"@type":"Product"') || html.includes('product_page_price');
      },
      { timeout: READY_TIMEOUT_MS, polling: 500 }
    );
  } catch (e) {
    // Fall through: the caller decides from the HTML whether this was a block,
    // a genuinely missing product, or a page worth retrying.
  }

  return page.content();
}

async function main() {
  // Each Chrome window must use a different ProxyRack sticky port. Both
  // workers used to start at 1 and then increment in lockstep, so 20 tabs
  // shared one residential IP and every navigation timed out.
  let proxyIdx = WINDOW_INDEX * Math.max(11, Math.floor(PROXY_COUNT / 2));
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

  /**
   * @param {{ force?: boolean, reason?: string }} [opts]
   * force=true takes a new ProxyRack sticky port and a clean profile, which is
   * what actually changes Akamai's mind about the client.
   */
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
      // Access Denied must always take a new IP. The cooldown only stops
      // timeout stampedes from restarting Chrome over and over.
      const mustRotate = /blocked|captcha|warmup/i.test(reason);
      if (force && !mustRotate && browserAlive() && Date.now() - lastRotateAt < ROTATE_COOLDOWN_MS) {
        return;
      }

      await closeBrowser();
      proxyIdx += 1;
      const port = USE_PROXY ? proxyPort(proxyIdx) : null;

      // New ProxyRack IPs need a clean cookie jar. On the VPN, keep the
      // profile so Akamai sensor cookies survive across pages.
      if (force && USE_PROXY) {
        wipeProfile(PROFILE);
        console.log(
          `fresh session window=${WINDOW_INDEX} reason=${reason} proxy=${port} (profile wiped)`
        );
      } else {
        fs.mkdirSync(PROFILE, { recursive: true });
        clearSingletonLocks(PROFILE);
        suppressRestoreBubble(PROFILE);
        console.log(
          `session window=${WINDOW_INDEX} reason=${reason} proxy=${USE_PROXY ? port : 'off'} chrome=${IS_CHROME_FOR_TESTING ? 'for-testing' : 'google-chrome'}`
        );
      }

      const args = [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        '--disable-http2',
        `--user-data-dir=${PROFILE}`,
        '--window-size=1280,800',
        `--window-position=${80 + WINDOW_INDEX * 640},80`,
        '--lang=en-GB',
      ];
      if (USE_PROXY) args.unshift(`--proxy-server=http://${PROXY_HOST}:${port}`);

      let lastErr = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          clearSingletonLocks(PROFILE);
          browser = await puppeteer.launch({
            executablePath: CHROME,
            headless: HEADLESS,
            ignoreDefaultArgs: [
              '--enable-automation',
              '--enable-blink-features=IdleDetection',
              '--disable-extensions',
              '--disable-component-extensions-with-background-pages',
              '--disable-default-apps',
              '--disable-sync',
              '--metrics-recording-only',
              '--disable-background-networking',
              '--disable-client-side-phishing-detection',
              '--disable-hang-monitor',
              '--disable-popup-blocking',
              '--disable-prompt-on-repost',
              '--password-store=basic',
              '--use-mock-keychain',
            ],
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

      // Reuse Chrome's default tab rather than leaving a spare about:blank.
      const existing = await browser.pages();
      pages = [];
      for (let i = 0; i < THREADS; i += 1) {
        const page = existing[i] || (await browser.newPage());
        await setupPage(page);
        pages.push(page);
      }
      for (let i = THREADS; i < existing.length; i += 1) {
        try {
          await existing[i].close();
        } catch (e) {}
      }
      lastRotateAt = Date.now();
      console.log(
        `browser ready tabs=${pages.length} proxy=${USE_PROXY ? port : 'off (system/VPN)'}`
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

      let task;
      try {
        task = await fetchTask();
        if (!task || task.ind === undefined) {
          await delay(3000);
          continue;
        }
      } catch (e) {
        console.error(`t${slot} get: ${e.message}`);
        await delay(4000);
        continue;
      }

      const pageUrl = task.data.url;

      try {
        if (!browserAlive() || !pages[slot] || pages[slot].isClosed()) await openBrowser();

        let html = await scrapeWithPage(pages[slot], pageUrl);
        const landedUrl = pages[slot].url() || '';
        const title = await pages[slot].title().catch(() => '');
        console.log(
          `t${slot} landed ind=${task.ind} title=${JSON.stringify(title)} html=${html.length} url=${landedUrl}`
        );

        if (isChromeErrorUrl(landedUrl)) {
          throw new Error(`ERR_TUNNEL chrome-error after product nav (${landedUrl})`);
        }

        if (pageLooksLikeHcaptcha(html, title)) {
          console.error(`t${slot} hCaptcha on ind=${task.ind} — using proven solver`);
          const captchaStarted = Date.now();
          let solved = await solveHcaptcha(pages[slot]).catch((e) => {
            console.error(`t${slot} hcaptcha solve error: ${e.message}`);
            return false;
          });
          while (!solved && Date.now() - captchaStarted < CAPTCHA_GIVE_UP_MS) {
            await delay(8000);
            solved = await solveHcaptcha(pages[slot]).catch(() => false);
            if (
              !pageLooksLikeHcaptcha(
                await pages[slot].content().catch(() => ''),
                await pages[slot].title().catch(() => '')
              )
            ) {
              break;
            }
          }
          if (solved) {
            html = await scrapeWithPage(pages[slot], pageUrl);
          } else {
            console.error(`t${slot} captcha unsolved — fresh Chrome session`);
            await openBrowser({ force: true, reason: `captcha-timeout-t${slot}` });
            await delay(3000);
            continue;
          }
        }

        if (looksLikeBlocked(html)) {
          retries += 1;
          if (USE_PROXY) {
            console.error(`t${slot} BLOCKED ind=${task.ind} html=${html.length} -> new exit IP`);
            await openBrowser({ force: true, reason: `blocked-t${slot}-${task.ind}` });
            await delay(3000);
          } else {
            // VPN is one IP: restarting Chrome does not change it. Back off.
            console.error(
              `t${slot} BLOCKED ind=${task.ind} html=${html.length} (VPN IP) — waiting`
            );
            await delay(8000);
          }
          continue;
        }

        const products = parseRsonlineHtml(html, pageUrl).products;

        if (!products.length) {
          retries += 1;
          console.error(`t${slot} empty ind=${task.ind} html=${html.length} url=${landedUrl}`);
          if (isChromeErrorUrl(landedUrl)) {
            throw new Error(`ERR_TUNNEL chrome-error empty page (${landedUrl})`);
          }
          // A short page is a soft block Akamai did not label; a full page with
          // no product is a discontinued item, which must not rotate the proxy.
          if (html.length < 20000) {
            if (USE_PROXY) {
              await openBrowser({ force: true, reason: `empty-t${slot}-${task.ind}` });
              await delay(2000);
            } else {
              await delay(5000);
            }
            continue;
          }
          // Record the miss so the queue drains instead of looping forever.
          await saveResult(task.ind, []);
          console.log(`t${slot} saved ind=${task.ind} products=0 (no product on page)`);
          retries = 0;
          await delay(DELAY_MS);
          continue;
        }

        await saveResult(task.ind, products);
        console.log(
          `t${slot} saved ind=${task.ind} products=${products.length} price=${products[0].price}`
        );
        retries = 0;
        await delay(DELAY_MS + Math.random() * DELAY_MS);
      } catch (e) {
        const msg = e.message || '';
        console.error(`t${slot} scrape ind=${task.ind}: ${msg}`);
        retries += 1;

        // A sibling tab rotated the shared browser — pick up the new pages.
        if (/detached Frame|Target closed|Session closed|Protocol error/i.test(msg)) {
          await openBrowser();
          await delay(400);
          continue;
        }

        // Retry timeouts on the same session; only rotate once they persist, so
        // one slow tab does not throw away the tabs that are still saving.
        if (/ERR_TIMED_OUT|Navigation timeout|ERR_CONNECTION|ERR_PROXY|ERR_TUNNEL/i.test(msg)) {
          // One tab must not restart Chrome for the whole window. Ten tabs
          // timing out together used to stampede, detach each other, and
          // never save a product.
          if (retries >= 3 && Date.now() - lastRotateAt > 45000) {
            console.error(`t${slot} repeated timeouts -> fresh session`);
            await openBrowser({ force: true, reason: `timeouts-t${slot}-${task.ind}` });
            retries = 0;
          }
          await delay(2500);
          continue;
        }

        if (isHardError(msg)) await openBrowser({ reason: `hard-t${slot}-${task.ind}` });
        await delay(2500);
      }
    }
  }

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
      console.log(`${signal} — closing browser`);
      await closeBrowser().catch(() => {});
      process.exit(0);
    });
  }

  console.log(
    `starting window=${WINDOW_INDEX} ${THREADS} tab(s) -> ${SERVER_BASE} (headless=${HEADLESS}, proxy=${USE_PROXY ? 'on' : 'off (system/VPN)'}, chrome=${CHROME})`
  );
  await Promise.all(
    Array.from({ length: THREADS }, (_, i) =>
      delay(i * 2500).then(() => worker(i))
    )
  );
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection:', err && err.message ? err.message : err);
});
