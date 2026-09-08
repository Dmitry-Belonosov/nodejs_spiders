#!/usr/bin/env node
/**
 * Tiny Chrome+proxy connectivity check.
 *   node scripts/probe_proxy.js [country]
 */
require('../env');
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { detectChrome, installHint } = require('../chrome');

const country = (process.argv[2] || 'us').toLowerCase();
const user = process.env.PROXY_USER || `competitormonitor-country-${country}`;
const pass = process.env.PROXY_PASS || '';
const host = process.env.PROXY_HOST || 'private.residential.proxyrack.net';
const port = parseInt(process.argv[3] || '10011', 10);
const CHROME = detectChrome();
if (!CHROME) {
  console.error(installHint());
  process.exit(1);
}
if (!pass) {
  console.error('PROXY_PASS missing');
  process.exit(1);
}

(async () => {
  const profile = `/tmp/gs-proxy-probe-${port}`;
  try {
    fs.rmSync(profile, { recursive: true, force: true });
  } catch (e) {}
  fs.mkdirSync(profile, { recursive: true });
  console.log(`trying ${host}:${port} user=${user}`);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      `--proxy-server=http://${host}:${port}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      `--user-data-dir=${profile}`,
      '--window-size=1100,800',
    ],
  });
  const page = (await browser.pages())[0] || (await browser.newPage());
  await page.authenticate({ username: user, password: pass });
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'
  );
  page.on('requestfailed', (req) => {
    console.log('requestfailed', req.url().slice(0, 80), req.failure() && req.failure().errorText);
  });
  try {
    const resp = await page.goto('https://www.google.com/', { waitUntil: 'domcontentloaded', timeout: 25000 });
    console.log('status', resp && resp.status(), 'url', page.url(), 'title', await page.title());
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error('FAIL', e.message);
    await browser.close().catch(() => {});
    process.exit(1);
  }
})();
