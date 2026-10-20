// Open target search, open card, expand "More details", dump HTML + text; grep for ids.
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const { detectChrome } = require('../lib/chrome');
const g = require('../lib/google');
(async () => {
  const [q, gtin, mpn] = process.argv.slice(2);
  const b = await puppeteer.launch({ executablePath: detectChrome(), headless: false, userDataDir: '/tmp/gs2-profile', defaultViewport: null, args: ['--window-size=1440,1000'] });
  const p = (await b.pages())[0];
  await g.openSearch(p, q, console.log);
  await g.openCard(p, 0);
  for (const label of ['More details', 'More stores']) {
    await p.evaluate((l) => { const e = [...document.querySelectorAll('a,button,span,div[role=button]')].find((x) => (x.innerText || '').trim() === l && x.getBoundingClientRect().left > innerWidth * 0.45); if (e) e.click(); }, label);
    await new Promise((r) => setTimeout(r, 2500));
  }
  const html = await p.content();
  const text = await p.evaluate(() => document.body.innerText);
  fs.writeFileSync('data/probe/ids.html', html);
  for (const [name, v] of [['gtin', gtin], ['mpn', mpn]]) {
    let i = -1, n = 0;
    while ((i = html.indexOf(v, i + 1)) >= 0 && n < 6) { console.log(`HTML ${name}:`, JSON.stringify(html.slice(Math.max(0, i - 120), i + 40))); n++; }
    const ti = text.indexOf(v); console.log(`TEXT ${name}:`, ti >= 0 ? JSON.stringify(text.slice(Math.max(0, ti - 150), ti + 40)) : 'not in visible text');
  }
  const m = text.match(/(GTIN|UPC|EAN|MPN|Model|Part number)[^\n]{0,5}\n?[^\n]{0,40}/gi); console.log('labels:', m && m.slice(0, 10));
  await b.close();
})();
