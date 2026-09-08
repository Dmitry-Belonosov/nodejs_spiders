/**
 * Export CSV from data/products/*.json
 * Columns match Portmerion john1.js / john_portmeirion.js.
 */
const fs = require('fs');
const path = require('path');

function csvItem(val, last) {
  const s = val == null ? '' : String(val);
  const out = '"' + s.replace(/"/g, '""') + '"';
  return last ? out : out + ',';
}

const DIR = 'data/products';
const OUT = process.env.OUT || 'johnlewis.csv';
const files = fs.existsSync(DIR)
  ? fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))
  : [];

let csv =
  'title,differentiators,price,old_price,promo1,promo2,promo3,lead_time,category,stock,sku,brand,image_url,url\n';
const seen = new Set();
let ok = 0;

for (const file of files) {
  let arr;
  try {
    arr = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  } catch (e) {
    continue;
  }
  for (const p of arr || []) {
    if (!p) continue;
    const key = p.sku || p.identifier || p.url;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    csv += csvItem(p.title || p.name);
    csv += csvItem(p.differentiators);
    csv += csvItem(p.price);
    csv += csvItem(p.old_price);
    csv += csvItem(p.promo1);
    csv += csvItem(p.promo2);
    csv += csvItem(p.promo3);
    csv += csvItem(p.lead_time);
    csv += csvItem(p.category);
    csv += csvItem(p.stock == null ? '' : p.stock);
    csv += csvItem(p.sku || p.identifier);
    csv += csvItem(p.brand);
    csv += csvItem(p.image_url);
    csv += csvItem(p.url, true);
    csv += '\n';
    ok += 1;
  }
}

fs.writeFileSync(OUT, '\ufeff' + csv, 'utf8');
console.log(`ok=${ok} -> ${OUT}`);
