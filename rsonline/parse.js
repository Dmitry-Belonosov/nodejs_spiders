/**
 * Parse uk.rs-online.com PDP HTML into product objects.
 *
 * RS Online embeds a complete schema.org Product block in the page, so the
 * fields come from JSON-LD rather than from CSS selectors. That survives
 * markup changes far better, which matters for a site behind Akamai where
 * re-fetching a page to debug a selector is expensive.
 *
 * The product shape matches the other spiders on the platform (bueromarkt),
 * so the CSV columns line up across sites.
 */

const JSON_LD_RE = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

// The CDN returns this placeholder for products that have no photo; it is a
// dead link rather than an image, so it is not worth passing on.
const PLACEHOLDER_IMAGE_RE = /\/undefined$|noImage\.png$/i;

function cleanText(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function extractPrice(text) {
  if (text == null || text === '') return 0;
  const t = String(text).replace(/[^\d.,]/g, '').replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

/** Every JSON-LD node in the page, with @graph containers flattened out. */
function jsonLdNodes(html) {
  const nodes = [];
  JSON_LD_RE.lastIndex = 0;
  let match;
  while ((match = JSON_LD_RE.exec(html || '')) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      continue; // a single malformed block must not lose the rest of the page
    }
    const stack = Array.isArray(data) ? data.slice() : [data];
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== 'object') continue;
      if (Array.isArray(node['@graph'])) stack.push(...node['@graph']);
      nodes.push(node);
    }
  }
  return nodes;
}

function hasType(node, type) {
  const t = node && node['@type'];
  return Array.isArray(t) ? t.includes(type) : t === type;
}

function firstOffer(product) {
  const offers = product && product.offers;
  if (!offers) return null;
  return Array.isArray(offers) ? offers[0] || null : offers;
}

function getPrice(html, product) {
  // The rendered price is the one the customer sees; the JSON-LD offer can lag
  // behind it on promotional pages, so it wins when both are present.
  const inline = String(html || '').match(/"product_page_price"\s*:\s*"([\d.]+)"/);
  if (inline) return extractPrice(inline[1]);
  const offer = firstOffer(product);
  return offer && offer.price != null ? extractPrice(offer.price) : 0;
}

/** RS lists a "was" price only on promotions, under several possible keys. */
function getOldPrice(product) {
  const offer = firstOffer(product);
  if (!offer) return 0;
  const spec = offer.priceSpecification;
  const specs = Array.isArray(spec) ? spec : spec ? [spec] : [];
  for (const s of specs) {
    const value = s && (s.price != null ? s.price : s.minPrice);
    if (value != null && String(s['@type'] || '').match(/List|Strikethrough|Reference/i)) {
      return extractPrice(value);
    }
  }
  return extractPrice(offer.listPrice != null ? offer.listPrice : '');
}

function getStock(product) {
  const offer = firstOffer(product);
  const availability = String((offer && offer.availability) || '');
  if (!availability) return '';
  if (/OutOfStock|SoldOut|Discontinued/i.test(availability)) return 0;
  if (/InStock|LimitedAvailability|PreOrder|BackOrder/i.test(availability)) return 1;
  return '';
}

function getBrand(product) {
  const brand = product && product.brand;
  if (!brand) return '';
  if (typeof brand === 'string') return cleanText(brand);
  return cleanText(brand.name);
}

/**
 * Full breadcrumb path, matching how the other spiders report category.
 * The first crumb is the shop root and carries no information.
 */
function getCategory(html, product) {
  for (const node of jsonLdNodes(html)) {
    if (!hasType(node, 'BreadcrumbList') || !Array.isArray(node.itemListElement)) continue;
    const names = node.itemListElement
      .slice()
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map((entry) => cleanText((entry.item && entry.item.name) || entry.name))
      .filter(Boolean);
    if (names.length) return names.join(' > ');
  }
  return typeof (product && product.category) === 'string' ? cleanText(product.category) : '';
}

function getImage(product) {
  const image = product && product.image;
  let url = '';
  if (typeof image === 'string') url = image;
  else if (Array.isArray(image)) url = image[0] || '';
  else if (image && image.url) url = image.url;
  url = cleanText(url);
  return PLACEHOLDER_IMAGE_RE.test(url) ? '' : url;
}

function getGtin(product) {
  for (const key of ['gtin13', 'gtin14', 'gtin12', 'gtin8', 'gtin']) {
    if (product && product[key]) return String(product[key]).trim();
  }
  return '';
}

function getDiscount(price, oldPrice) {
  const p = Number(price) || 0;
  const o = Number(oldPrice) || 0;
  if (!p || !o || o <= p) return null;
  return {
    discount_difference: String(+(o - p).toFixed(2)),
    'discount_%': String(Math.round(((o - p) / o) * 100)),
    old_price: String(o),
  };
}

function parseProduct(html, product, pageUrl) {
  const name = cleanText(product.name);
  const price = getPrice(html, product);
  // A page that yields no name or no price was not really parsed, whatever it
  // returned. Dropping it here keeps broken output out of the CSV.
  if (!name || price <= 0) return null;

  // RS stock number ("235-1607"), the identifier the catalogue is keyed on.
  const sku = cleanText(product.sku || product.mpn);
  const oldPrice = getOldPrice(product);

  const metadata = {
    mpn: cleanText(product.mpn),
    gtin: getGtin(product),
    lead_time: '',
    Condition: '',
  };
  const discount = getDiscount(price, oldPrice);
  if (discount) Object.assign(metadata, discount);

  return {
    identifier: sku,
    url: cleanText(product.url || product['@id']) || pageUrl,
    name,
    sku,
    brand: getBrand(product),
    price,
    category: getCategory(html, product),
    image_url: getImage(product),
    stock: getStock(product),
    // RS quotes delivery per basket rather than per product, so there is no
    // per-product figure to report.
    shipping_cost: 0,
    metadata,
  };
}

function parseRsonlineHtml(html, pageUrl) {
  const products = [];
  for (const node of jsonLdNodes(html)) {
    if (!hasType(node, 'Product')) continue;
    const parsed = parseProduct(html, node, pageUrl);
    if (parsed) products.push(parsed);
    break; // one PDP describes one product
  }
  // RS has no variant pages to discover; the key keeps the queue server's
  // interface identical across spiders.
  return { products, options: [] };
}

/**
 * Akamai serves a short "Access Denied" page instead of the product. It must be
 * told apart from a genuine parse failure, because the fix is to rotate the
 * proxy and retry rather than to look at the selectors.
 */
function looksLikeBlocked(html) {
  const s = String(html || '');
  if (s.length > 20000) return false;
  return (
    /Access Denied/i.test(s) ||
    /You don't have permission to access/i.test(s) ||
    /Reference&#32;&#35;|Reference #/i.test(s) ||
    (/_abck/.test(s) && s.length < 5000)
  );
}

/** A page worth saving: full length and carrying the product payload. */
function looksLikeProduct(html) {
  const s = String(html || '');
  return (
    s.length > 20000 &&
    (s.includes('application/ld+json') ||
      s.includes('product_page_price') ||
      /"@type"\s*:\s*"Product"/.test(s))
  );
}

module.exports = {
  parseRsonlineHtml,
  looksLikeBlocked,
  looksLikeProduct,
  extractPrice,
  jsonLdNodes,
};
