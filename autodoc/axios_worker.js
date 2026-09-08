/**
 * Concurrent Node worker — ProxyRack residential rotation (Very-style).
 * Parses HTML immediately and POSTs products (no giant HTML dumps).
 *
 * Env:
 *   THREADS=20
 *   PROXY_USER=competitormonitor-country-uk
 *   PROXY_PASS=...
 *   PROXY_HOST=private.residential.proxyrack.net
 *   SERVER=http://127.0.0.1:5052
 */
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { parseAutodocHtml, applyShipping } = require('./parse');

const SERVER_BASE = process.env.SERVER || 'http://127.0.0.1:5052';
const THREADS = parseInt(process.env.THREADS || '20', 10);
const PROXY_COUNT = parseInt(process.env.PROXY_COUNT || '200', 10);
const PROXY_USER = process.env.PROXY_USER || 'competitormonitor-country-uk';
const PROXY_PASS = process.env.PROXY_PASS || '';
const PROXY_HOST = process.env.PROXY_HOST || 'private.residential.proxyrack.net';
const USE_PROXY = !['0', 'false', 'no', 'off'].includes(
  String(process.env.USE_PROXY == null ? '1' : process.env.USE_PROXY).toLowerCase()
);

if (USE_PROXY && !PROXY_PASS) {
  console.error('PROXY_PASS is not set — add it to .env, or set USE_PROXY=0 to crawl on VPN/direct');
  process.exit(1);
}

const agents = [];
if (USE_PROXY) {
  for (let i = 0; i < PROXY_COUNT; i += 1) {
    agents.push(
      new HttpsProxyAgent(`http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${10000 + i}`)
    );
  }
}

let proxyIndex = 0;
function nextAgent() {
  if (!USE_PROXY || !agents.length) return undefined;
  const agent = agents[proxyIndex % agents.length];
  proxyIndex += 1;
  return agent;
}

function headers() {
  return {
    accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'accept-language': 'en-GB,en;q=0.9',
    'cache-control': 'max-age=0',
    'sec-ch-ua': '"Chromium";v="132", "Not(A:Brand";v="24", "Google Chrome";v="132"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  };
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function looksBlocked(status, html) {
  if (status === 403 || status === 429 || status === 503) return true;
  if (!html || html.length < 2000) return true;
  if (/Access Denied|cf-browser-verification|Just a moment|challenge-platform/i.test(html))
    return true;
  return false;
}

function thread(index) {
  let retries = 0;

  async function loop() {
    let task;
    try {
      const res = await axios.get(`${SERVER_BASE}/get`, { timeout: 15000 });
      task = res.data;
      if (!task || task.ind === undefined) {
        await delay(4000);
        return loop();
      }
    } catch (e) {
      console.error(`t${index} get:`, e.message);
      await delay(5000);
      return loop();
    }

    const pageUrl = task.data.url;
    const mode = task.data.mode || 'pdp';
    const agent = nextAgent();
    console.log(`t${index} fetch ind=${task.ind} ${USE_PROXY ? 'proxy' : 'direct'} ${pageUrl}`);

    try {
      const response = await axios.get(pageUrl, {
        headers: headers(),
        ...(agent ? { httpsAgent: agent, proxy: false } : {}),
        responseType: 'text',
        timeout: 35000,
        validateStatus: (s) => s < 500,
        maxRedirects: 5,
      });

      if (response.status === 404) {
        await axios.post(
          `${SERVER_BASE}/save/`,
          { ind: task.ind, products: [] },
          { timeout: 15000 }
        );
        retries = 0;
        await delay(500 + Math.random() * 1000);
        return loop();
      }

      const html = typeof response.data === 'string' ? response.data : '';
      if (looksBlocked(response.status, html)) {
        retries += 1;
        console.error(
          `t${index} blocked ind=${task.ind} status=${response.status} retry=${retries}`
        );
        await delay(Math.min(30000, 2000 * retries));
        if (retries > 12) {
          retries = 0;
          await delay(20000);
        }
        // leave task pending (30s lease) so another proxy can retry
        return loop();
      }

      const parsed = parseAutodocHtml(html, pageUrl, mode);
      const products = (parsed.products || []).map(applyShipping);

      if (!products.length && mode === 'pdp') {
        retries += 1;
        console.error(`t${index} empty parse ind=${task.ind} len=${html.length}`);
        await delay(3000);
        return loop();
      }

      await axios.post(
        `${SERVER_BASE}/save/`,
        { ind: task.ind, products },
        { timeout: 30000 }
      );
      console.log(
        `t${index} saved ind=${task.ind} products=${products.length} mode=${parsed.mode}`
      );
      retries = 0;
      await delay(800 + Math.random() * 2200);
      return loop();
    } catch (e) {
      console.error(`t${index} scrape ind=${task.ind}:`, e.message);
      retries += 1;
      await delay(3000);
      return loop();
    }
  }

  return loop();
}

console.log(
  `Starting ${THREADS} workers -> ${SERVER_BASE} ${USE_PROXY ? `proxies=${PROXY_COUNT}` : 'direct/VPN (no ProxyRack)'}`
);
for (let i = 0; i < THREADS; i += 1) {
  thread(i);
}
