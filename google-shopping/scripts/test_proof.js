const { assert, assertEq } = require('./assert');
const {
  mpnLooksUsable,
  proveCard,
  pickBestCard,
  competitorOffers,
  unwrapGoogleUrl,
  pathKey,
} = require('../proof');

assertEq(mpnLooksUsable('Hammock', 'Ainfox Hammock Camping Chair').ok, false, 'reject word MPN Hammock');
assertEq(mpnLooksUsable('20000', 'Pipe 20000 mm').ok, false, 'reject short bare number');
assertEq(mpnLooksUsable('A-700-1', 'Irritrol 700 Series').ok, true, 'keep A-700-1');
assertEq(mpnLooksUsable('PGP-ADJ', 'Hunter PGP').ok, true, 'keep PGP-ADJ with no digits');
assertEq(mpnLooksUsable('tf10 002o', 'MixRite').ok, true, 'keep spaced MPN');

const inner = unwrapGoogleUrl(
  'https://www.google.com/url?q=https://www.dripdepot.com/products/p1-drip-tape&sa=U'
);
assertEq(inner, 'https://www.dripdepot.com/products/p1-drip-tape', 'unwrap google /url');
assertEq(
  pathKey('https://www.dripdepot.com/products/p1-drip-tape?utm=1'),
  'dripdepot.com/products/p1-drip-tape',
  'path equality ignores query string'
);

const client = {
  product_name: 'P1 Drip Tape',
  brand: 'Irritec',
  gtin: '790576395951',
  mpn: 'P1-51017-12-6500',
  productUrl: 'https://www.dripdepot.com/products/p1-drip-tape',
  client_price_usd: 279,
  merchantAliases: ['drip depot', 'dripdepot.com'],
};

const gtinCard = {
  title: 'P1 Drip Tape',
  offers: [{ merchant: 'Home Depot', gtin: '790576395951', price: 280, url: 'https://homedepot.com/p/1' }],
};
assertEq(proveCard(gtinCard, client).tier, 'VERIFIED_GTIN', 'GTIN on an offer');

const urlCard = {
  title: 'P1 Drip Tape',
  offers: [
    {
      merchant: 'Drip Depot',
      url: 'https://www.dripdepot.com/products/p1-drip-tape?ref=google',
      price: 279,
    },
  ],
};
assertEq(proveCard(urlCard, client).tier, 'VERIFIED_URL', 'exact path is VERIFIED_URL');

const otherPage = {
  title: 'Something',
  offers: [
    { merchant: 'Drip Depot', url: 'https://www.dripdepot.com/products/other-item', price: 12 },
  ],
};
assertEq(proveCard(otherPage, client).tier, 'DOMAIN_MATCH', 'same host different path');

const priceCard = {
  title: 'P1',
  offers: [
    { merchant: 'Drip Depot', url: 'https://www.dripdepot.com/products/other-item', price: 280 },
  ],
};
assertEq(proveCard(priceCard, client).tier, 'DOMAIN_PRICE', 'same domain within 15%');

const mpnCard = {
  title: 'Irritec P1-51017-12-6500 drip tape',
  brand: 'Irritec',
  offers: [{ merchant: 'SupplyHouse', url: 'https://www.supplyhouse.com/p/1', price: 300 }],
};
assertEq(proveCard(mpnCard, client).tier, 'VERIFIED_MPN', 'MPN + brand on card');

const aftermarket = {
  title: 'ulapithi 232693S Compatible with Rain Bird Hold-Up Tool',
  offers: [{ merchant: 'Amazon', url: 'https://amazon.com/x', price: 10, mpn: '232693S' }],
};
const afterClient = {
  product_name: 'Hold-Up Tool',
  brand: 'Rain Bird',
  mpn: '232693S',
  merchantAliases: [],
};
assertEq(proveCard(aftermarket, afterClient).tier, 'UNVERIFIED', 'aftermarket compatible-with disqualifies brand');

const hammockCard = {
  title: 'Ainfox Hammock Camping Chair',
  offers: [{ merchant: 'Amazon', url: 'https://amazon.com/h', price: 40 }],
};
assertEq(
  proveCard(hammockCard, { product_name: 'Camping chair', brand: 'Ainfox', mpn: 'Hammock' }).tier,
  'UNVERIFIED',
  'Hammock MPN does not verify a hammock chair'
);

const dual = pickBestCard(
  [
    {
      title: 'quiet',
      offers: [
        { merchant: 'Drip Depot', url: 'https://www.dripdepot.com/products/p1-drip-tape', price: 279, gtin: '790576395951' },
      ],
    },
    {
      title: 'busy',
      offers: [
        { merchant: 'Drip Depot', url: 'https://www.dripdepot.com/products/p1-drip-tape', price: 279, gtin: '790576395951' },
        { merchant: 'Home Depot', url: 'https://homedepot.com/p/1', price: 288 },
        { merchant: 'Amazon', url: 'https://amazon.com/p/1', price: 301 },
      ],
    },
  ],
  client
);
assertEq(dual[0].card.title, 'busy', 'prefer the busier verified card');
assertEq(competitorOffers(dual[0].card, client).length, 2, 'client listing excluded from competitors');
assertEq(competitorOffers(dual[1].card, client).length, 0, 'quiet card really has no competitors');

console.log('test_proof.js passed');
