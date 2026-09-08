/**
 * Build urls.json from previous Autodoc JSONL feed (product refresh mode).
 *
 * Env:
 *   SRC=path/to/EuroCarParts-autodoc_meta.json-lines
 *   LIMIT=100000
 *   OUT=urls.json
 *   MODE=pdp|plp   (default pdp — one URL per product from feed)
 */
const fs = require('fs');
const readline = require('readline');

const SRC =
  process.env.SRC ||
  '/Users/dmitry/Projects/CM/spiders-system/product_spiders/spiders/eurocarparts/EuroCarParts-autodoc_meta.json-lines';
const OUT = process.env.OUT || 'urls.json';
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;
const MODE = process.env.MODE || 'pdp';

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('SRC not found:', SRC);
    process.exit(1);
  }
  const urls = [];
  const seen = new Set();
  const rl = readline.createInterface({
    input: fs.createReadStream(SRC, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    let d;
    try {
      d = JSON.parse(line);
    } catch (e) {
      continue;
    }
    const u = (d.url || '').trim();
    if (!u || !u.includes('autodoc.co.uk')) continue;
    if (u.includes('/tyres') || u.includes('trucks.autodoc') || u.includes('moto.autodoc')) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    urls.push({
      url: u,
      mode: MODE,
      identifier: d.identifier || u.split('/').pop(),
    });
    if (urls.length % 100000 === 0) console.log('...', urls.length);
    if (urls.length >= LIMIT) break;
  }

  fs.writeFileSync(OUT, JSON.stringify(urls));
  console.log(`Wrote ${urls.length} URLs to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
