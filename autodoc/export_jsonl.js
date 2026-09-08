/**
 * Merge data/products/*.json into autodoc.jsonl (Scrapy-compatible field shape).
 */
const fs = require('fs');
const path = require('path');

const DIR = 'data/products';
const OUT = process.env.OUT || 'autodoc.jsonl';

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
    if (!p || !p.identifier) continue;
    if (seen.has(p.identifier)) continue;
    seen.add(p.identifier);
    out.write(JSON.stringify(p) + '\n');
    written += 1;
  }
}

out.end();
console.log(`Wrote ${written} unique products -> ${OUT}`);
