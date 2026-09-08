/**
 * Quality-check the last crawl's data/products/*.json
 *
 *   node scripts/check_live_results.js
 */
const fs = require('fs');
const path = require('path');
const { looksLikeMerchant } = require('../parse');

const DIR = path.join(__dirname, '..', 'data', 'products');
const files = fs.existsSync(DIR)
  ? fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
  : [];

if (!files.length) {
  console.error('no data/products/*.json — run a crawl first');
  process.exit(1);
}

let failed = 0;
function fail(msg) {
  failed += 1;
  console.error('FAIL:', msg);
}
function ok(msg) {
  console.log('ok:', msg);
}

let denseOk = 0;
let sparseEmpty = 0;
let searchWithCandidates = 0;

for (const file of files) {
  let arr;
  try {
    arr = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  } catch (e) {
    fail(`${file} is not JSON`);
    continue;
  }
  const row = Array.isArray(arr) ? arr[0] : arr;
  if (!row) {
    fail(`${file} empty`);
    continue;
  }
  const label = `${file} ${row.product_name || ''}`;
  if (!['ok', 'looked_empty', 'fetch_failed', 'no_candidates', 'candidates_unproven'].includes(row.status)) {
    fail(`${label} unknown status ${row.status}`);
  }
  if (row.status === 'ok' && row.competitor_count == null) {
    fail(`${label} ok but competitor_count is null`);
  }
  if (row.status !== 'ok' && row.competitor_count != null) {
    fail(`${label} ${row.status} should not claim a competitor_count`);
  }
  if (/^about this page$/i.test(row.card_title || '')) {
    fail(`${label} generic card_title`);
  }
  for (const offer of row.offers || []) {
    if (offer.merchant && !looksLikeMerchant(offer.merchant)) {
      fail(`${label} junk merchant "${offer.merchant}"`);
    }
  }
  if (row.density === 'dense') {
    if (row.status === 'ok' && (row.offers_seen_in_browser || 0) >= 1) denseOk += 1;
    else fail(`${label} dense card expected offers, got status=${row.status} offers=${row.offers_seen_in_browser}`);
    if (row.catalogid || row.gpcid) ok(`${label} ids ${row.catalogid || '-'} / ${row.gpcid || '-'}`);
  }
  if (row.density === 'sparse' && row.status === 'looked_empty') sparseEmpty += 1;
  if ((row.candidates || []).length) searchWithCandidates += 1;
  ok(
    `${label} status=${row.status} offers=${row.offers_seen_in_browser} tier=${row.verdict_tier} title=${(row.card_title || '').slice(0, 40)}`
  );
}

ok(`rows=${files.length} dense_ok=${denseOk} sparse_empty=${sparseEmpty} with_candidates=${searchWithCandidates}`);
if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log('live results look consistent');
