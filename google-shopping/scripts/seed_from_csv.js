const fs = require('fs');
const path = require('path');
const { csvToObjects } = require('../csv');
const { extractCardIdsFromUrl, buildCardUrl } = require('../card_url');
const { buildSearchQuery, shoppingSearchUrl } = require('../query');

const ROOT = path.join(__dirname, '..');
const CSV = path.join(ROOT, 'test-cards.csv');
const sampleOnly = process.argv.includes('--sample');
const searchMode = process.argv.includes('--search');
const oneOnly = process.argv.includes('--one');

function rowToTask(row) {
  const fromUrl = extractCardIdsFromUrl(row.card_url);
  const catalogid = row.catalogid || fromUrl.catalogid || '';
  const gpcid = row.gpcid || fromUrl.gpcid || '';
  const sellers = parseInt(row.sellers_seen_by_api, 10);
  const density = sellers === 1 ? 'sparse' : 'dense';
  const query = buildSearchQuery({ brand: row.brand, product_name: row.product_name });
  const cardUrl =
    catalogid || gpcid
      ? buildCardUrl({ q: fromUrl.q || query, catalogid, gpcid })
      : row.card_url;
  return {
    mode: 'card',
    product_name: row.product_name,
    brand: row.brand,
    mpn: row.mpn || '',
    gtin: row.gtin || '',
    client_price_usd: row.client_price_usd,
    expected_tier: row.verdict_tier,
    sellers_seen_by_api: Number.isFinite(sellers) ? sellers : null,
    density,
    catalogid,
    gpcid,
    url: cardUrl,
    search_url: shoppingSearchUrl(query),
    search_query: query,
    note: row.note || '',
  };
}

function main() {
  const rows = csvToObjects(fs.readFileSync(CSV, 'utf8'));
  if (!rows.length) {
    console.error('test-cards.csv is empty');
    process.exit(1);
  }
  const dense = rows.filter((r) => parseInt(r.sellers_seen_by_api, 10) > 1);
  const sparse = rows.filter((r) => parseInt(r.sellers_seen_by_api, 10) === 1);
  const sample = dense.slice(0, 3).concat(sparse.slice(0, 2)).map(rowToTask);
  fs.writeFileSync(path.join(ROOT, 'urls.sample.json'), JSON.stringify(sample, null, 2));
  let tasks = sampleOnly ? sample.slice() : rows.map(rowToTask);
  if (oneOnly) tasks = tasks.slice(0, 1);
  if (searchMode) {
    tasks = tasks.map((t) => ({
      ...t,
      mode: 'search',
      url: t.search_url,
    }));
  }
  fs.writeFileSync(path.join(ROOT, 'urls.json'), JSON.stringify(tasks, null, 2));
  console.log(
    `seeded ${tasks.length} task(s) -> urls.json (dense csv=${dense.length} sparse csv=${sparse.length}` +
      `${sampleOnly ? ' sample' : ' full'}${searchMode ? ' search' : ' card'}${oneOnly ? ' one' : ''})`
  );
}

main();
