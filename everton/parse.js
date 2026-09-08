/**
 * Parse store.evertonfc.com HTML into product objects matching the Scrapy
 * EvertonStoreSpider field shape (pdp-data JSON + size variants).
 */
const cheerio = require('cheerio');

const UK_HOST = 'store.evertonfc.com';
const NON_UK_HOSTS = [
  'eustore.evertonfc.com',
  'evertondirect3.evertonfc.com',
  'evertondirect.evertonfc.com',
];

function cleanText(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function canonicalizeUkHost(url) {
  if (!url) return url;
  let out = String(url);
  for (const host of NON_UK_HOSTS) {
    if (out.includes(host)) {
      out = out.replace(host, UK_HOST);
      break;
    }
  }
  return out;
}

function stripQueryParam(url, param) {
  try {
    const u = new URL(url);
    u.searchParams.delete(param);
    return u.toString();
  } catch (e) {
    return url;
  }
}

function setQueryParam(url, key, value) {
  try {
    const u = new URL(url);
    u.searchParams.set(key, value);
    return u.toString();
  } catch (e) {
    return url;
  }
}

/**
 * Match Scrapy prepare_url: UK host, GBP, pageSize/sort on listings.
 */
function prepareUrl(pageUrl, href) {
  if (!href) return '';
  let url;
  try {
    url = new URL(href, pageUrl || `https://${UK_HOST}/`).href;
  } catch (e) {
    return '';
  }
  url = canonicalizeUkHost(url);
  url = stripQueryParam(url, 'pageNumber');
  // Re-add pageNumber if it was the only useful nav param — prepare_url in
  // Scrapy cleans pageNumber then sets listing params. Keep absolute path.
  try {
    const original = new URL(href, pageUrl || `https://${UK_HOST}/`);
    const pageNumber = original.searchParams.get('pageNumber');
    url = setQueryParam(url, 'cur', 'GBP');
    if (!url.includes('/p-')) {
      url = setQueryParam(url, 'pageSize', '96');
      url = setQueryParam(url, 'sortOption', 'LowestPrice');
      if (pageNumber) url = setQueryParam(url, 'pageNumber', pageNumber);
    }
  } catch (e) {
    url = setQueryParam(url, 'cur', 'GBP');
  }
  return url;
}

function cleanProductUrl(url) {
  let out = canonicalizeUkHost(url);
  out = stripQueryParam(out, 'pageNumber');
  out = stripQueryParam(out, 'pageSize');
  out = stripQueryParam(out, 'sortOption');
  // Keep cur=GBP for consistency with Scrapy url_query_cleaner on product url
  // (Scrapy only strips pageNumber from product urls).
  try {
    const u = new URL(out);
    // Scrapy: url_query_cleaner(canonicalize(...)) — strips nothing else by default
    // except pageNumber already removed. Keep as-is minus pageNumber.
    return u.toString();
  } catch (e) {
    return out;
  }
}

function pickPrice(priceBlock) {
  if (!priceBlock || typeof priceBlock !== 'object') return null;
  for (const key of ['sale', 'discountPrice', 'regular', 'clearance']) {
    try {
      const money = (priceBlock[key] && priceBlock[key].money) || {};
      const val = money.userCurrencyValue || money.admCV;
      if (val) return val;
    } catch (e) {}
  }
  return null;
}

function getImageHost(data) {
  try {
    const host = data && data.initialAppContext && data.initialAppContext.imageHostname;
    if (host) return `https://${String(host).replace(/\/$/, '')}/`;
  } catch (e) {}
  return '';
}

function extractPdpData($) {
  let raw = null;
  $('script').each((_, el) => {
    if (raw) return;
    const txt = $(el).html() || $(el).text() || '';
    if (!txt.includes('pdp-data')) return;
    const m = txt.match(/(\{[\s\S]*\})/);
    if (m) raw = m[1];
  });
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function looksLikeBlocked(html, pageUrl, status) {
  const body = html || '';
  if (status && [403, 407, 500, 502, 503, 504].includes(status)) return true;
  if (/You don't have permission to access/i.test(body)) return true;
  if (/Access Denied/i.test(body)) return true;
  if (NON_UK_HOSTS.some((h) => (pageUrl || '').includes(h))) return true;
  if ((pageUrl || '').includes('/p-') && /chlgeId/i.test(body) && !/pdp-data/i.test(body)) {
    return true;
  }
  return false;
}

function parsePdp(data, pageUrl) {
  const pdp = (data && data['pdp-data'] && data['pdp-data'].pdp) || {};
  if (!pdp || !Object.keys(pdp).length) return [];

  const name = pdp.title || '';
  const identifier = String(pdp.productId || '');
  if (!name || !identifier) return [];

  const brand = (pdp.brandResource && pdp.brandResource.value) || '';
  const categories = (pdp.categories || [])
    .map((c) => c && c.categoryName)
    .filter(Boolean);
  const category = categories.join(' > ');

  const imageHost = getImageHost(data);
  const defaultImgPath =
    (((pdp.imageSelector || {}).defaultImage || {}).image || {}).src || '';
  const imageUrl = defaultImgPath ? imageHost + defaultImgPath : '';

  const priceVal = pickPrice(pdp.price || {});
  if (priceVal == null) return [];

  const sizes = pdp.sizes || [];
  const hasInventory = Boolean(pdp.hasInventory);
  const anySizeAvailable = sizes.some((s) => Boolean(s && s.available));
  const stock = hasInventory || anySizeAvailable ? 1 : 0;

  const base = {
    identifier,
    url: cleanProductUrl(pageUrl),
    name,
    sku: identifier,
    brand,
    price: priceVal,
    category,
    image_url: imageUrl,
    stock,
    shipping_cost: '',
  };

  if (!sizes.length) return [base];

  const products = [];
  for (const s of sizes) {
    const opt = { ...base };
    const optSize = (s && s.size) || '';
    if (optSize) {
      opt.name = `${opt.name} ${optSize}`;
      opt.identifier = `${opt.identifier}-${optSize}`;
      opt.sku = (s && s.itemId) || opt.sku;
    }
    if (s && Object.prototype.hasOwnProperty.call(s, 'available')) {
      opt.stock = s.available ? 1 : 0;
    }
    const sp = pickPrice((s && s.price) || {});
    if (sp) opt.price = sp;
    products.push(opt);
  }
  return products;
}

/**
 * Discover category / product / pagination links from a listing or home page.
 */
function extractLinks($, pageUrl) {
  const links = [];
  const seen = new Set();

  function push(href, mode) {
    const url = prepareUrl(pageUrl, href);
    if (!url || !url.includes('/en/')) return;
    if (!url.includes(UK_HOST) && !NON_UK_HOSTS.some((h) => url.includes(h))) return;
    if (seen.has(url)) return;
    seen.add(url);
    links.push({ url, mode });
  }

  // Categories (nav + /t- taxonomy)
  $('[role="menuitem"] > a').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href || href.startsWith('#')) return;
    push(href, 'listing');
  });
  $('[role="menuitem"] > a[href^="#"] + div a').each((_, el) => {
    push($(el).attr('href') || '', 'listing');
  });
  $('a[href*="/t-"]').each((_, el) => {
    push($(el).attr('href') || '', 'listing');
  });

  // Products
  $('a[data-talos="linkSearchResult"]').each((_, el) => {
    push($(el).attr('href') || '', 'pdp');
  });
  $('a[href*="/p-"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('/p-')) push(href, 'pdp');
  });

  // Pagination
  $('a[aria-label="next page"]').each((_, el) => {
    push($(el).attr('href') || '', 'listing');
  });
  $('a[href*="pageNumber"]').each((_, el) => {
    push($(el).attr('href') || '', 'listing');
  });

  return links;
}

function detectMode(pageUrl, modeHint) {
  if (modeHint === 'pdp' || modeHint === 'listing' || modeHint === 'home') return modeHint;
  if ((pageUrl || '').includes('/p-')) return 'pdp';
  return 'listing';
}

function parseEvertonHtml(html, pageUrl, modeHint) {
  const $ = cheerio.load(html || '');
  const mode = detectMode(pageUrl, modeHint);

  if (mode === 'pdp') {
    const data = extractPdpData($);
    const products = data ? parsePdp(data, pageUrl) : [];
    return { mode: 'pdp', products, links: [] };
  }

  // home / listing: discover more URLs; no products from listing HTML
  // (Scrapy only yields products from parse_product).
  const links = extractLinks($, pageUrl);
  return { mode, products: [], links };
}

module.exports = {
  parseEvertonHtml,
  prepareUrl,
  canonicalizeUkHost,
  looksLikeBlocked,
  pickPrice,
  UK_HOST,
  NON_UK_HOSTS,
  cleanText,
};
