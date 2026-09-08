/**
 * Isolated FlareSolverr benchmark for Autodoc PDP URLs.
 *
 * Uses one persistent browser session and one ProxyRack port. Results are
 * written separately so the completed 10k Puppeteer run remains untouched.
 *
 * Run:
 *   LIMIT=100 node flaresolverr_benchmark.js
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { parseAutodocHtml, applyShipping } = require('./parse');

const FLARESOLVERR = process.env.FLARESOLVERR || 'http://127.0.0.1:8191/v1';
const INPUT = process.env.INPUT || 'urls.10000.json';
const OFFSET = parseInt(process.env.OFFSET || '0', 10);
const LIMIT = parseInt(process.env.LIMIT || '100', 10);
const PROXY_HOST = process.env.PROXY_HOST || 'private.residential.proxyrack.net';
const PROXY_PORT = parseInt(process.env.PROXY_PORT || '10000', 10);
const PROXY_USER = process.env.PROXY_USER || 'competitormonitor-country-uk';
const PROXY_PASS =
  process.env.PROXY_PASS || '';
// Without this the crawl would silently fail to authenticate with the proxy.
if (!PROXY_PASS) {
  console.error('PROXY_PASS is not set — add it to .env');
  process.exit(1);
}
const SESSION = process.env.SESSION || `autodoc-benchmark-${Date.now()}-${process.pid}`;
const OUT_DIR = process.env.OUT_DIR || 'data/flaresolverr-100';

const client = axios.create({
  baseURL: FLARESOLVERR,
  timeout: 150000,
  headers: { 'Content-Type': 'application/json' },
});

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function command(body) {
  const response = await client.post('', body);
  if (response.data.status !== 'ok') {
    throw new Error(response.data.message || JSON.stringify(response.data));
  }
  return response.data;
}

async function main() {
  const urls = JSON.parse(fs.readFileSync(INPUT, 'utf8')).slice(OFFSET, OFFSET + LIMIT);
  if (!urls.length) throw new Error(`No URLs in ${INPUT}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const resultsPath = path.join(OUT_DIR, 'results.jsonl');
  const summaryPath = path.join(OUT_DIR, 'summary.json');
  fs.writeFileSync(resultsPath, '');

  await command({
    cmd: 'sessions.create',
    session: SESSION,
    proxy: {
      url: `http://${PROXY_HOST}:${PROXY_PORT}`,
      username: PROXY_USER,
      password: PROXY_PASS,
    },
  });
  console.log(
    `session=${SESSION} proxy=${PROXY_HOST}:${PROXY_PORT} offset=${OFFSET} urls=${urls.length}`
  );

  const stats = {
    total: urls.length,
    completed: 0,
    parsed: 0,
    priced: 0,
    failed: 0,
    elapsed_ms: 0,
    started_at: new Date().toISOString(),
  };
  const started = Date.now();

  try {
    for (let ind = 0; ind < urls.length; ind += 1) {
      const task = urls[ind];
      const startedPage = Date.now();
      try {
        const data = await command({
          cmd: 'request.get',
          url: task.url,
          session: SESSION,
          session_ttl_minutes: 60,
          maxTimeout: 120000,
          // Let Autodoc render normally for an apples-to-apples comparison.
          disableMedia: false,
          waitInSeconds: 2,
        });
        const solution = data.solution || {};
        const html = solution.response || '';
        const products = (parseAutodocHtml(html, task.url, task.mode || 'pdp').products || []).map(
          applyShipping
        );
        const product = products[0] || null;
        if (!product) {
          const htmlDir = path.join(OUT_DIR, 'unparsed-html');
          fs.mkdirSync(htmlDir, { recursive: true });
          fs.writeFileSync(path.join(htmlDir, `${ind}.html`), html);
        }
        const row = {
          ind: OFFSET + ind,
          url: task.url,
          status: solution.status || null,
          html_bytes: Buffer.byteLength(html),
          elapsed_ms: Date.now() - startedPage,
          parsed: Boolean(product),
          price: product ? product.price : null,
          product,
        };
        fs.appendFileSync(resultsPath, `${JSON.stringify(row)}\n`);
        stats.completed += 1;
        if (product) {
          stats.parsed += 1;
          if (Number(product.price) > 0) stats.priced += 1;
        }
        console.log(
          `${ind + 1}/${urls.length} status=${row.status} html=${row.html_bytes} parsed=${row.parsed} price=${row.price} ${row.elapsed_ms}ms`
        );
      } catch (error) {
        stats.failed += 1;
        fs.appendFileSync(
          resultsPath,
          `${JSON.stringify({
            ind: OFFSET + ind,
            url: task.url,
            error: error.message,
            elapsed_ms: Date.now() - startedPage,
          })}\n`
        );
        console.error(`${ind + 1}/${urls.length} failed: ${error.message}`);
      }
      fs.writeFileSync(
        summaryPath,
        JSON.stringify(
          {
            ...stats,
            elapsed_ms: Date.now() - started,
            updated_at: new Date().toISOString(),
          },
          null,
          2
        )
      );
      await delay(250);
    }
  } finally {
    await command({ cmd: 'sessions.destroy', session: SESSION }).catch(() => {});
  }

  stats.elapsed_ms = Date.now() - started;
  stats.finished_at = new Date().toISOString();
  fs.writeFileSync(summaryPath, JSON.stringify(stats, null, 2));
  console.log(`done ${JSON.stringify(stats)}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
