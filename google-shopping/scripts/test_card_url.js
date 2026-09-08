const fs = require('fs');
const path = require('path');
const { assert, assertEq } = require('./assert');
const { csvToObjects } = require('../csv');
const {
  extractCardIdsFromUrl,
  parsePrds,
  buildCardUrl,
  cardKey,
  sameCard,
  isUsShoppingUrl,
  forceUsShoppingUrl,
} = require('../card_url');

const cyclone =
  'https://www.google.com/search?ibp=oshop&q=%22Cyclone+II+Rotating+Sprinkler%22&prds=catalogid:8598292094057135037,gpcid:1867240717998169488,headlineOfferDocid:13331752975202450948,imageDocid:13529526067404136999,pvo:25,pvt:hg&gl=us&hl=en&udm=28';

const ids = extractCardIdsFromUrl(cyclone);
assertEq(ids.catalogid, '8598292094057135037', 'catalogid from full card url');
assertEq(ids.gpcid, '1867240717998169488', 'gpcid from full card url');
assert(ids.headlineOfferDocid, 'optional headlineOfferDocid still parsed');
assert(isUsShoppingUrl(cyclone), 'fixture url is US shopping');

const rebuilt = buildCardUrl({
  q: 'Cyclone II Rotating Sprinkler',
  catalogid: ids.catalogid,
  gpcid: ids.gpcid,
});
assert(/ibp=oshop/.test(rebuilt), 'rebuilt has ibp');
assert(/udm=28/.test(rebuilt), 'rebuilt has udm=28');
assert(/gl=us/.test(rebuilt) && /hl=en/.test(rebuilt), 'rebuilt locale is US/en');
assert(!/headlineOfferDocid/.test(rebuilt), 'optional prds dropped');
const rebuiltIds = extractCardIdsFromUrl(rebuilt);
assertEq(rebuiltIds.catalogid, ids.catalogid, 'round-trip catalogid');
assertEq(rebuiltIds.gpcid, ids.gpcid, 'round-trip gpcid');

const gpcOnly =
  'https://www.google.com/search?ibp=oshop&q=K-Rain+Nozzles&prds=gpcid:5210206710661977098,headlineOfferDocid:17310021429464275578,pvo:3,pvt:hg&gl=us&hl=en&udm=28';
const gpcIds = extractCardIdsFromUrl(gpcOnly);
assertEq(gpcIds.catalogid, '', 'catalogid may be absent');
assertEq(gpcIds.gpcid, '5210206710661977098', 'gpcid-only card still identified');
assert(cardKey(gpcIds), 'gpcid-only still has a key');

const messy =
  'https://google.com/search?ibp=oshop&q=oid%3A10908593853184959711&gl=US&hl=en&udm=28&prds=headlineOfferDocid:10908593853184959711,gpcid:8083479633497367171,rds:PC_8083479633497367171%7CPROD_PC_8083479633497367171,catalogid:3801659430251483681,pvt:hg,pvo:3&&gws_rd=cr';
const messyIds = extractCardIdsFromUrl(messy);
assertEq(messyIds.catalogid, '3801659430251483681', 'catalogid from rds-style prds');
assertEq(messyIds.gpcid, '8083479633497367171', 'gpcid from rds-style prds');
assert(isUsShoppingUrl(forceUsShoppingUrl(messy)), 'forceUsShoppingUrl keeps US shopping');

const searchOnly = forceUsShoppingUrl(
  'https://www.google.com/search?q=Little+Giant+Smoker+Fuel&gl=us&hl=en&udm=28'
);
assert(/udm=28/.test(searchOnly), 'query-only url stays Shopping search');
assert(!/ibp=oshop/.test(searchOnly), 'query-only url does not open the product overlay');
assert(!/prds=/.test(searchOnly), 'query-only url has no card ids');

assert(
  sameCard(
    { catalogid: '1', gpcid: '2' },
    { catalogid: '1', gpcid: '2' }
  ),
  'sameCard on full pair'
);

const csvPath = path.join(__dirname, '..', 'test-cards.csv');
const rows = csvToObjects(fs.readFileSync(csvPath, 'utf8'));
assertEq(rows.length, 50, '50 test cards in csv');
let parsed = 0;
let missingBoth = 0;
for (const row of rows) {
  const fromUrl = extractCardIdsFromUrl(row.card_url);
  if (row.catalogid) {
    assertEq(fromUrl.catalogid || '', row.catalogid, `catalogid ${row.product_name}`);
  }
  if (row.gpcid) {
    assertEq(fromUrl.gpcid || '', row.gpcid, `gpcid ${row.product_name}`);
  }
  if (fromUrl.catalogid || fromUrl.gpcid || row.catalogid || row.gpcid) parsed += 1;
  if (!fromUrl.catalogid && !fromUrl.gpcid && !row.catalogid && !row.gpcid) missingBoth += 1;
}
assert(parsed >= 40, `parsed ids for most cards (${parsed})`);
console.log(`cards with no id pair (sparse headline-only): ${missingBoth}`);

const prds = parsePrds('catalogid:1,gpcid:2,pvo:25,pvt:hg');
assertEq(prds.catalogid, '1', 'parsePrds catalogid');
assertEq(prds.pvt, 'hg', 'parsePrds pvt');

console.log('test_card_url.js passed');
