const { assert, assertEq } = require('./assert');
const {
  stripClientVariantSyntax,
  normalizeInches,
  buildSearchQuery,
  shoppingSearchUrl,
} = require('../query');

assertEq(
  stripClientVariantSyntax('True Union Ball Valve - Size : 1"'),
  'True Union Ball Valve',
  'strip Size variant'
);
assertEq(
  stripClientVariantSyntax('4" Flexible Mist Nozzle Extension - Pack Of 5'),
  '4" Flexible Mist Nozzle Extension',
  'strip Pack Of'
);
assertEq(
  stripClientVariantSyntax(
    'Nozzles - Radius : 8\' - Pattern : Half Circle'
  ),
  'Nozzles',
  'strip Radius/Pattern chain'
);
assertEq(
  stripClientVariantSyntax('Cyclone II Rotating Sprinkler'),
  'Cyclone II Rotating Sprinkler',
  'leave titles without variant syntax'
);

assertEq(normalizeInches('3/8" Brass'), '3/8 in Brass', 'inch mark to in');
assertEq(normalizeInches("Radius : 8' leftover"), "Radius : 8 ft leftover", 'foot mark to ft');

const dura = buildSearchQuery({
  brand: 'Dura',
  product_name: 'True Union Ball Valve - Size : 1"',
});
assert(dura.includes('Dura'), 'search includes brand');
assert(!/Size/i.test(dura), 'search dropped Size variant');
assert(/True Union Ball Valve/.test(dura), 'search kept product name');

const orbit = buildSearchQuery({
  brand: 'Orbit',
  product_name: 'Cyclone II Rotating Sprinkler',
});
assertEq(orbit, 'Orbit Cyclone II Rotating Sprinkler', 'plain brand+name, no extra quotes needed');

const quoted = buildSearchQuery({
  brand: 'Orbit',
  product_name: '3/8" Brass Slip-Lok Mist Hose Adapter',
});
assert(quoted.startsWith('"') && quoted.endsWith('"'), 'punctuation titles are quoted');
assert(/3\/8 in/.test(quoted), 'inches normalized inside quoted query');

const url = shoppingSearchUrl('Orbit Cyclone II Rotating Sprinkler');
assert(!/ibp=oshop/.test(url), 'search url is the grid, not the product overlay');
assert(/udm=28/.test(url), 'search url forces Shopping');
assert(/gl=us/.test(url), 'search url is US');
assert(/hl=en/.test(url), 'search url is English');

console.log('test_query.js passed');
