/**
 * Build the Google Shopping search query from a client catalogue row.
 *
 * Brand + name works better than name alone. Strip the retailer's own variant
 * syntax before searching, then match the variant back on the card afterwards.
 */
const VARIANT_FIELD =
  'Size|Pack Of|Pack of|Thread Size|Tubing Size|MPT Size|FPT Size|Radius|Pattern|Arc|Outlet|PSI|Zones|Stations|Wall Thickness|Emitter Spacing|Flow Rate|Roll Length|Spacing|Model|HorsePower|Phase|Voltage|HP|Base Type';

const VARIANT_TAIL = new RegExp(`\\s+-\\s+(?:${VARIANT_FIELD})\\b.*$`, 'i');

function stripClientVariantSyntax(name) {
  return String(name || '')
    .replace(VARIANT_TAIL, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeInches(text) {
  return String(text || '')
    .replace(/(\d+(?:\s+\d+)?(?:\s*\/\s*\d+)?)\s*["”]/g, '$1 in')
    .replace(/(\d+)\s*['’](?!s\b)/g, '$1 ft')
    .replace(/\s+/g, ' ')
    .trim();
}

function needsQuotes(q) {
  return /[,"()\/]/.test(q) || /\d+\s*\/\s*\d+/.test(q) || /\bin\b/.test(q);
}

function buildSearchQuery({ brand, product_name, quote } = {}) {
  const stripped = stripClientVariantSyntax(product_name);
  const name = normalizeInches(stripped);
  const parts = [brand, name].map((s) => String(s || '').trim()).filter(Boolean);
  let q = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (!q) return '';
  const shouldQuote = quote === true || (quote !== false && needsQuotes(q));
  if (shouldQuote) {
    q = `"${q.replace(/"/g, '')}"`;
  }
  return q;
}

function shoppingSearchUrl(query, extra = {}) {
  // udm=28 is the Shopping results grid. ibp=oshop without catalogid/gpcid is
  // the product overlay, which comes back empty ("Details aren't available").
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('gl', extra.gl || 'us');
  params.set('hl', extra.hl || 'en');
  params.set('udm', extra.udm || '28');
  return `https://www.google.com/search?${params.toString()}`;
}

module.exports = {
  VARIANT_FIELD,
  stripClientVariantSyntax,
  normalizeInches,
  buildSearchQuery,
  shoppingSearchUrl,
};
