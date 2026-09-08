/**
 * One-shot: connect to the running Chrome-for-Testing and solve hCaptcha
 * on whichever tab currently shows it.
 *
 *   node scripts/solve_hcaptcha_now.js
 */
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const { solveHcaptcha, pageLooksLikeHcaptcha, bringWindowOnscreen } = require('../hcaptcha_solver');

const PROFILE = process.env.PROFILE || '/tmp/bueromarkt-pp-profile-shared';

async function main() {
  const portFile = `${PROFILE}/DevToolsActivePort`;
  if (!fs.existsSync(portFile)) {
    throw new Error(`No DevToolsActivePort at ${portFile} — is the worker Chrome running?`);
  }
  const [port] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${port}`,
    defaultViewport: null,
  });
  const pages = await browser.pages();
  console.log(`connected tabs=${pages.length} port=${port}`);

  let target = null;
  for (const page of pages) {
    const html = await page.content().catch(() => '');
    const title = await page.title().catch(() => '');
    if (pageLooksLikeHcaptcha(html, title) || page.frames().some((f) => /hcaptcha/i.test(f.url()))) {
      target = page;
      console.log('found captcha tab:', page.url());
      break;
    }
  }
  if (!target) {
    // Prefer the active-looking product/security tab
    target = pages.find((p) => /bueromarkt-ag\.de/i.test(p.url())) || pages[0];
    console.log('no obvious captcha — trying', target && target.url());
  }

  await bringWindowOnscreen(target);
  const ok = await solveHcaptcha(target);
  console.log(ok ? 'SOLVED' : 'FAILED — see /tmp/bueromarkt-captcha dumps');
  browser.disconnect();
  process.exit(ok ? 0 : 2);
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
