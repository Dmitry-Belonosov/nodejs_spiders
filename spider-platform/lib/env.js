/**
 * Load .env from the platform root (KEY=VALUE, no quotes required).
 *
 * Same format as the spiders use, so credentials can be copied between
 * a spider .env and the platform .env without reformatting.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ENV_PATH = process.env.ENV_FILE || path.join(ROOT, '.env');

function parseEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const parsed = parseEnv(fs.readFileSync(ENV_PATH, 'utf8'));
  for (const [key, val] of Object.entries(parsed)) {
    if (process.env[key] === undefined) process.env[key] = val;
  }
  return parsed;
}

module.exports = { loadEnv, parseEnv, ROOT, ENV_PATH };
