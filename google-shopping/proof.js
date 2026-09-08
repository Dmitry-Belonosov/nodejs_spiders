/**
 * Rank evidence that a Google Shopping card is the client's product.
 * A similar title is not proof.
 */

const AFTERMARKET =
  /\b(compatible with|replacement for|fits|equivalent to|for use with)\b/i;

function hostOf(urlString) {
  try {
    return new URL(urlString).hostname.replace(/^www\./i, '').toLowerCase();
  } catch (e) {
    return '';
  }
}

function pathOf(urlString) {
  try {
    const path = new URL(urlString).pathname.replace(/\/+$/, '') || '/';
    return path.toLowerCase();
  } catch (e) {
    return '';
  }
}

function unwrapGoogleUrl(urlString) {
  const raw = String(urlString || '');
  try {
    const u = new URL(raw);
    if (/google\./i.test(u.hostname) && u.searchParams.get('q')) {
      const inner = u.searchParams.get('q');
      if (/^https?:/i.test(inner)) return inner;
    }
    if (/google\./i.test(u.hostname) && u.searchParams.get('url')) {
      const inner = u.searchParams.get('url');
      if (/^https?:/i.test(inner)) return inner;
    }
  } catch (e) {}
  const m = raw.match(/[?&](?:q|url|adurl)=((?:https?:\/\/)[^&]+)/i);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch (e) {
      return m[1];
    }
  }
  return raw;
}

function normalizeGtin(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.replace(/^0+/, '') || digits;
}

function gtinMatches(a, b) {
  const x = normalizeGtin(a);
  const y = normalizeGtin(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const pad = (s) => s.padStart(14, '0');
  return pad(x) === pad(y);
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && t.length >= 3);
}

function mpnLooksUsable(mpn, productName) {
  const raw = String(mpn || '').trim();
  if (!raw) return { ok: false, reason: 'empty' };
  if (!/[0-9]|[^\w\s]/.test(raw) && !/[A-Z]-[A-Z0-9]/i.test(raw)) {
    // Must contain a digit or punctuation. Hyphenated codes like PGP-ADJ pass
    // via [^\w\s] (the hyphen). Bare words like "Hammock" fail.
    if (!/-/.test(raw)) return { ok: false, reason: 'no-digit-or-punct' };
  }
  if (/^\d+$/.test(raw) && raw.length < 6) {
    return { ok: false, reason: 'short-bare-number' };
  }
  const nameTokens = new Set(tokenize(productName));
  const mpnTokens = tokenize(raw);
  if (mpnTokens.length === 1 && nameTokens.has(mpnTokens[0]) && !/\d/.test(raw)) {
    return { ok: false, reason: 'word-in-product-name' };
  }
  return { ok: true, reason: '' };
}

function textContainsMpn(text, mpn) {
  const needle = String(mpn || '').trim();
  if (!needle) return false;
  const hay = String(text || '');
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const re = new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, 'i');
  return re.test(hay);
}

function brandAgrees(cardText, brand) {
  const b = String(brand || '').trim();
  if (!b) return false;
  if (AFTERMARKET.test(cardText)) return false;
  const re = new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return re.test(cardText || '');
}

function parsePrice(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value || '').replace(/,/g, '');
  const m = s.match(/(\d+(?:\.\d{1,2})?)/);
  return m ? parseFloat(m[1]) : null;
}

function withinPercent(a, b, pct) {
  if (a == null || b == null || !(b > 0)) return false;
  return Math.abs(a - b) / b <= pct;
}

function domainOf(urlString) {
  return hostOf(unwrapGoogleUrl(urlString));
}

function pathKey(urlString) {
  const inner = unwrapGoogleUrl(urlString);
  const host = hostOf(inner);
  const path = pathOf(inner);
  if (!host) return '';
  return `${host}${path}`;
}

function isClientOffer(offer, client) {
  const aliases = (client.merchantAliases || []).map((s) => String(s).toLowerCase());
  const merchant = String((offer && offer.merchant) || '').toLowerCase();
  if (merchant && aliases.some((a) => a && merchant.includes(a))) return true;
  const clientHost = hostOf(client.productUrl || client.client_url || '');
  const offerHost = domainOf((offer && (offer.url || offer.link)) || '');
  if (clientHost && offerHost && offerHost === clientHost) return true;
  if (offerHost && aliases.includes(offerHost)) return true;
  return false;
}

