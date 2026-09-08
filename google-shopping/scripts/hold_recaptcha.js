/**
 * Leave Chrome open with remote debugging so we can click recaptcha tiles.
 *
 *   STRICT_US=0 node scripts/hold_recaptcha.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
require('../env');
const { detectChrome, installHint } = require('../chrome');
const { resolveUsExit, confirmCountryInPage, envFlag, isUnitedStates } = require('../locale');
const { shoppingSearchUrl } = require('../query');
const { recaptchaFrames, clickRecaptchaCheckbox, pageLooksLikeRecaptcha } = require('../recaptcha');

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
      '--remote-debugging-port=9222',
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
  if (!isUnitedStates(geo.country) && envFlag('STRICT_US', true)) throw new Error('need US');

  await page.goto('https://www.google.com/shopping?gl=us&hl=en', {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await delay(2000);
  const url = shoppingSearchUrl('Little Giant Smoker Fuel');
  try {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
      page.evaluate((href) => window.location.assign(href), url),
    ]);
  } catch (e) {}
  await delay(3000);
  console.log('url', page.url());
  console.log('captcha', await pageLooksLikeRecaptcha(page));
  await clickRecaptchaCheckbox(page);
  await delay(3500);
  await shot(page, 'captcha-grid.png');
  const { challenge } = recaptchaFrames(page);
  if (challenge) {
    try {
      const host = await challenge.frameElement();
      await host.screenshot({ path: path.join(OUT, 'captcha-tiles.png') });
      console.log('shot tiles iframe');
    } catch (e) {
      console.log('tile shot failed', e.message);
    }
    const prompt = await challenge.evaluate(() => {
      const el = document.querySelector('.rc-imageselect-desc-wrapper, .rc-imageselect-desc, strong');
      return (el && el.innerText) || document.body.innerText.slice(0, 200);
    }).catch(() => '');
    console.log('prompt', JSON.stringify(prompt));
  }
  fs.writeFileSync(path.join(OUT, 'browser-ws.txt'), browser.wsEndpoint());
  console.log('ws', browser.wsEndpoint());
  console.log('holding browser 3 min on :9222');
  await delay(180000);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
