/**
 * Fetch product URLs from bueromarkt-ag.de sitemaps and write urls.json.
 *
 * Env:
 *   LIMIT=30          (0 = all)
 *   OUT=urls.json
 *   SITEMAP_MAX=5     how many sitemap-products_N.xml files to read
 */
const axios = require('axios');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');

const LIMIT = parseInt(process.env.LIMIT || '30', 10);
const OUT = process.env.OUT || 'urls.json';
const SITEMAP_MAX = parseInt(process.env.SITEMAP_MAX || '5', 10);
const PROXY_HOST = process.env.PROXY_HOST || 'private.residential.proxyrack.net';
const PROXY_PORT = process.env.PROXY_PORT || '10000';
const PROXY_USER = process.env.PROXY_USER || 'competitormonitor-country-de';
const PROXY_PASS =
  process.env.PROXY_PASS || '';
const USE_PROXY = process.env.USE_PROXY !== '0';
// Without this the crawl would silently run unproxied or fail to authenticate.
if (USE_PROXY && !PROXY_PASS) {
  console.error('PROXY_PASS is not set — add it to .env, or set USE_PROXY=0 to crawl direct');
  process.exit(1);
}

const agent = USE_PROXY
  ? new HttpsProxyAgent(
      `http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}`
    )
  : undefined;

async function fetchText(url) {
  const res = await axios.get(url, {
    timeout: 120000,
    responseType: 'text',
    httpsAgent: agent,
    httpAgent: agent,
    proxy: false,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
      Accept: 'application/xml,text/xml,*/*',
    },
  });
  return typeof res.data === 'string' ? res.data : String(res.data);
}

function extractLocs(xml) {
  const locs = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml))) locs.push(m[1].trim());
  return locs;
}

async function main() {
  const urls = [];
  const seen = new Set();

  for (let n = 1; n <= SITEMAP_MAX; n += 1) {
    if (LIMIT > 0 && urls.length >= LIMIT) break;
    const sitemapUrl = `https://www.bueromarkt-ag.de/sitemaps/sitemap-products_${n}.xml`;
    console.log(`fetch ${sitemapUrl}`);
    let xml;
    try {
      xml = await fetchText(sitemapUrl);
    } catch (e) {
      console.error(`failed ${sitemapUrl}: ${e.message}`);
      continue;
    }
    const locs = extractLocs(xml).filter((u) => /p-/i.test(u));
    console.log(`  found ${locs.length} product locs`);
    for (const loc of locs) {
      if (seen.has(loc)) continue;
      seen.add(loc);
      urls.push({ url: loc, mode: 'pdp', condition: '' });
      if (LIMIT > 0 && urls.length >= LIMIT) break;
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(urls, null, 2));
  console.log(`wrote ${urls.length} -> ${OUT}`);
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
