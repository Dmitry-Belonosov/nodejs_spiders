/**
 * Offline parse check against HTML dumped by scripts/probe_structure.js
 * or curl. Usage:
 *   node scripts/test_parse.js /tmp/jl-brands.html brands
 *   node scripts/test_parse.js /tmp/jl-brand.html listing
 *   node scripts/test_parse.js /tmp/jl-pdp.html pdp
 */
const fs = require('fs');
const { parseJohnLewisHtml, looksLikeBlocked } = require('../parse');

const file = process.argv[2];
const mode = process.argv[3] || '';
if (!file) {
  console.error('usage: node scripts/test_parse.js <html> [mode]');
  process.exit(1);
}
const html = fs.readFileSync(file, 'utf8');
const pageUrl =
  process.argv[4] ||
  (mode === 'brands'
    ? 'https://www.johnlewis.com/brands'
    : mode === 'pdp'
      ? 'https://www.johnlewis.com/x/p1'
      : 'https://www.johnlewis.com/brand/x/_/N-1');
console.log('blocked', looksLikeBlocked(html, pageUrl));
const parsed = parseJohnLewisHtml(html, pageUrl, mode || undefined);
console.log('mode', parsed.mode);
console.log('links', (parsed.links || []).length);
console.log('products', (parsed.products || []).length);
const listingPages = (parsed.links || []).filter((l) => l.mode === 'listing' && /[?&]page=/.test(l.url));
const listingOther = (parsed.links || []).filter((l) => l.mode === 'listing' && !/[?&]page=/.test(l.url));
const pdps = (parsed.links || []).filter((l) => l.mode === 'pdp');
if (parsed.mode === 'listing') {
  console.log('pdp links', pdps.length, 'page links', listingPages.length, 'facet/other listing', listingOther.length);
  const maxPage = listingPages.reduce((m, l) => {
    const n = parseInt(new URL(l.url).searchParams.get('page') || '0', 10);
    return n > m ? n : m;
  }, 0);
  console.log('max page queued', maxPage);
}
if (parsed.links && parsed.links[0]) console.log('sample link', parsed.links[0]);
if (parsed.products && parsed.products[0]) {
  console.log('sample product', JSON.stringify(parsed.products[0], null, 2));
}
