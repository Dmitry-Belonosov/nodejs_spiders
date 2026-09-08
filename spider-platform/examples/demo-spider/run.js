/**
 * Fake spider: prints progress, writes a CSV in the usual format, exits 0.
 *
 * Used to verify scheduling, log streaming, artifact collection and SFTP
 * delivery without touching a real website.
 *
 *   DEMO_ROWS=50 DEMO_SECONDS=10 DEMO_FAIL=1 npm start
 */
const fs = require('fs');
const path = require('path');

const ROWS = parseInt(process.env.DEMO_ROWS || '25', 10);
const SECONDS = parseInt(process.env.DEMO_SECONDS || '8', 10);
const SHOULD_FAIL = process.env.DEMO_FAIL === '1';
const OUT = process.env.OUT || 'demo.csv';

const COLUMNS = ['identifier', 'name', 'sku', 'price', 'stock', 'brand', 'category', 'image_url', 'url'];

function csvCell(value) {
  const text = String(value == null ? '' : value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main() {
  console.log(`demo spider starting: ${ROWS} rows over ~${SECONDS}s`);
  console.log(`queue port from platform: ${process.env.PORT}, server ${process.env.SERVER}`);

  const rows = [];
  const stepMs = Math.max(1, Math.round((SECONDS * 1000) / ROWS));

  for (let i = 1; i <= ROWS; i += 1) {
    await new Promise((r) => setTimeout(r, stepMs));
    rows.push({
      identifier: `DEMO-${String(i).padStart(4, '0')}`,
      name: `Demo product ${i}`,
      sku: `SKU${1000 + i}`,
      price: (9.99 + i).toFixed(2),
      stock: i % 7 === 0 ? 'out of stock' : 'in stock',
      brand: 'DemoBrand',
      category: 'Demo/Category',
      image_url: `https://example.com/img/${i}.jpg`,
      url: `https://example.com/product/${i}`,
    });
    if (i % 5 === 0 || i === ROWS) {
      console.log(`progress ${i}/${ROWS} (${Math.round((i / ROWS) * 100)}%) | products ${rows.length}`);
    }
  }

  if (SHOULD_FAIL) {
    console.error('DEMO_FAIL=1 — exiting with an error before export');
    process.exit(2);
  }

  const lines = [COLUMNS.join(',')];
  for (const row of rows) lines.push(COLUMNS.map((c) => csvCell(row[c])).join(','));
  const outPath = path.join(__dirname, OUT);
  fs.writeFileSync(outPath, `\ufeff${lines.join('\n')}\n`, 'utf8');

  console.log(`exported ${rows.length} rows -> ${OUT}`);
  console.log('demo spider finished');
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
