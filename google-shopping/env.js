/**
 * Load a local .env if the platform has not already injected the variables.
 * Does not override existing process.env values.
 */
const fs = require('fs');
const path = require('path');

function parseLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const eq = trimmed.indexOf('=');
  if (eq < 1) return null;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1);
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return 0;
  let n = 0;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    if (process.env[parsed.key] != null && process.env[parsed.key] !== '') continue;
    process.env[parsed.key] = parsed.value;
    n += 1;
  }
  return n;
}

function loadEnv() {
  const roots = [process.cwd(), path.join(__dirname)];
  if (path.basename(__dirname) === 'scripts') roots.push(path.join(__dirname, '..'));
  const seen = new Set();
  for (const root of roots) {
    const file = path.join(root, '.env');
    if (seen.has(file)) continue;
    seen.add(file);
    loadEnvFile(file);
  }
}

loadEnv();

module.exports = { loadEnv, loadEnvFile };
