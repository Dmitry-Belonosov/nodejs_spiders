const fs = require('fs');
const path = require('path');
const { assert, assertEq } = require('./assert');
const {
  looksLikeBlocked,
  looksLikeConsent,
  collectCandidateCards,
  parseOffersFromHtml,
  parseOffersFromChunks,
  parseShoppingPage,
  looksLikeMerchant,
} = require('../parse');

assertEq(looksLikeMerchant('Track price'), false, 'reject Track price');
assertEq(looksLikeMerchant('Home Depot'), true, 'Home Depot is a merchant');

const blocked = fs.readFileSync(path.join(__dirname, 'fixtures', 'blocked.html'), 'utf8');
const consent = fs.readFileSync(path.join(__dirname, 'fixtures', 'consent.html'), 'utf8');
const serp = fs.readFileSync(path.join(__dirname, 'fixtures', 'serp.html'), 'utf8');
const card = fs.readFileSync(path.join(__dirname, 'fixtures', 'card.html'), 'utf8');

assert(looksLikeBlocked(blocked, 'https://www.google.com/sorry/index?continue=x'), 'sorry page is blocked');
assert(looksLikeBlocked(blocked, 'https://www.google.com/search', 429), 'HTTP 429 is blocked');
assert(!looksLikeBlocked(serp, 'https://www.google.com/search?udm=28'), 'shopping SERP is not blocked');
assert(looksLikeConsent(consent, 'https://consent.google.com/'), 'consent interstitial detected');

const candidates = collectCandidateCards(
  serp,
  'https://www.google.com/search?ibp=oshop&q=Cyclone+II&gl=us&hl=en&udm=28'
);
assert(candidates.length >= 2, `SERP candidates >= 2 (got ${candidates.length})`);
assert(
  candidates.some((c) => c.catalogid === '8598292094057135037' && c.gpcid === '1867240717998169488'),
  'Cyclone card ids collected from SERP'
);

const offers = parseOffersFromHtml(
  card,
  'https://www.google.com/search?ibp=oshop&prds=catalogid:8598292094057135037,gpcid:1867240717998169488&gl=us&hl=en&udm=28'
);
assert(offers.length >= 3, `card offers >= 3 (got ${offers.length})`);
assert(
  offers.some((o) => /home depot/i.test(o.merchant) && o.price === 7.62),
  'Home Depot offer with delivered price'
);
assert(
  offers.some((o) => /dripdepot\.com\/products\/cyclone/i.test(o.url)),
  'client PDP url unwrapped from google /url'
);

const parsed = parseShoppingPage({
  html: card,
  url: 'https://www.google.com/search?ibp=oshop&q=Cyclone&prds=catalogid:8598292094057135037,gpcid:1867240717998169488&gl=us&hl=en&udm=28',
});
assertEq(parsed.blocked, false, 'card page not blocked');
assertEq(parsed.catalogid, '8598292094057135037', 'card catalogid from url');
assertEq(parsed.gpcid, '1867240717998169488', 'card gpcid from url');
assert(parsed.offers.length >= 3, 'parseShoppingPage keeps offers');

const fromChunks = parseOffersFromChunks([
  {
    text: 'Anvil 3000 sq. ft. Oscillating Sprinkler $9.98 Home Depot 3.5(419)',
    href: 'https://www.google.com/search?prds=catalogid:1,gpcid:2',
  },
  {
    text: 'Anvil 3000 sq. ft. Oscillating Sprinkler $9.98 Home Depot 3.5(419)',
    href: 'https://www.google.com/search?prds=catalogid:1,gpcid:2',
  },
]);
assert(
  fromChunks.some((o) => o.merchant === 'Home Depot' && o.price === 9.98),
  'dom chunk extracts Home Depot offer'
);

console.log('test_parse.js passed');