function cardBlob(card) {
  const offers = (card && card.offers) || [];
  const bits = [
    card && card.title,
    card && card.brand,
    ...offers.map((o) => [o.merchant, o.url, o.gtin, o.mpn, o.title, o.raw].filter(Boolean).join(' ')),
  ];
  return bits.filter(Boolean).join('\n');
}

function proveCard(card, client) {
  const offers = (card && card.offers) || [];
  const blob = cardBlob(card);
  const clientGtin = client.gtin || client.barcode;
  const clientUrl = client.productUrl || client.client_url || '';
  const clientPath = pathKey(clientUrl);
  const clientHost = hostOf(clientUrl);
  const clientPrice = parsePrice(client.client_price_usd || client.price);
  const clientMpn = client.mpn || client.sku;

  if (clientGtin) {
    if (gtinMatches(card.gtin, clientGtin) || gtinMatches(card.barcode, clientGtin)) {
      return { tier: 'VERIFIED_GTIN', detail: `gtin ${clientGtin}` };
    }
    for (const offer of offers) {
      if (gtinMatches(offer.gtin, clientGtin) || gtinMatches(offer.barcode, clientGtin)) {
        return { tier: 'VERIFIED_GTIN', detail: `gtin ${clientGtin}` };
      }
    }
  }

  if (clientPath) {
    for (const offer of offers) {
      const key = pathKey(offer.url || offer.link);
      if (key && key === clientPath) {
        return { tier: 'VERIFIED_URL', detail: key };
      }
    }
  }

  if (clientMpn) {
    const usable = mpnLooksUsable(clientMpn, client.product_name || client.title || '');
    if (usable.ok) {
      const mpnFound =
        textContainsMpn(blob, clientMpn) ||
        offers.some((o) => textContainsMpn(o.mpn || '', clientMpn));
      if (mpnFound && brandAgrees(blob, client.brand)) {
        return { tier: 'VERIFIED_MPN', detail: `mpn ${clientMpn}` };
      }
    }
  }

  if (clientHost) {
    const domainOffers = offers.filter((o) => domainOf(o.url || o.link) === clientHost);
    if (domainOffers.length) {
      const priceHit = domainOffers.find((o) =>
        withinPercent(parsePrice(o.price), clientPrice, 0.15)
      );
      if (priceHit) {
        return {
          tier: 'DOMAIN_PRICE',
          detail: `${clientHost} ${priceHit.price}`,
        };
      }
      return { tier: 'DOMAIN_MATCH', detail: clientHost };
    }
  }

  return { tier: 'UNVERIFIED', detail: 'no proof' };
}

function competitorOffers(card, client) {
  return ((card && card.offers) || []).filter((o) => !isClientOffer(o, client));
}

const TIER_RANK = {
  VERIFIED_GTIN: 5,
  VERIFIED_URL: 4,
  VERIFIED_MPN: 3,
  DOMAIN_PRICE: 2,
  DOMAIN_MATCH: 1,
  UNVERIFIED: 0,
};

function rankTier(tier) {
  return TIER_RANK[tier] || 0;
}

function pickBestCard(candidates, client) {
  const scored = (candidates || []).map((card) => {
    const proof = proveCard(card, client);
    const offers = (card.offers || []).length;
    const competitors = competitorOffers(card, client).length;
    return {
      card,
      proof,
      offers,
      competitors,
      score: rankTier(proof.tier) * 1000 + competitors * 2 + offers,
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

module.exports = {
  AFTERMARKET,
  unwrapGoogleUrl,
  hostOf,
  pathOf,
  pathKey,
  domainOf,
  normalizeGtin,
  gtinMatches,
  mpnLooksUsable,
  textContainsMpn,
  brandAgrees,
  parsePrice,
  withinPercent,
  isClientOffer,
  proveCard,
  competitorOffers,
  rankTier,
  pickBestCard,
};
