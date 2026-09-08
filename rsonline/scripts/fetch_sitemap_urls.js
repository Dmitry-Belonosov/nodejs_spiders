/**
 * Build urls.json from uk.rs-online.com gzipped product sitemaps.
 *
 * Env:
 *   MAX_SITEMAPS=2   only process first N product sitemaps (default: all)
 *   LIMIT=10000      stop after N product URLs (default: unlimited)
 *   OUT=urls.json    output path
 */
const fs = require('fs');
const zlib = require('zlib');
const https = require('https');
const { URL } = require('url');

const SITEMAP_INDEX = 'https://uk.rs-online.com/sitemap.xml';
const OUT = process.env.OUT || 'urls.json';
const MAX_SITEMAPS = process.env.MAX_SITEMAPS ? parseInt(process.env.MAX_SITEMAPS, 10) : Infinity;
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        'accept': '*/*',
      },
      timeout: 120000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(fetchBuffer(new URL(res.headers.location, url).href));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`timeout ${url}`));
    });
  });
}

function extractLocs(xml) {
  const locs = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    locs.push(m[1].trim());
  }
  return locs;
}

function isProductUrl(u) {
  return u.includes('/web/p/');
}

async function main() {
  console.log('Fetching sitemap index...');
  const indexXml = (await fetchBuffer(SITEMAP_INDEX)).toString('utf8');
  const allSitemaps = extractLocs(indexXml).filter((u) => /uk_products_\d+\.xml\.gz/i.test(u));
  allSitemaps.sort((a, b) => {
    const na = parseInt((a.match(/uk_products_(\d+)/) || [])[1] || '0', 10);
    const nb = parseInt((b.match(/uk_products_(\d+)/) || [])[1] || '0', 10);
    return na - nb;
  });
  const sitemaps = allSitemaps.slice(0, MAX_SITEMAPS);
  console.log(`Product sitemaps: ${allSitemaps.length} (processing ${sitemaps.length})`);

  const seen = new Set();
  const urls = [];

  for (let i = 0; i < sitemaps.length; i++) {
    if (urls.length >= LIMIT) break;
    const smUrl = sitemaps[i];
    process.stdout.write(`[${i + 1}/${sitemaps.length}] ${smUrl} ... `);
    try {
      const gz = await fetchBuffer(smUrl);
      const xml = zlib.gunzipSync(gz).toString('utf8');
      let added = 0;
      for (const loc of extractLocs(xml)) {
        if (!isProductUrl(loc)) continue;
        if (seen.has(loc)) continue;
        seen.add(loc);
        urls.push({ url: loc });
        added++;
        if (urls.length >= LIMIT) break;
      }
      console.log(`+${added} (total ${urls.length})`);
    } catch (e) {
      console.log(`FAIL ${e.message}`);
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(urls));
  console.log(`Wrote ${urls.length} URLs to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
