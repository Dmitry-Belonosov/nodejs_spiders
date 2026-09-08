/**
 * Export data/products/*.json into rsonline.csv.
 *
 * The column set matches the other spiders on the platform so the delivered
 * files line up across sites. `mpn` is appended because RS Online publishes a
 * manufacturer part number but no GTIN.
 */
const fs = require('fs');
const path = require('path');

const DIR = 'data/products';
const OUT = process.env.OUT || 'rsonline.csv';

const COLUMNS = [
  'identifier',
  'name',
  'sku',
  'price',
  'stock',
  'brand',
  'category',
  'image_url',
  'url',
  'shipping_cost',
  'gtin',
  'lead_time',
  'condition',
  'discount_%',
  'old_price',
  'mpn',
];

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function rowFor(product) {
  const md = product.metadata || {};
  return [
    product.identifier,
    product.name,
    product.sku,
    product.price,
    product.stock == null ? '' : product.stock,
    product.brand,
    product.category,
    product.image_url,
    product.url,
    product.shipping_cost == null ? '' : product.shipping_cost,
    md.gtin || '',
    md.lead_time || '',
    md.Condition || '',
    md['discount_%'] || '',
    md.old_price || '',
    md.mpn || '',
  ];
}

const files = fs.existsSync(DIR)
  ? fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
  : [];

const seen = new Set();
const lines = [COLUMNS.join(',')];
let skipped = 0;

for (const file of files) {
  let products;
  try {
    products = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  } catch (e) {
    skipped += 1;
    continue;
  }
  if (!Array.isArray(products)) continue;
  for (const product of products) {
    if (!product || !product.identifier || seen.has(product.identifier)) continue;
    seen.add(product.identifier);
    lines.push(rowFor(product).map(csvCell).join(','));
  }
}

// The BOM keeps Excel from mangling non-ASCII product names.
fs.writeFileSync(OUT, `\ufeff${lines.join('\n')}\n`, 'utf8');
console.log(`ok=${seen.size} skipped=${skipped} -> ${OUT}`);
