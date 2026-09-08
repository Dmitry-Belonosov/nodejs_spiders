const { assert } = require('./assert');
const { detectChrome, isChromeForTesting, installHint } = require('../chrome');

const chrome = detectChrome();
assert(chrome, installHint());
assert(isChromeForTesting(chrome), `detected binary is Chrome for Testing: ${chrome}`);
console.log('chrome', chrome);
console.log('test_chrome.js passed');
