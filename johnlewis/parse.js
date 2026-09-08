/**
 * Parse johnlewis.com HTML (__NEXT_DATA__) into brands, listing links, and
 * product variant rows. Field names match Portmerion/john1.js:
 * title, differentiators, price, old_price, promo1-3, lead_time, category,
 * stock, sku, brand, image_url, url.
 */
const HOST = 'www.johnlewis.com';
const ORIGIN = `https://${HOST}`;

function cleanText(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function absUrl(href, pageUrl) {
  if (!href) return '';
  try {
    return new URL(href, pageUrl || ORIGIN).href;
  } catch (e) {
    return '';
  }
}

function imageUrl(src) {
  if (!src) return '';
  let s = String(src).trim();
  if (s.startsWith('//')) s = `https:${s}`;
  return s.replace(/\?.*$/, '');
}

function productIdFromUrl(u) {
  const m = String(u || '').match(/\/p(\d+)(?:[/?#]|$)/i);
  return m ? m[1] : '';
}

function prepareUrl(pageUrl, href) {
  const url = absUrl(href, pageUrl);
  if (!url || !url.includes('johnlewis.com')) return '';
  try {
    const u = new URL(url);
    u.hash = '';
    u.searchParams.delete('cur');
    // Colour-specific PDP paths (/slug/colour/pID) collapse to /slug/pID —
    // all options live on the parent product JSON.
    const pid = productIdFromUrl(u.pathname);
    if (pid) {
      const parts = u.pathname.split('/').filter(Boolean);
      const slug = parts[0] && !/^p\d+$/i.test(parts[0]) ? parts[0] : '';
      u.pathname = slug ? `/${slug}/p${pid}` : `/p${pid}`;
      u.search = '';
    }
    return u.toString();
  } catch (e) {
    return url;
  }
}

function extractNextData(html) {
  const m = String(html || '').match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    return null;
  }
}

function looksLikeBlocked(html, pageUrl, status) {
  const body = String(html || '');
  if (status && [403, 407, 429, 500, 502, 503, 504].includes(status)) return true;
  if (!body.trim()) return true;
  if (/Access Denied|You don't have permission to access|Pardon Our Interruption/i.test(body)) {
    return true;
  }
  if (/Reference #\d+\.\w+/i.test(body) && body.length < 20000) return true;
  if (/Just a moment/i.test(body) && /cf-browser-verification|challenge-platform/i.test(body)) {
    return true;
  }
  if (/Checking your browser|Verify you are human/i.test(body) && body.length < 40000) return true;
  if (/I am human/i.test(body) && /hcaptcha/i.test(body)) return true;
  const next = extractNextData(html);
  // Live pages are 400k+ with __NEXT_DATA__. A 3k shell is an Akamai/challenge
  // interstitial — treat it as blocked so workers back off instead of hammering.
  if (body.length < 8000 && !next) return true;
  const path = String(pageUrl || '');
  if (path.includes('/brands') && (!next || !(next.props && next.props.pageProps && next.props.pageProps.brands))) {
    if (body.length < 15000) return true;
  }
  if (/\/p\d+/.test(path) && next) {
    const product = next.props && next.props.pageProps && next.props.pageProps.product;
    if (!product) return body.length < 20000;
  }
  return false;
}

function detectMode(pageUrl, modeHint) {
  if (modeHint) return modeHint;
  const u = String(pageUrl || '');
  if (/\/p\d+(?:[/?#]|$)/.test(u)) return 'pdp';
  if (/\/brands\/?(\?|$)/.test(u) || u.endsWith('/brands')) return 'brands';
  if (/\/brand\//.test(u)) return 'listing';
  if (/johnlewis\.com\/?(\?|$)/.test(u)) return 'home';
  return 'listing';
}

function parseBrands(next, pageUrl) {
  const brands = (next && next.props && next.props.pageProps && next.props.pageProps.brands) || {};
  const links = [];
  const seen = new Set();
  for (const letter of Object.keys(brands)) {
    for (const item of brands[letter] || []) {
      const href = item && item.navigationState;
      const url = prepareUrl(pageUrl, href);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      links.push({
        url,
        mode: 'listing',
        brand: item.label || '',
        count: item.count || '',
      });
    }
  }
  return links;
}

const LISTING_RESULT_CAP = 10000;
const SPLIT_FACET_DIMS = ['Store.PrimaryCategory', 'producttype1', 'childSKUs.basicColor', 'price'];

function facetDetails(pld, dim) {
  const facet = ((pld && pld.facets) || []).find((f) => f && f.dimensionName === dim);
  return (facet && facet.details) || [];
}

function facetQtySum(details) {
  return (details || []).reduce((sum, d) => sum + (parseInt(d && d.qty, 10) || 0), 0);
}

function listingPageUrl(base, pageNum) {
  const u = new URL(base);
  if (pageNum <= 1) u.searchParams.delete('page');
  else u.searchParams.set('page', String(pageNum));
  return u.toString();
}

function listingLooksCapped(pld, pagesAvailable, perPage) {
  const results = parseInt(pld && pld.results, 10) || 0;
  if (results >= LISTING_RESULT_CAP) return true;
  if (pagesAvailable > 0 && perPage > 0 && results > pagesAvailable * perPage) return true;
  const catSum = facetQtySum(facetDetails(pld, 'Store.PrimaryCategory'));
  const typeSum = facetQtySum(facetDetails(pld, 'producttype1'));
  if (catSum > results + 20 || typeSum > results + 20) return true;
  return false;
}

function parseListing(next, pageUrl) {
  const pld =
    (next && next.props && next.props.pageProps && next.props.pageProps.productListingData) || {};
  const links = [];
  const seen = new Set();
  function push(href, mode) {
    const url = prepareUrl(pageUrl, href);
    if (!url || seen.has(url)) return;
    seen.add(url);
    links.push({ url, mode });
  }

  for (const prod of pld.products || []) {
    push(prod.url || '', 'pdp');
    // Colour swatches sometimes point at a different pID; same-pID colours
    // collapse onto the parent PDP where all SKUs already live.
    for (const swatch of prod.colorSwatches || []) {
      push(swatch.canonicalURL || '', 'pdp');
    }
  }

  const rawPages = parseInt(pld.pagesAvailable, 10);
  const perPage = (pld.products || []).length || 24;
  const results = parseInt(pld.results, 10) || 0;
  let pagesAvailable = Number.isFinite(rawPages) && rawPages > 0 ? rawPages : 0;
  if (!pagesAvailable && results) pagesAvailable = Math.ceil(results / perPage);
  if (!pagesAvailable) pagesAvailable = 1;

  let currentPage = 1;
  try {
    currentPage = parseInt(new URL(pageUrl).searchParams.get('page') || '1', 10) || 1;
  } catch (e) {}

  const base = prepareUrl(pageUrl, pld.baseFacetUrl || pageUrl) || pageUrl;
  try {
    new URL(base);
    // Queue every remaining page from this response. Chaining page N → N+1
    // dies if a middle listing fails, which is how later brand pages got dropped.
    for (let page = 1; page <= pagesAvailable; page += 1) {
      if (page === currentPage) continue;
      push(listingPageUrl(base, page), 'listing');
    }
    // If the JSON omitted pagesAvailable but this page is full, keep walking.
    if (!Number.isFinite(rawPages) && (pld.products || []).length >= 20) {
      push(listingPageUrl(base, currentPage + 1), 'listing');
    }
  } catch (e) {}

  // Own-brand (and any other huge listing) is capped at 10k results. Split by
  // category / product type so the rest of the catalogue is still reachable.
  if (currentPage === 1 && listingLooksCapped(pld, pagesAvailable, perPage)) {
    for (const dim of SPLIT_FACET_DIMS) {
      const details = facetDetails(pld, dim);
      if (details.length < 2) continue;
      let added = 0;
      for (const detail of details) {
        if (!detail || detail.isSelected === 'true' || detail.isSelected === true) continue;
        if (!detail.facetUrl) continue;
        const before = links.length;
        push(detail.facetUrl, 'listing');
        if (links.length > before) added += 1;
      }
      if (added) break;
    }
  }

  return { links, results, pagesAvailable };
}

function differentiatorsText(vari) {
  const diff = (vari && vari.differentiators) || {};
  const parts = [];
  for (const key of Object.keys(diff)) {
    const val = diff[key];
    if (val) parts.push(String(val));
  }
  return parts.join(',');
}

function promoTitles(vari, product) {
  const msgs = (vari && vari.messaging && vari.messaging.length
    ? vari.messaging
    : (product && product.messaging) || []) || [];
  return [msgs[0] && msgs[0].title, msgs[1] && msgs[1].title, msgs[2] && msgs[2].title].map(
    (t) => cleanText(t || '')
  );
}

function categoryText(product) {
  const crumbs = (product && product.browsePageHierarchy) || [];
  return crumbs
    .slice(1)
    .map((c) => cleanText(c && c.name))
    .filter(Boolean)
    .join(' > ');
}

function leadTime(vari, product) {
  const avail = (vari && vari.availability) || {};
  const future =
    (avail.futureAvailability && avail.futureAvailability.availableToOrderFromMessage) || '';
  const pre = (avail.preOrder && avail.preOrder.streetDateMessage) || '';
  if (future) return cleanText(future);
  if (pre) return cleanText(pre);
  const opts = (product && product.fulfilmentOptions && product.fulfilmentOptions.available) || [];
  if (opts[0] && opts[0].shortDescription) return cleanText(opts[0].shortDescription);
  return '';
}

function variantRow(product, vari, pageUrl) {
  const sku = (vari.aliases && vari.aliases.skuId) || '';
  const price = vari.price && vari.price.value != null ? String(vari.price.value) : '';
  const hist = (vari.price && vari.price.reductionHistory) || [];
  const oldPrice = hist.length && hist[0].value != null ? String(hist[0].value) : '';
  const [promo1, promo2, promo3] = promoTitles(vari, product);
  const available = !(vari.availability && vari.availability.availableToOrder === false);
  const brand = (product.brand && product.brand.name) || product.brand || '';
  const img = imageUrl(vari.images && vari.images.primary);
  const path = vari.canonicalURL || (product.canonicalURL) || '';
  const url = absUrl(path, pageUrl);
  return {
    identifier: sku,
    title: cleanText(vari.title || product.title || ''),
    differentiators: differentiatorsText(vari),
    price,
    old_price: oldPrice,
    promo1,
    promo2,
    promo3,
    lead_time: leadTime(vari, product),
    category: categoryText(product),
    stock: available ? '' : '0',
    sku,
    brand: cleanText(String(brand)),
    image_url: img,
    url,
    name: cleanText(vari.title || product.title || ''),
  };
}

function parsePdp(next, pageUrl) {
  const product = next && next.props && next.props.pageProps && next.props.pageProps.product;
  if (!product) return { products: [], links: [] };
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const products = variants.length
    ? variants.map((vari) => variantRow(product, vari, pageUrl)).filter((r) => r.sku || r.title)
    : [];
  const links = [];
  const seenVarIds = new Set(variants.map((v) => v && v.id).filter(Boolean));
  let groupVarCount = 0;
  for (const group of product.variantGroups || []) {
    for (const gv of (group && group.variants) || []) {
      if (gv && gv.id) groupVarCount += 1;
    }
    const href = group && group.pdpURL && (group.pdpURL.url || group.pdpURL.path);
    if (href) links.push({ url: href, mode: 'pdp' });
  }
  // Colour-group URLs are only useful when this HTML is missing SKUs that
  // the groups advertise. Same-pID colour paths still collapse in prepareUrl.
  if (groupVarCount && groupVarCount <= seenVarIds.size) {
    links.length = 0;
  }
  if (products.length) return { products, links };
  // Bundle / missing variants: emit the parent as a single row.
  const fake = {
    title: product.title,
    canonicalURL: product.canonicalURL,
    aliases: (product.aliases && { skuId: product.aliases.pimProductId }) || {},
    price:
      (product.variantPriceRange && product.variantPriceRange.value && {
        value: product.variantPriceRange.value.min,
        reductionHistory: [],
      }) ||
      { value: '', reductionHistory: [] },
    availability: product.availability || { availableToOrder: true },
    images: { primary: '' },
    differentiators: {},
    messaging: product.messaging || [],
  };
  const row = variantRow(product, fake, pageUrl);
  return { products: row.sku || row.title ? [row] : [], links };
}

function parseJohnLewisHtml(html, pageUrl, modeHint) {
  const mode = detectMode(pageUrl, modeHint);
  const next = extractNextData(html);

  if (mode === 'home') {
    return { mode, products: [], links: [{ url: `${ORIGIN}/brands`, mode: 'brands' }] };
  }

  if (mode === 'brands') {
    return { mode, products: [], links: parseBrands(next, pageUrl) };
  }

  if (mode === 'pdp' || productIdFromUrl(pageUrl)) {
    const pdp = parsePdp(next, pageUrl);
    return { mode: 'pdp', products: pdp.products || [], links: pdp.links || [] };
  }

  const listing = parseListing(next, pageUrl);
  return { mode: 'listing', products: [], links: listing.links };
}

module.exports = {
  parseJohnLewisHtml,
  prepareUrl,
  looksLikeBlocked,
  extractNextData,
  detectMode,
  productIdFromUrl,
  HOST,
  ORIGIN,
  cleanText,
};
