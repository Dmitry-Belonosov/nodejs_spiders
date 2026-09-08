/**
 * Locate Chrome for Testing. Spiders that passed captcha used this binary, not
 * the everyday Google Chrome.app, so the platform never falls back to that.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const MAC_BINARY =
  'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const KNOWN_MAC = [
  path.join(
    os.homedir(),
    'chrome-for-testing/chrome/mac_arm-132.0.6834.83/chrome-mac-arm64',
    MAC_BINARY
  ),
  path.join(
    os.homedir(),
    'chrome-for-testing/chrome/mac-132.0.6834.83/chrome-mac-x64',
    MAC_BINARY
  ),
  `/tmp/chrome-for-testing/chrome/mac_arm-132.0.6834.83/chrome-mac-arm64/${MAC_BINARY}`,
  `/tmp/chrome-for-testing/chrome/mac-132.0.6834.83/chrome-mac-x64/${MAC_BINARY}`,
  `/Applications/${MAC_BINARY}`,
];

const LINUX_CFT = [
  path.join(os.homedir(), 'chrome-for-testing/chrome/linux-132.0.6834.83/chrome-linux64/chrome'),
  '/opt/chrome-for-testing/chrome',
];

const LINUX_FALLBACK = [
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

function isChromeForTesting(filePath) {
  return /chrome for testing/i.test(filePath) || /chrome-for-testing/i.test(filePath);
}

function walkForBinary(dir, depth, maxDepth) {
  if (depth > maxDepth || !dir) return null;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return null;
  }
  const direct = path.join(dir, MAC_BINARY);
  if (fs.existsSync(direct)) return direct;

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      if (entry.name === 'Google Chrome for Testing' || entry.name === 'chrome') {
        const full = path.join(dir, entry.name);
        if (isChromeForTesting(full) && fs.existsSync(full)) return full;
      }
      continue;
    }
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const hit = walkForBinary(path.join(dir, entry.name), depth + 1, maxDepth);
    if (hit) return hit;
  }
  return null;
}

function firstExisting(list) {
  for (const candidate of list) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function detectChrome() {
  const fromEnv = process.env.CHROME;
  if (fromEnv && fs.existsSync(fromEnv) && isChromeForTesting(fromEnv)) {
    return fromEnv;
  }

  const known = firstExisting(process.platform === 'linux' ? LINUX_CFT : KNOWN_MAC);
  if (known) return known;

  const roots = [
    process.env.CHROME_FOR_TESTING_DIR,
    path.join(os.homedir(), 'chrome-for-testing'),
    '/tmp/chrome-for-testing',
    process.platform === 'darwin' ? '/Applications' : null,
  ].filter(Boolean);

  for (const root of roots) {
    const hit = walkForBinary(root, 0, 6);
    if (hit) return hit;
  }

  // A dedicated Mac must not silently switch to the user's daily Chrome —
  // captcha solving was proven on Chrome for Testing.
  if (process.platform === 'darwin') return null;

  return firstExisting(LINUX_FALLBACK);
}

function installHint() {
  return (
    'Chrome for Testing is missing. On the Mac run:\n' +
    '  npx @puppeteer/browsers install chrome@132.0.6834.83 --path ~/chrome-for-testing'
  );
}

module.exports = { detectChrome, isChromeForTesting, installHint };
