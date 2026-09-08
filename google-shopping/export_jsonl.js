/**
 * Merge data/products/*.json into google-shopping.jsonl (full offer lists).
 */
const fs = require('fs');
const path = require('path');

const DIR = 'data/products';
const OUT = process.env.OUT || 'google-shopping.jsonl';

if (!fs.existsSync(DIR)) {
  console.error('No', DIR);
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
  let arr;
  try {
    arr = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  } catch (e) {
    continue;
  }
  if (!Array.isArray(arr)) continue;
  for (const p of arr) {
    if (!p) continue;
    const key = p.identifier || `${p.catalogid}|${p.gpcid}|${p.product_name}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.write(JSON.stringify(p) + '\n');
    written += 1;
  }
}

out.end();
console.log(`Wrote ${written} unique rows -> ${OUT}`);
