/**
 * Export CSV from data/products/*.json
 */
const fs = require('fs');
const path = require('path');

function csvItem(val, last) {
  const s = val == null ? '' : String(val);
  const out = '"' + s.replace(/"/g, '""') + '"';
  return last ? out : out + ',';
}

const DIR = 'data/products';
const OUT = process.env.OUT || 'autodoc.csv';
const files = fs.existsSync(DIR)
  ? fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))
  : [];

let csv =
  'identifier,name,sku,price,stock,brand,category,image_url,url,shipping_cost,ean,mpn,condition,discount,headline_price\n';
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
    if (!p || !p.identifier || seen.has(p.identifier)) continue;
    seen.add(p.identifier);
    const md = p.metadata || {};
    csv += csvItem(p.identifier);
    csv += csvItem(p.name);
    csv += csvItem(p.sku);
    csv += csvItem(p.price);
    csv += csvItem(p.stock == null ? '' : p.stock);
    csv += csvItem(p.brand);
    csv += csvItem(p.category);
    csv += csvItem(p.image_url);
    csv += csvItem(p.url);
    csv += csvItem(p.shipping_cost || '');
    csv += csvItem(md.EAN || '');
    csv += csvItem(md.MPN || '');
    csv += csvItem(md.Condition || '');
    csv += csvItem(md['Discount_%'] || '');
    csv += csvItem(md.headline_price || '', true);
    csv += '\n';
    ok += 1;
  }
}

fs.writeFileSync(OUT, '\ufeff' + csv, 'utf8');
console.log(`ok=${ok} -> ${OUT}`);
