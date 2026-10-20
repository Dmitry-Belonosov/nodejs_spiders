#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

const tests = [
  'test_query.js',
  'test_card_url.js',
  'test_proof.js',
  'test_parse.js',
  'test_seed.js',
  'test_chrome.js',
  'test_locale.js',
  'test_recaptcha.js',
  'test_llm_tile_picker.js',
];

let failed = 0;
for (const file of tests) {
  const full = path.join(__dirname, file);
  if (!require('fs').existsSync(full)) continue;
  console.log(`\n=== ${file} ===`);
  const result = spawnSync(process.execPath, [full], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
  if (result.status !== 0) failed += 1;
}

if (failed) {
  console.error(`\n${failed} test file(s) failed`);
  process.exit(1);
}
console.log('\nall unit tests passed');
