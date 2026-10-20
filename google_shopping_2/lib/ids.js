/**
 * Product identifiers from what Google shows (specs + titles). Google's
 * Shopping pages rarely carry GTINs; anything not found stays empty.
 */
const { hasCode } = require('./match');

function gtinValid(d) {
  if (!/^\d{8}$|^\d{12,14}$/.test(d)) return false;
  const digits = d.split('').map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((acc, n, i) => acc + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

const SPEC_KEYS = {
  mpn: /^(mpn|model|model number|model no\.?|part number|manufacturer part number|item model number)$/i,
  gtin: /^(gtin|upc|ean|barcode|isbn)$/i,
};

/** { mpn, gtin, ean, idSource } for one panel/offer, given the target. */
function extractIds(target, { specs = {}, titles = [] } = {}) {
  const out = { mpn: '', gtin: '', ean: '', idSource: [] };
  for (const [k, v] of Object.entries(specs)) {
    if (!out.mpn && SPEC_KEYS.mpn.test(k.trim())) {
      out.mpn = String(v).trim();
      out.idSource.push(`mpn:spec ${k}`);
    }
    if (!out.gtin && SPEC_KEYS.gtin.test(k.trim())) {
      const d = String(v).replace(/\D/g, '');
      if (gtinValid(d)) {
        out.gtin = d;
        out.idSource.push(`gtin:spec ${k}`);
      }
    }
  }
  const text = [...titles, ...Object.values(specs)].join(' \n ');
  if (!out.mpn && target.mpn && titles.some((t) => hasCode(t, target.mpn))) {
    out.mpn = target.mpn;
    out.idSource.push('mpn:title');
  }
  if (!out.gtin) {
    const hit = (text.match(/\b\d{8}\b|\b\d{12,14}\b/g) || []).find(gtinValid);
    if (hit) {
      out.gtin = hit;
      out.idSource.push('gtin:text');
    }
  }
  if (out.gtin.length === 13) out.ean = out.gtin;
  else if (out.gtin.length === 12) out.ean = `0${out.gtin}`;
  else if (out.gtin.length === 14 && out.gtin.startsWith('0')) out.ean = out.gtin.slice(1);
  out.idSource = out.idSource.join('; ');
  return out;
}

module.exports = { extractIds, gtinValid };
