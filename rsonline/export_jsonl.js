/**
 * Merge data/products/*.json into rsonline.jsonl, one product per line.
 */
const fs = require('fs');
const path = require('path');

const DIR = 'data/products';
const OUT = process.env.OUT || 'rsonline.jsonl';

if (!fs.existsSync(DIR)) {
  console.error(`No ${DIR} — nothing has been crawled yet`);
  process.exit(1);
}

const files = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

const seen = new Set();
let written = 0;
const out = fs.createWriteStream(OUT, { encoding: 'utf8' });

for (const file of files) {
  let products;
  try {
    products = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  } catch (e) {
    continue; // a damaged checkpoint must not abort the export
  }
  if (!Array.isArray(products)) continue;
  for (const product of products) {
    if (!product || !product.identifier || seen.has(product.identifier)) continue;
    seen.add(product.identifier);
    out.write(`${JSON.stringify(product)}\n`);
    written += 1;
  }
}

out.end();
console.log(`Wrote ${written} unique products -> ${OUT}`);
