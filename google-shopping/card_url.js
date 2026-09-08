/**
 * Google Shopping card identity is the (catalogid, gpcid) pair.
 * Optional prds keys (headlineOfferDocid, imageDocid, pvo, pvt) can be dropped.
 */
function decodeParam(value) {
  try {
    return decodeURIComponent(String(value || '').replace(/\+/g, ' '));
  } catch (e) {
    return String(value || '');
  }
}

function parsePrds(prds) {
  const out = {};
  const decoded = decodeParam(prds);
  if (!decoded) return out;
  for (const part of decoded.split(',')) {
    const idx = part.indexOf(':');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

function extractCardIdsFromUrl(urlString) {
  const empty = { catalogid: '', gpcid: '', headlineOfferDocid: '', q: '', raw: String(urlString || '') };
  if (!urlString) return empty;
  try {
    const u = new URL(urlString);
    const prds = parsePrds(u.searchParams.get('prds') || '');
    return {
      catalogid: prds.catalogid || '',
      gpcid: prds.gpcid || '',
      headlineOfferDocid: prds.headlineOfferDocid || '',
      q: u.searchParams.get('q') || '',
      raw: urlString,
    };
  } catch (e) {
    const catalogid = (String(urlString).match(/catalogid:(\d+)/i) || [])[1] || '';
    const gpcid = (String(urlString).match(/gpcid:(\d+)/i) || [])[1] || '';
    return { ...empty, catalogid, gpcid };
  }
}

function cardKey(ids) {
  const catalogid = (ids && ids.catalogid) || '';
  const gpcid = (ids && ids.gpcid) || '';
  if (catalogid && gpcid) return `${catalogid}|${gpcid}`;
  if (gpcid) return `|${gpcid}`;
  if (catalogid) return `${catalogid}|`;
  return '';
}

function sameCard(a, b) {
  const ka = cardKey(a);
  const kb = cardKey(b);
  if (ka && kb && ka === kb) return true;
  if (a && b && a.gpcid && b.gpcid && a.gpcid === b.gpcid) return true;
  if (a && b && a.catalogid && b.catalogid && a.catalogid === b.catalogid) return true;
  return false;
}

function buildCardUrl({ q, catalogid, gpcid, gl, hl } = {}) {
  const query = String(q || '').trim();
  const prds = [];
  if (catalogid) prds.push(`catalogid:${catalogid}`);
  if (gpcid) prds.push(`gpcid:${gpcid}`);
  const params = [`ibp=oshop`];
  if (query) params.push(`q=${encodeURIComponent(query)}`);
  if (prds.length) params.push(`prds=${prds.join(',')}`);
  params.push(`gl=${gl || 'us'}`);
  params.push(`hl=${hl || 'en'}`);
  params.push('udm=28');
  return `https://www.google.com/search?${params.join('&')}`;
}

function requiredLocaleParams(urlString) {
  try {
    const u = new URL(urlString);
    return {
      gl: (u.searchParams.get('gl') || '').toLowerCase(),
      hl: (u.searchParams.get('hl') || '').toLowerCase(),
      udm: u.searchParams.get('udm') || '',
      ibp: u.searchParams.get('ibp') || '',
    };
  } catch (e) {
    return { gl: '', hl: '', udm: '', ibp: '' };
  }
}

function isUsShoppingUrl(urlString) {
  const p = requiredLocaleParams(urlString);
  return p.gl === 'us' && (p.hl === 'en' || !p.hl) && (p.udm === '28' || p.ibp === 'oshop');
}

function forceUsShoppingUrl(urlString) {
  const ids = extractCardIdsFromUrl(urlString);
  if (ids.catalogid || ids.gpcid) {
    return buildCardUrl({
      q: ids.q,
      catalogid: ids.catalogid,
      gpcid: ids.gpcid,
    });
  }
  try {
    const u = new URL(urlString);
    const parts = [];
    const q = u.searchParams.get('q') || ids.q;
    if (q) parts.push(`q=${encodeURIComponent(q)}`);
    parts.push('gl=us', 'hl=en', 'udm=28');
    if (/\/shopping/i.test(u.pathname) && !q) {
      return `https://www.google.com/shopping?gl=us&hl=en`;
    }
    return `https://www.google.com/search?${parts.join('&')}`;
  } catch (e) {
    return urlString;
  }
}

module.exports = {
  parsePrds,
  extractCardIdsFromUrl,
  cardKey,
  sameCard,
  buildCardUrl,
  requiredLocaleParams,
  isUsShoppingUrl,
  forceUsShoppingUrl,
};
