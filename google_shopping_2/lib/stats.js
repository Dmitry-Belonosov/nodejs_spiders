/**
 * Run statistics + readable log blocks.
 *   captcha: each solve attempt (ok/fail, seconds, rounds, skips, new grids, rechecks)
 *   products: status, cards, matches, sellers, websites, seconds
 * Totals are printed every N products and at the end, and saved to out/run_report.json.
 */
const fs = require('fs');

const startedAt = Date.now();
const captchas = [];
const products = [];
const websites = new Set();

const sec = (ms) => Math.round(ms / 100) / 10;
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '-');
const fmtDur = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}h${Math.round((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m${Math.round(s % 60)}s` : `${Math.round(s)}s`);

/** Wrap a log function so captcha events inside one solve are counted. */
function captchaTracker(log) {
  const c = { at: new Date().toISOString(), rounds: 0, skips: 0, newGrids: 0, rechecks: 0, tiles: 0, started: Date.now() };
  const wrapped = (...args) => {
    const line = args.join(' ');
    if (/clicked Verify/.test(line)) c.rounds += 1;
    if (/pressing Skip/.test(line)) c.skips += 1;
    if (/requesting a new one/.test(line)) c.newGrids += 1;
    if (/recheck pass/.test(line)) c.rechecks += 1;
    if (/clicked tile/.test(line)) {
      c.tiles += 1;
      return; // too noisy for the log
    }
    log(...args);
  };
  const finish = (ok, why = '') => {
    c.ok = ok;
    c.seconds = sec(Date.now() - c.started);
    c.why = why;
    delete c.started;
    captchas.push(c);
    const n = captchas.length;
    const solved = captchas.filter((x) => x.ok).length;
    log(
      `CAPTCHA #${n} ${ok ? 'SOLVED' : 'FAILED'} in ${c.seconds}s · ${c.rounds} round(s), ${c.tiles} tiles clicked` +
        `${c.skips ? `, ${c.skips} skip` : ''}${c.newGrids ? `, ${c.newGrids} new grid` : ''}${c.rechecks ? `, ${c.rechecks} recheck` : ''}` +
        `${why ? ` · ${why}` : ''} | total ${solved}/${n} solved (${pct(solved, n)}), avg ${sec(avg(captchas.filter((x) => x.ok).map((x) => x.seconds * 1000)))}s`
    );
  };
  return { log: wrapped, finish };
}

function addProduct(p) {
  for (const d of p.domains || []) websites.add(d);
  products.push(p);
}

function totals(totalTargets) {
  const done = products.length;
  const ok = products.filter((p) => p.status === 'ok').length;
  const solved = captchas.filter((x) => x.ok);
  const perProduct = avg(products.map((p) => p.seconds));
  const left = Math.max(0, (totalTargets || done) - done);
  return {
    elapsed: fmtDur((Date.now() - startedAt) / 1000),
    products: { done, ok, no_match: products.filter((p) => p.status === 'no_match').length, blocked: products.filter((p) => p.status === 'blocked').length, error: products.filter((p) => p.status === 'error').length, left },
    matches: products.reduce((a, p) => a + p.matched, 0),
    sellers: products.reduce((a, p) => a + p.sellers, 0),
    websites: websites.size,
    captcha: {
      count: captchas.length,
      solved: solved.length,
      failed: captchas.length - solved.length,
      success_rate: pct(solved.length, captchas.length),
      avg_solve_s: sec(avg(solved.map((x) => x.seconds * 1000))),
      avg_rounds: Math.round(avg(captchas.map((x) => x.rounds)) * 10) / 10,
    },
    avg_product_s: Math.round(perProduct),
    eta: left ? fmtDur(left * perProduct) : '0s',
    hit_rate: pct(ok, done),
  };
}

function printTotals(log, totalTargets, title = 'PROGRESS') {
  const t = totals(totalTargets);
  log(
    `══ ${title} ${t.products.done}/${totalTargets} · ok ${t.products.ok}, no match ${t.products.no_match}, blocked ${t.products.blocked}` +
      `${t.products.error ? `, error ${t.products.error}` : ''} (hit rate ${t.hit_rate}) · ${t.matches} matched cards · ${t.sellers} sellers · ${t.websites} websites`
  );
  log(
    `══ captcha ${t.captcha.count} (solved ${t.captcha.solved}, failed ${t.captcha.failed}, ${t.captcha.success_rate}) avg ${t.captcha.avg_solve_s}s, ${t.captcha.avg_rounds} rounds` +
      ` · avg ${t.avg_product_s}s/product · elapsed ${t.elapsed} · ETA ${t.eta}`
  );
  return t;
}

function writeReport(file, totalTargets) {
  fs.writeFileSync(file, JSON.stringify({ finishedAt: new Date().toISOString(), totals: totals(totalTargets), products, captchas }, null, 1));
}

module.exports = { captchaTracker, addProduct, printTotals, writeReport, totals };
