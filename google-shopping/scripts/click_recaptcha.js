/**
 * Open Shopping search on-screen and click the Google robot checkbox if it appears.
 *
 *   STRICT_US=0 USE_PROXY=0 HEADLESS=0 node scripts/click_recaptcha.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
require('../env');
const { detectChrome, installHint } = require('../chrome');
const { resolveUsExit, confirmCountryInPage, isUnitedStates, envFlag } = require('../locale');
const { shoppingSearchUrl } = require('../query');
const { parseShoppingPage } = require('../parse');
const {
  pageLooksLikeRecaptcha,
  recaptchaFrames,
  clickRecaptchaCheckbox,
  solveRecaptchaIfPresent,
} = require('../recaptcha');

const OUT = path.join(__dirname, '..', 'probe-out');
const PROFILE = '/tmp/gs-recaptcha-profile';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function shot(page, name) {
  fs.mkdirSync(OUT, { recursive: true });
  const p = path.join(OUT, name);
  await page.screenshot({ path: p, fullPage: false });
  console.log('shot', p);
  return p;
}

(async () => {
  const chrome = detectChrome();
  if (!chrome) {
    console.error(installHint());
    process.exit(1);
  }
  await resolveUsExit();
  try {
    fs.rmSync(PROFILE, { recursive: true, force: true });
  } catch (e) {}
  fs.mkdirSync(PROFILE, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: false,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      `--user-data-dir=${PROFILE}`,
      '--window-size=1280,900',
      '--window-position=80,80',
      '--lang=en-US',
    ],
  });
  const page = (await browser.pages())[0] || (await browser.newPage());
  await page.setUserAgent(UA);
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const geo = await confirmCountryInPage(page);
  console.log(`browser ${geo.country} ${geo.city}`);
  if (!isUnitedStates(geo.country) && envFlag('STRICT_US', true)) {
    throw new Error(`need US, got ${geo.country}`);
  }

  await page.goto('https://www.google.com/shopping?gl=us&hl=en', {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await delay(2500);

  const url = shoppingSearchUrl('Little Giant Smoker Fuel');
  console.log('>> search', url);
  try {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
      page.evaluate((href) => window.location.assign(href), url),
    ]);
  } catch (e) {}
  await delay(3500);
  await shot(page, 'captcha-before.png');
  console.log('url', page.url());
  console.log('title', await page.title());
  console.log('recaptcha?', await pageLooksLikeRecaptcha(page));
  console.log(
    'frames',
    page.frames().map((f) => f.url().slice(0, 120))
  );

  const clicked = await clickRecaptchaCheckbox(page);
  console.log('clicked', clicked);
  await delay(2500);
  await shot(page, 'captcha-after.png');

  const solved = await solveRecaptchaIfPresent(page, { timeout: 12000 });
  await delay(2000);
  await shot(page, 'captcha-final.png');

  const html = await page.content();
  const parsed = parseShoppingPage({
    html,
    url: page.url(),
    title: await page.title(),
  });
  console.log(
    JSON.stringify(
      {
        href: page.url(),
        title: await page.title(),
        solved,
        stillCaptcha: await pageLooksLikeRecaptcha(page),
        candidates: parsed.candidates.length,
        challenge: !!(recaptchaFrames(page).challenge),
      },
      null,
      2
    )
  );

  await delay(8000);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
