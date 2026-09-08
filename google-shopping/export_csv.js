/**
 * Export Google Shopping card results from data/products/*.json
 */
const fs = require('fs');
const path = require('path');
const { csvItem } = require('./csv');

const DIR = 'data/products';
const OUT = process.env.OUT || 'google-shopping.csv';
const files = fs.existsSync(DIR)
  ? fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))
  : [];

const HEADER = [
  'product_name',
  'brand',
  'mpn',
  'gtin',
  'catalogid',
  'gpcid',
  'card_url',
  'card_title',
  'status',
  'verdict_tier',
  'proof_detail',
  'offers_seen_in_browser',
  'sellers_seen_by_api',
  'offer_list_complete',
  'competitor_count',
  'client_price_usd',
  'density',
  'note',
];

let csv = HEADER.join(',') + '\n';
const seen = new Set();
let ok = 0;
let failed = 0;

for (const file of files) {
  let arr;
  try {
    arr = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  } catch (e) {
    continue;
  }
  for (const p of arr || []) {
    if (!p) continue;
    const key = p.identifier || `${p.catalogid}|${p.gpcid}|${p.product_name}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const competitor =
      p.competitor_count == null || p.competitor_count === '' ? '' : p.competitor_count;
    csv += csvItem(p.product_name || p.title);
    csv += csvItem(p.brand);
    csv += csvItem(p.mpn);
    csv += csvItem(p.gtin);
    csv += csvItem(p.catalogid);
    csv += csvItem(p.gpcid);
    csv += csvItem(p.card_url || p.url);
    csv += csvItem(p.card_title);
    csv += csvItem(p.status);
    csv += csvItem(p.verdict_tier);
    csv += csvItem(p.proof_detail);
    csv += csvItem(p.offers_seen_in_browser);
    csv += csvItem(p.sellers_seen_by_api);
    csv += csvItem(p.offer_list_complete);
    csv += csvItem(competitor);
    csv += csvItem(p.client_price_usd);
    csv += csvItem(p.density);
    csv += csvItem(p.note, true);
    csv += '\n';
    ok += 1;
    if (p.status && p.status !== 'ok') failed += 1;
  }
}

fs.writeFileSync(OUT, '\ufeff' + csv, 'utf8');
console.log(`ok=${ok} failed_status=${failed} -> ${OUT}`);
