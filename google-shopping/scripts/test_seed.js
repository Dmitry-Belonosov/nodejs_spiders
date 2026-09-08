const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { assert, assertEq } = require('./assert');
const { csvToObjects } = require('../csv');

const csvPath = path.join(__dirname, '..', 'test-cards.csv');
const rows = csvToObjects(fs.readFileSync(csvPath, 'utf8'));
assertEq(rows.length, 50, 'csv has 50 products');
const dense = rows.filter((r) => parseInt(r.sellers_seen_by_api, 10) > 1);
const sparse = rows.filter((r) => parseInt(r.sellers_seen_by_api, 10) === 1);
assertEq(dense.length, 40, '40 dense cards');
assertEq(sparse.length, 10, '10 sparse cards');
assert(
  rows.every((r) => r.product_name && r.brand && r.card_url && r.verdict_tier),
  'required columns present'
);

const seed = spawnSync(process.execPath, [path.join(__dirname, 'seed_from_csv.js'), '--sample'], {
  cwd: path.join(__dirname, '..'),
  encoding: 'utf8',
});
assertEq(seed.status, 0, `seed --sample exits 0 (${seed.stderr || seed.stdout})`);
const urls = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'urls.json'), 'utf8'));
assert(urls.length >= 3 && urls.length <= 5, `sample seed size ${urls.length}`);
assert(
  urls.every((u) => u.mode === 'card' && u.url && u.search_url && u.density),
  'seeded tasks have mode/url/search_url/density'
);
assert(
  urls.some((u) => u.density === 'sparse'),
  'sample includes a sparse card'
);

console.log('test_seed.js passed');
