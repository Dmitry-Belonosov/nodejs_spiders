#!/usr/bin/env node
/** Offline tests: matching and id extraction (no Chrome, no Ollama). */
const assert = require('assert/strict');
const { textScore, hasCode, hasLooseCode, matchCards } = require('../lib/match');
const { extractIds, gtinValid } = require('../lib/ids');

const tests = [
  ['MPN as a token, not a near-miss', () => {
    assert.equal(hasCode('Munro CP3005B 5HP Complete PRO II', 'CP3005B'), true);
    assert.equal(hasCode('Munro Complete PRO - CP-3005B pump', 'CP3005B'), true);
    assert.equal(hasCode('Munro 5 HP Pump | LP3005B', 'CP3005B'), false);
    assert.equal(hasCode('Munro CP3005BX', 'CP3005B'), false);
    assert.equal(hasLooseCode('Cyclone II Rotating Sprinkler 58333', '58333N'), true);
  }],
  ['text score ranks the right card first', () => {
    const t = { name: 'Complete PRO II', brand: 'Munro', mpn: 'CP3005B', price: 6500 };
    const a = textScore(t, { title: 'Munro CP3005B 5HP Complete PRO II Series', price: 6540 }).score;
    const b = textScore(t, { title: 'Munro 5 HP Single Phase Pump | LP3005B', price: 3395 }).score;
    const c = textScore(t, { title: 'Munro Traveler Slip-On', price: 200 }).score;
    assert.ok(a >= 60 && b < 60 && c < 60, `${a} ${b} ${c}`);
  }],
  ['clear winner without a code match', async () => {
    const t = { name: 'Smoker Fuel', brand: 'Little Giant', mpn: 'SMFUEL', price: 9.99 };
    const cards = [
      { idx: 0, title: 'Little Giant Fuel Tank', price: 84 },
      { idx: 1, title: 'Little Giant Smoker Fuel', price: 5.99 },
    ];
    const { scored } = await matchCards(t, cards, { useImages: false });
    assert.deepEqual(scored.filter((s) => s.matched).map((s) => s.card.idx), [1]);
  }],
  ['gates: variant, size/pack, price', () => {
    const fc = { name: 'Falcon Rotor Full-Circle Pattern Nozzle', brand: 'Rain Bird', mpn: '6504FC', price: 46.75 };
    assert.match(textScore(fc, { title: 'Rain Bird Falcon 6504 Part Circle Rotor', price: 59.99 }).gates.join(), /variant full≠part/);
    assert.match(textScore(fc, { title: 'Rain Bird Falcon 6504 Full Circle Rotor', price: 663 }).gates.join(), /price/);
    const f = { name: 'Tree Food 19-10-5 - Size : 3', brand: 'Ferti-Lome', mpn: '13820', price: 19.99 };
    assert.match(textScore(f, { title: 'Fertilome Tree Food 19-10-5 4 lb Bag', price: 28.5 }).gates.join(), /size 3≠4/);
    const n = { name: '4" Mist Nozzle Extension - Pack Of 5', brand: 'Orbit', mpn: '10056H', price: 21.5 };
    assert.deepEqual(textScore(n, { title: 'Orbit 10056H Nozzle Extension 4 in.', price: 15.99 }).gates, []);
    assert.match(textScore(n, { title: 'Orbit 10056H Nozzle Extension 1 pk', price: 4.99 }).gates.join(), /pack/);
  }],
  ['exact code matches without an image vote; catalogid always', async () => {
    const t = { name: 'AC Solenoid', brand: 'Hunter', mpn: '606800', price: 10.68, catalogid: '42' };
    const cards = [
      { idx: 0, title: 'Hunter 606800 24 VAC Replacement Solenoid', price: 13.49 },
      { idx: 1, title: 'Hunter 606800 Solenoid', price: 32.92 },
      { idx: 2, title: 'Totally different name', price: 11, catalogid: '42' },
    ];
    const { scored } = await matchCards(t, cards, { useImages: false });
    assert.deepEqual(scored.filter((s) => s.matched).map((s) => s.card.idx).sort(), [0, 2]);
  }],
  ['GTIN check digit and EAN from UPC', () => {
    assert.equal(gtinValid('718455923200'), true);
    assert.equal(gtinValid('718455923201'), false);
    const ids = extractIds({ mpn: '92320W' }, { specs: { UPC: '718455923200' }, titles: ['Orbit Adapter 92320W'] });
    assert.deepEqual([ids.mpn, ids.gtin, ids.ean], ['92320W', '718455923200', '0718455923200']);
  }],
  ['nothing found → empty ids', () => {
    const ids = extractIds({ mpn: 'SMFUEL' }, { specs: {}, titles: ['Little Giant Smoker Fuel'] });
    assert.deepEqual([ids.mpn, ids.gtin, ids.ean], ['', '', '']);
  }],
];

(async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`ok   ${name}`);
    } catch (e) {
      failed += 1;
      console.log(`FAIL ${name}\n     ${e.message}`);
    }
  }
  console.log(failed ? `${failed} failed` : `all ${tests.length} passed`);
  process.exit(failed ? 1 : 0);
})();
