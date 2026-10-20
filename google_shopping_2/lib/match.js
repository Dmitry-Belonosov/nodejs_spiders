/**
 * Does a Google card show the target product?
 *
 * Evidence, strongest first:
 *   id     card catalogid/gpcid == target's               → match (only a wild price can veto)
 *   code   exact MPN or GTIN token in the title           → match unless a gate fails
 *   text   brand + name words + price                     → match at ≥ MATCH_AT, or a clear winner
 *   image  vision model vs reference image                → only for cards WITHOUT id/code evidence
 *
 * Gates (any one blocks a code/text match):
 *   price outside ×0.4–×2.5 of the target price
 *   variant conflict: target says "full circle", card says "part circle"; male/female; …
 *   size/pack conflict: same unit, different number ("4 lb" vs "3 lb", "Pack Of 5" vs "1 pk")
 */
const ollama = require('./llm');

const MATCH_AT = 60;
const ASK_IMAGE_FROM = 25;
const PRICE_GATE = [0.4, 2.5];

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/(^| )\.|\.( |$)/g, ' ')
    .trim();
const compact = (s) => norm(s).replace(/[ .]/g, '');
const STOP = new Set(['the', 'and', 'for', 'with', 'in', 'of', 'a', 'an', 'to', 'by', 'series', 'pack', 'new', 'size', 'pattern', 'radius']);
const words = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 1 && !STOP.has(w)));

/** Code as a whole token run: "CP3005B" matches "CP-3005B", not "LP3005B"/"CP3005BX". */
function hasCode(title, code) {
  const c = compact(code);
  if (c.length < 4) return false;
  const tokens = norm(title).split(' ').map((t) => t.replace(/\./g, ''));
  for (let i = 0; i < tokens.length; i += 1) {
    let acc = '';
    for (let j = i; j < Math.min(tokens.length, i + 4); j += 1) {
      acc += tokens[j];
      if (acc === c) return true;
      if (acc.length >= c.length) break;
    }
  }
  return false;
}

/** "58333N" vs "58333": base code present, suffix absent (suffix may be a variant — checked separately). */
function hasLooseCode(title, code) {
  const base = compact(code).replace(/[a-z]{1,2}$/, '');
  if (base.length < 4 || base === compact(code)) return false;
  return hasCode(title, base);
}

// Words that name mutually exclusive variants. Target with one, card with another → conflict.
const VARIANT_SETS = [
  ['full', 'part', 'half', 'quarter', 'adjustable', 'variable'],
  ['male', 'female'],
  ['left', 'right'],
  ['single', 'double', 'triple', 'dual'],
  ['ac', 'dc'],
  ['stainless', 'brass', 'plastic', 'zinc'],
];
function variantConflict(targetText, cardText) {
  const t = words(targetText);
  const c = words(cardText);
  for (const set of VARIANT_SETS) {
    const tv = set.filter((w) => t.has(w));
    const cv = set.filter((w) => c.has(w));
    if (tv.length && cv.length && !cv.some((w) => tv.includes(w))) return `${tv[0]}≠${cv[0]}`;
  }
  return null;
}

