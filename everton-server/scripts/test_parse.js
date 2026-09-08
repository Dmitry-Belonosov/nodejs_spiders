/**
 * Offline unit check for parse.js using a minimal pdp-data fixture.
 */
const { parseEvertonHtml, pickPrice, looksLikeBlocked } = require('../parse');

const fixture = {
  'pdp-data': {
    pdp: {
      title: 'Everton Home Shirt 25/26',
      productId: '12345',
      brandResource: { value: 'Hummel' },
      categories: [{ categoryName: 'Mens' }, { categoryName: 'Kits' }],
      hasInventory: true,
      imageSelector: { defaultImage: { image: { src: 'img/shirt.jpg' } } },
      price: { sale: { money: { userCurrencyValue: '69.99' } } },
      sizes: [
        { size: 'S', available: true, itemId: 's1', price: { sale: { money: { userCurrencyValue: '69.99' } } } },
        { size: 'M', available: false, itemId: 's2', price: { sale: { money: { userCurrencyValue: '69.99' } } } },
      ],
    },
  },
  initialAppContext: { imageHostname: 'images.footballfanatics.com' },
};

const html = `<html><body><div class="universal-header"></div><script type="application/json">${JSON.stringify(
  fixture
)}</script></body></html>`;

const pageUrl = 'https://store.evertonfc.com/en/everton-home-shirt/p-12345?cur=GBP';
const { products } = parseEvertonHtml(html, pageUrl, 'pdp');

if (products.length !== 2) {
  console.error('expected 2 size variants, got', products.length);
  process.exit(1);
}
if (products[0].identifier !== '12345-S' || products[1].identifier !== '12345-M') {
  console.error('bad identifiers', products.map((p) => p.identifier));
  process.exit(1);
}
if (products[0].stock !== 1 || products[1].stock !== 0) {
  console.error('bad stock', products.map((p) => p.stock));
  process.exit(1);
}
if (products[0].price !== '69.99' || products[0].brand !== 'Hummel') {
  console.error('bad price/brand', products[0]);
  process.exit(1);
}
if (!products[0].image_url.includes('images.footballfanatics.com/img/shirt.jpg')) {
  console.error('bad image', products[0].image_url);
  process.exit(1);
}

const listingHtml = `
<html><body>
  <div class="universal-header"></div>
  <div role="menuitem"><a href="/en/mens/t-111">Mens</a></div>
  <a data-talos="linkSearchResult" href="/en/shirt/p-999?cur=GBP">Shirt</a>
  <a aria-label="next page" href="/en/mens/t-111?pageNumber=2">Next</a>
</body></html>`;
const listing = parseEvertonHtml(
  listingHtml,
  'https://store.evertonfc.com/en/mens/t-111?cur=GBP',
  'listing'
);
if (!listing.links.some((l) => l.mode === 'pdp' && l.url.includes('/p-999'))) {
  console.error('missing pdp link', listing.links);
  process.exit(1);
}
if (!listing.links.some((l) => l.url.includes('pageNumber=2'))) {
  console.error('missing pagination', listing.links);
  process.exit(1);
}
if (!listing.links.some((l) => l.url.includes('/t-111'))) {
  console.error('missing category link', listing.links);
  process.exit(1);
}

if (pickPrice({ regular: { money: { userCurrencyValue: '10' } } }) !== '10') {
  console.error('pickPrice failed');
  process.exit(1);
}
if (!looksLikeBlocked('Access Denied', 'https://store.evertonfc.com/x', 200)) {
  console.error('blocked detect failed');
  process.exit(1);
}

console.log('parse tests ok');
