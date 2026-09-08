/**
 * Parse Google Shopping SERP pages and product-card offer lists.
 * Prefer structured ids (catalogid/gpcid) over titles.
 */
const { extractCardIdsFromUrl, parsePrds, cardKey, buildCardUrl } = require('./card_url');
const { unwrapGoogleUrl, parsePrice, hostOf } = require('./proof');

function looksLikeBlocked(html, pageUrl, status) {
  const body = String(html || '');
  const url = String(pageUrl || '');
  if (status === 429 || status === 403) return true;
  if (/\/sorry\//i.test(url) || /google\.com\/sorry/i.test(body)) return true;
  if (/Our systems have detected unusual traffic/i.test(body)) return true;
  if (/detected unusual traffic from your computer/i.test(body)) return true;
  if (/\/sorry\/index/i.test(body)) return true;
  if (/<title[^>]*>\s*https:\/\/www\.google\.com\/sorry/i.test(body)) return true;
  if (/enable javascript[\s\S]{0,80}to continue/i.test(body) && body.length < 8000) return true;
  if (/recaptcha\/api|id="recaptcha"|g-recaptcha/i.test(body) && /unusual|sorry|not a robot/i.test(body)) {
    return true;
  }
  return false;
}

function looksLikeConsent(html, pageUrl) {
  const body = String(html || '');
  const url = String(pageUrl || '');
  if (/consent\.google\.com/i.test(url)) return true;
  if (/Before you continue to Google/i.test(body)) return true;
  if (/\bI agree\b/i.test(body) && /Sign in to Google/i.test(body) && body.length < 40000) return true;
  return false;
}

function looksLikeShoppingSurface(html, pageUrl) {
  const url = String(pageUrl || '');
  if (/[?&]udm=28\b/i.test(url) || /[?&]ibp=oshop\b/i.test(url) || /\/shopping/i.test(url)) return true;
  const body = String(html || '');
  return /catalogid:|gpcid:|udm=28|ibp=oshop/i.test(body);
}

function extractIdsFromText(text) {
  const src = String(text || '');
  const catalogid = (src.match(/catalogid[:\\"]+(\d{6,})/i) || [])[1] || '';
  const gpcid = (src.match(/gpcid[:\\"]+(\d{6,})/i) || [])[1] || '';
  return { catalogid, gpcid };
}

function allIdPairsFromText(text) {
  const src = String(text || '');
  const pairs = [];
  const seen = new Set();
  const prdsRe = /prds=([^"'&\s]+)/gi;
  let m;
  while ((m = prdsRe.exec(src))) {
    let raw = m[1];
    try {
      raw = decodeURIComponent(raw.replace(/\+/g, ' '));
    } catch (e) {}
    const prds = parsePrds(raw);
    const ids = { catalogid: prds.catalogid || '', gpcid: prds.gpcid || '' };
    const key = cardKey(ids);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    pairs.push(ids);
  }
  const combo = /catalogid[:\\"]+(\d{6,})[\s\S]{0,180}?gpcid[:\\"]+(\d{6,})/gi;
  while ((m = combo.exec(src))) {
    const ids = { catalogid: m[1], gpcid: m[2] };
    const key = cardKey(ids);
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push(ids);
  }
  const comboRev = /gpcid[:\\"]+(\d{6,})[\s\S]{0,180}?catalogid[:\\"]+(\d{6,})/gi;
  while ((m = comboRev.exec(src))) {
    const ids = { catalogid: m[2], gpcid: m[1] };
    const key = cardKey(ids);
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push(ids);
  }
  return pairs;
}

function decodeHref(href, baseUrl) {
  const raw = String(href || '').replace(/&amp;/g, '&');
  try {
    return new URL(raw, baseUrl || 'https://www.google.com/').toString();
  } catch (e) {
    return raw;
  }
}

function titleNearby(html, index) {
  const window = String(html || '').slice(Math.max(0, index - 400), index + 400);
  const t =
    (window.match(/aria-label="([^"]{8,180})"/i) || [])[1] ||
    (window.match(/title="([^"]{8,180})"/i) || [])[1] ||
    '';
  return t.replace(/\s+/g, ' ').trim();
}

function collectCandidateCards(html, pageUrl) {
  const src = String(html || '');
  const candidates = [];
  const seen = new Set();

  function add(ids, extra) {
    const catalogid = (ids && ids.catalogid) || '';
    const gpcid = (ids && ids.gpcid) || '';
    if (!catalogid && !gpcid) return;
    const key = cardKey({ catalogid, gpcid });
    if (!key || seen.has(key)) return;
    seen.add(key);
    const q = extra.q || extractCardIdsFromUrl(pageUrl).q || '';
    candidates.push({
      catalogid,
      gpcid,
      title: extra.title || '',
      url: extra.url || buildCardUrl({ q, catalogid, gpcid }),
      source: extra.source || 'html',
    });
  }

  const hrefRe = /href="([^"]+)"/gi;
  let m;
  while ((m = hrefRe.exec(src))) {
    const href = decodeHref(m[1], pageUrl);
    if (/preferences\/shopping/i.test(href)) continue;
    const ids = extractCardIdsFromUrl(href);
    add(ids, { title: titleNearby(src, m.index), url: href, source: 'href' });
  }

  for (const ids of allIdPairsFromText(src)) {
    add(ids, { source: 'embedded' });
  }

  return candidates;
}

const PRICE_RE = /\$\s*([\d,]+(?:\.\d{1,2})?)/;

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function walk(value, visit, depth) {
  if (value == null || depth > 14) return;
  visit(value);
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit, depth + 1);
  } else if (typeof value === 'object') {
    for (const item of Object.values(value)) walk(item, visit, depth + 1);
  }
}

function looksLikeMerchant(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 60) return false;
  if (PRICE_RE.test(s)) return false;
  if (/^https?:/i.test(s)) return false;
  if (/google|shopping|compare|visit site|delivery|free shipping|in stock/i.test(s)) return false;
  if (/^(typically|today'?s price|start point price|from|about|was|now|track|track price|tracking price|current price is|old price was|about this page)$/i.test(s)) {
    return false;
  }
  if (!/[A-Za-z]/.test(s)) return false;
  return true;
}

function extractOffersFromUnknownJson(data) {
  const offers = [];
  const seen = new Set();
  walk(
    data,
    (node) => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return;
      const merchant = node.merchant || node.seller || node.store || node.shop_name || node.source;
      const url = node.link || node.url || node.offer_link || node.merchant_link;
      const price = node.price || node.extracted_price || (node.offer && node.offer.price);
      const gtin = node.gtin || node.ean || node.barcode || node.upc;
      const mpn = node.mpn || node.sku || node.model_number;
      if (!merchant && !url && price == null) return;
      if (!merchant && !url) return;
      const key = `${merchant}|${url}|${price}`;
      if (seen.has(key)) return;
      seen.add(key);
      offers.push({
        merchant: merchant ? String(merchant) : '',
        price: parsePrice(price),
        price_raw: price == null ? '' : String(price),
        url: url ? unwrapGoogleUrl(String(url)) : '',
        gtin: gtin ? String(gtin) : '',
        mpn: mpn ? String(mpn) : '',
        source: 'json',
      });
    },
    0
  );
  return offers;
}

function extractEmbeddedJsonBlobs(html) {
  const blobs = [];
  const src = String(html || '');
  const jsonLd = /<script[^>]*type="application\/(?:ld\+)?json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = jsonLd.exec(src))) {
    const parsed = parseJsonSafe(m[1].trim());
    if (parsed) blobs.push(parsed);
  }
  const af = /AF_initDataCallback\((\{[\s\S]*?\})\);/g;
  while ((m = af.exec(src))) {
    const raw = m[1];
    const dataMatch = raw.match(/data:(\[[\s\S]*\])\s*(?:,\s*sideChannel|,?\s*\})/);
    if (dataMatch) {
      const parsed = parseJsonSafe(dataMatch[1]);
      if (parsed) blobs.push(parsed);
    }
  }
  return blobs;
}

function offersFromJsonLd(node, acc) {
  if (!node) return acc;
  const list = Array.isArray(node) ? node : [node];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const type = item['@type'];
    if (type === 'AggregateOffer' || type === 'Offer') {
      const offers = item.offers ? (Array.isArray(item.offers) ? item.offers : [item.offers]) : [item];
      for (const offer of offers) {
        if (!offer || typeof offer !== 'object') continue;
        const seller = offer.seller && (offer.seller.name || offer.seller);
        acc.push({
          merchant: seller ? String(seller) : '',
          price: parsePrice(offer.price),
          price_raw: offer.price == null ? '' : String(offer.price),
          url: offer.url ? unwrapGoogleUrl(String(offer.url)) : '',
          gtin: String(item.gtin13 || item.gtin12 || item.gtin || offer.gtin || ''),
          mpn: String(item.mpn || offer.mpn || ''),
          source: 'jsonld',
        });
      }
    }
    if (item['@graph']) offersFromJsonLd(item['@graph'], acc);
    if (item.offers && type && /Product/i.test(String(type))) offersFromJsonLd(item.offers, acc);
  }
  return acc;
}

function isJunkOffer(offer) {
  const url = String((offer && offer.url) || '');
  const merchant = String((offer && offer.merchant) || '');
  if (/gstatic\.com|\/xjs\/|policies\.google|support\.google|accounts\.google|google\.com\/url\?esrc/i.test(url)) {
    return true;
  }
  if (/accessibility|privacy|terms|footer links|sign in|help|information for merchants/i.test(merchant)) {
    return true;
  }
  if (!offer.price && !offer.gtin && !offer.mpn) return true;
  return false;
}

function filterOffers(offers) {
  return (offers || []).filter((o) => !isJunkOffer(o));
}

function parseOffersFromHtml(html, pageUrl) {
  const offers = [];
  const seen = new Set();
  function add(offer) {
    if (!offer) return;
    const merchant = String(offer.merchant || '').replace(/\s+/g, ' ').trim();
    const url = offer.url ? unwrapGoogleUrl(offer.url) : '';
    if (!merchant && !url) return;
    const key = `${merchant.toLowerCase()}|${hostOf(url)}|${offer.price || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    offers.push({
      merchant,
      price: offer.price == null ? null : offer.price,
      price_raw: offer.price_raw || (offer.price == null ? '' : String(offer.price)),
      url,
      gtin: offer.gtin || '',
      mpn: offer.mpn || '',
      source: offer.source || 'html',
    });
  }

  for (const blob of extractEmbeddedJsonBlobs(html)) {
    offersFromJsonLd(blob, []).forEach(add);
    extractOffersFromUnknownJson(blob).forEach(add);
  }

  const hrefRe =
    /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = hrefRe.exec(html || ''))) {
    const href = unwrapGoogleUrl(decodeHref(m[1], pageUrl));
    if (!/^https?:/i.test(href)) continue;
    if (/google\.(com|[a-z.]+)\//i.test(href) && !/\/url\?/i.test(m[1])) continue;
    const inner = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const around = String(html || '').slice(m.index, m.index + 500);
    const priceMatch = around.match(PRICE_RE) || String(html || '').slice(Math.max(0, m.index - 300), m.index + 200).match(PRICE_RE);
    const merchant = looksLikeMerchant(inner) ? inner : '';
    if (!merchant && !priceMatch) continue;
    if (merchant || /amazon|walmart|homedepot|lowes|ebay|target|dripdepot|zorotools|supplyhouse/i.test(href)) {
      add({
        merchant: merchant || hostOf(href),
        price: priceMatch ? parsePrice(priceMatch[0]) : null,
        price_raw: priceMatch ? priceMatch[0] : '',
        url: href,
        source: 'anchor',
      });
    }
  }

  // Merchant / price pairs in plain text blocks ("Home Depot  $7.62").
  const pairRe = /([A-Z][A-Za-z0-9&.'' +\-]{2,40})\s+\$(\d[\d,]*\.\d{2})/g;
  while ((m = pairRe.exec(html || ''))) {
    const merchant = m[1].replace(/\s+/g, ' ').trim();
    if (!looksLikeMerchant(merchant)) continue;
    add({
      merchant,
      price: parsePrice(m[2]),
      price_raw: `$${m[2]}`,
      url: '',
      source: 'text-pair',
    });
  }

  return offers;
}

function parseOffersFromXhr(bodies) {
  const offers = [];
  for (const body of bodies || []) {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    let data = typeof body === 'object' && body ? body : parseJsonSafe(text);
    if (!data) {
      const cleaned = text.replace(/^\)\]\}'\s*/, '');
      data = parseJsonSafe(cleaned);
    }
    if (data) {
      extractOffersFromUnknownJson(data).forEach((o) => offers.push(o));
      offersFromJsonLd(data, []).forEach((o) => offers.push(o));
    }
    allIdPairsFromText(text);
  }
  const seen = new Set();
  return offers.filter((o) => {
    const key = `${(o.merchant || '').toLowerCase()}|${o.url}|${o.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseOffersFromChunks(chunks) {
  const offers = [];
  const seen = new Set();
  for (const chunk of chunks || []) {
    const text = String(chunk.text || '').replace(/\s+/g, ' ').trim();
    const m = text.match(
      /\$(\d[\d,]*\.\d{2})(?:\$\d[\d,]*(?:\.\d{2})?)?\s+([A-Za-z][A-Za-z0-9&.'+\- ]{1,50}?)(?:\s+\d\.\d(?:\(\d+\))?)?\s*$/
    );
    if (!m) continue;
    const merchant = m[2].replace(/\s+/g, ' ').trim();
    if (!looksLikeMerchant(merchant)) continue;
    const price = parsePrice(m[1]);
    const href = chunk.href || '';
    const ids = extractCardIdsFromUrl(href);
    const key = `${merchant.toLowerCase()}|${price}|${ids.catalogid || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    offers.push({
      merchant,
      price,
      price_raw: `$${m[1]}`,
      url: href,
      catalogid: ids.catalogid || '',
      gpcid: ids.gpcid || '',
      gtin: '',
      mpn: '',
      source: 'dom-chunk',
    });
  }
  return offers;
}

function keepCardOffers(offers, catalogid, gpcid) {
  return (offers || []).filter((o) => {
    if (catalogid && o.catalogid && o.catalogid !== catalogid) return false;
    if (gpcid && o.gpcid && o.gpcid !== gpcid) return false;
    return true;
  });
}

function extractDomChunksFromPageFn() {
  return () => {
    const text = (el) => ((el && (el.innerText || el.textContent)) || '').replace(/\s+/g, ' ').trim();
    const chunks = [];
    for (const el of document.querySelectorAll('div, a, li')) {
      const t = text(el);
      if (t.length < 12 || t.length > 220) continue;
      if (!/\$\d/.test(t)) continue;
      const a = el.closest('a') || el.querySelector('a');
      chunks.push({ text: t, href: a ? a.href : '' });
      if (chunks.length >= 80) break;
    }
    return chunks;
  };
}

function parseShoppingPage({ html, url, xhrBodies, title, chunks } = {}) {
  const blocked = looksLikeBlocked(html, url);
  const consent = looksLikeConsent(html, url);
  const ids = extractCardIdsFromUrl(url);
  const fromPage = extractIdsFromText(html);
  const catalogid = ids.catalogid || fromPage.catalogid;
  const gpcid = ids.gpcid || fromPage.gpcid;
  const candidates = collectCandidateCards(html, url);
  const offers = [];
  const seen = new Set();
  function addAll(list) {
    for (const o of list || []) {
      const key = `${(o.merchant || '').toLowerCase()}|${hostOf(o.url || '')}|${o.price || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      offers.push(o);
    }
  }
  addAll(parseOffersFromXhr(xhrBodies));
  addAll(parseOffersFromHtml(html, url));
  addAll(parseOffersFromChunks(chunks));
  const cleanOffers = keepCardOffers(filterOffers(offers), catalogid, gpcid);

  const h1 =
    ((String(html || '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const genericTitle = /^(about this page|footer links|google shopping|google product result)$/i;
  const cardTitle = genericTitle.test(h1) ? title || h1 : h1 || title || '';

  return {
    blocked,
    consent,
    catalogid,
    gpcid,
    title: cardTitle,
    candidates,
    offers: cleanOffers,
    offer_list_complete: offers.length ? 'unknown' : 'unknown',
    url,
  };
}

module.exports = {
  looksLikeBlocked,
  looksLikeConsent,
  looksLikeShoppingSurface,
  extractIdsFromText,
  allIdPairsFromText,
  collectCandidateCards,
  parseOffersFromHtml,
  parseOffersFromXhr,
  parseShoppingPage,
  unwrapGoogleUrl,
  filterOffers,
  isJunkOffer,
  parseOffersFromChunks,
  keepCardOffers,
  extractDomChunksFromPageFn,
  looksLikeMerchant,
};