// Sizes and packs: number + unit, normalised.
const UNITS = [
  [/(\d+(?:\.\d+)?)\s*(?:"|in\b|inch(?:es)?\b)/g, 'in'],
  [/(\d+(?:\.\d+)?)\s*(?:'|ft\b|feet\b|foot\b)/g, 'ft'],
  [/(\d+(?:\.\d+)?)\s*(?:lb|lbs|pound|pounds)\b/g, 'lb'],
  [/(\d+(?:\.\d+)?)\s*(?:oz|ounce|ounces)\b/g, 'oz'],
  [/(\d+(?:\.\d+)?)\s*(?:gal|gallon|gallons)\b/g, 'gal'],
  [/(\d+(?:\.\d+)?)\s*(?:hp)\b/g, 'hp'],
  [/(\d+(?:\.\d+)?)\s*(?:v|vac|volt|volts)\b/g, 'v'],
  [/(\d+(?:\.\d+)?)\s*(?:mm)\b/g, 'mm'],
  [/pack of (\d+)|(\d+)\s*(?:pk|pack|ct|count|pcs|pieces)\b/g, 'pack'],
];
function measures(text) {
  const s = String(text || '').toLowerCase().replace(/(\d)\s*-\s*(?=in|inch|ft|lb)/g, '$1 ');
  const out = {};
  for (const [re, unit] of UNITS) {
    for (const m of s.matchAll(re)) {
      const v = parseFloat(m[1] || m[2]);
      if (Number.isFinite(v)) (out[unit] ||= new Set()).add(v);
    }
  }
  // "Size : 3" in the target name usually means the pack/bag size
  const size = s.match(/size\s*:\s*(\d+(?:\.\d+)?)\b(?!\s*(?:"|in|ft|lb|oz))/);
  if (size) (out.size ||= new Set()).add(parseFloat(size[1]));
  return out;
}
function measureCheck(targetText, cardText) {
  const t = measures(targetText);
  const c = measures(cardText);
  for (const unit of Object.keys(t)) {
    if (unit === 'size') {
      // bare "Size : 3" — compare with any card number+unit we know for weights/packs
      const cvals = [...(c.lb || []), ...(c.pack || []), ...(c.oz || []), ...(c.gal || [])];
      if (cvals.length && !cvals.some((v) => t.size.has(v))) return { conflict: `size ${[...t.size][0]}≠${cvals[0]}` };
      continue;
    }
    if (!c[unit]) continue;
    if (![...c[unit]].some((v) => t[unit].has(v))) return { conflict: `${[...t[unit]][0]}${unit}≠${[...c[unit]][0]}${unit}` };
    return { same: `${[...t[unit]][0]}${unit}` };
  }
  if (c.pack && !t.pack && [...c.pack].some((v) => v > 1)) return { conflict: `pack of ${[...c.pack][0]}` };
  return {};
}

function priceRatio(target, card) {
  return target.price && card.price ? card.price / target.price : null;
}

function textScore(target, card) {
  const reasons = [];
  let score = 0;
  let evidence = null;
  const title = `${card.title} ${card.imageAlt || ''}`;

  if ((target.catalogid && card.catalogid === target.catalogid) || (target.gpcid && card.gpcid === target.gpcid)) {
    evidence = 'id';
    score += 100;
    reasons.push(card.catalogid === target.catalogid ? 'catalogid' : 'gpcid');
  }
  if (target.mpn && hasCode(title, target.mpn)) {
    score += 45;
    reasons.push('mpn');
    evidence ||= 'code';
  } else if (target.mpn && hasLooseCode(title, target.mpn)) {
    score += 25;
    reasons.push('mpn~');
  }
  if (target.gtin && hasCode(title, target.gtin)) {
    score += 45;
    reasons.push('gtin');
    evidence ||= 'code';
  }
  if (target.brand && compact(target.brand).length >= 2 && compact(title).includes(compact(target.brand))) {
    score += 10;
    reasons.push('brand');
  }
  const tw = words(target.name);
  const cw = words(title);
  const overlap = tw.size ? [...tw].filter((w) => cw.has(w)).length / tw.size : 0;
  score += Math.round(overlap * 40);
  reasons.push(`name ${Math.round(overlap * 100)}%`);

  const gates = [];
  const ratio = priceRatio(target, card);
  if (ratio != null) {
    if (ratio >= 0.75 && ratio <= 1.25) {
      score += 15;
      reasons.push('price ±25%');
    } else if (ratio >= 0.5 && ratio <= 1.5) {
      score += 8;
      reasons.push('price ±50%');
    } else {
      score -= 25;
      reasons.push(`price ×${ratio.toFixed(2)}`);
    }
    if (ratio < PRICE_GATE[0] || ratio > PRICE_GATE[1]) gates.push(`price ×${ratio.toFixed(2)}`);
  }
  const targetText = `${target.name} ${target.mpn}`;
  const variant = variantConflict(targetText, title);
  if (variant) {
    gates.push(`variant ${variant}`);
    score -= 30;
  }
  const size = measureCheck(target.name, title);
  if (size.conflict) {
    gates.push(size.conflict);
    score -= 30;
  } else if (size.same) {
    score += 10;
    reasons.push(`size ${size.same}`);
  }
  return { score, reasons, evidence, gates };
}

const SAME_SCHEMA = {
  type: 'object',
  properties: { same: { type: 'string', enum: ['same', 'different', 'unsure'] } },
  required: ['same'],
};

async function sameProductImage(refB64, cardB64, target) {
  const out = await ollama.chatJson({
    prompt:
      `Image 1 is the reference product "${target.name}"${target.brand ? ` by ${target.brand}` : ''}. ` +
      'Image 2 is a shop listing. Is image 2 the same product model as image 1 (same item, maybe another angle or background)? ' +
      'A different model, size or variant of the same brand is "different".',
    images: [refB64, cardB64],
    format: SAME_SCHEMA,
    numPredict: 20,
  });
  return out.same;
}

/**
 * Score all cards → { scored: [{card, score, reasons, evidence, gates, image, matched, why}], refFrom }.
 * `refImage` (base64) = target image if given; else the best id/code/clear-winner card's image.
 */
async function matchCards(target, cards, { refImage = null, useImages = true, log = () => {} } = {}) {
  const scored = cards.map((c) => ({ card: c, ...textScore(target, c), image: null, matched: false, why: '' }));

  // id evidence wins over everything except a wild price; code evidence needs all gates clear
  for (const s of scored) {
    const priceGate = s.gates.find((g) => g.startsWith('price'));
    if (s.evidence === 'id' && !priceGate) s.matched = true;
    else if (s.evidence === 'code' && !s.gates.length) s.matched = true;
    if (s.matched) s.why = s.evidence;
    else if (s.evidence) s.why = `blocked: ${s.gates.join(', ')}`;
  }

  // text-only: clear winner (≥50, ≥10 ahead of the runner-up), gates clear
  const textOnly = [...scored].filter((s) => !s.evidence).sort((a, b) => b.score - a.score);
  if (!scored.some((s) => s.matched)) {
    const [top, second] = textOnly;
    if (top && !top.gates.length && (top.score >= MATCH_AT || (top.score >= 50 && top.score - (second ? second.score : 0) >= 10))) {
      top.matched = true;
      top.why = top.score >= MATCH_AT ? 'text' : 'clear winner';
    }
  }

  // reference image: input, else best matched card
  let ref = refImage;
  let refFrom = ref ? 'input' : null;
  if (!ref) {
    const best = scored.filter((s) => s.matched && s.card.imageB64).sort((a, b) => b.score - a.score)[0];
    if (best) {
      ref = best.card.imageB64;
      refFrom = `card ${best.card.idx}`;
    }
  }

  // image check only for plausible cards without id/code evidence
  if (useImages && ref) {
    for (const s of scored) {
      if (s.evidence || s.matched || s.gates.length || !s.card.imageB64 || s.score < ASK_IMAGE_FROM) continue;
      try {
        s.image = await sameProductImage(ref, s.card.imageB64, target);
        s.reasons.push(`image ${s.image}`);
        if (s.image === 'same' && s.score + 25 >= MATCH_AT) {
          s.score += 25;
          s.matched = true;
          s.why = 'text+image';
        } else if (s.image === 'different') s.score -= 40;
      } catch (e) {
        log(`image check failed: ${e.message}`);
      }
    }
  }
  for (const s of scored) if (!s.matched && !s.why && s.gates.length) s.why = `blocked: ${s.gates.join(', ')}`;
  return { scored: scored.sort((a, b) => Number(b.matched) - Number(a.matched) || b.score - a.score), refFrom };
}

module.exports = { matchCards, textScore, hasCode, hasLooseCode, variantConflict, measureCheck, MATCH_AT };
