/**
 * Discover parsers sitting next to this shell.
 *
 * A parser is a sibling folder with package.json and an `npm start` script.
 * The shell never copies these folders — it only reads them and starts
 * `npm start` inside them.
 */
const fs = require('fs');
const path = require('path');
const { parsersRoot, ROOT } = require('./paths');

const SKIP_DIRS = new Set([
  'node_modules',
  'parser-shell',
  'spider-platform',
  'data',
  'logs',
  'dist',
  'coverage',
]);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return null;
  }
}

function isParserDir(dir, name) {
  if (SKIP_DIRS.has(name) || name.startsWith('.')) return false;
  if (path.resolve(dir) === path.resolve(ROOT)) return false;
  const pkg = readJson(path.join(dir, 'package.json'));
  return !!(pkg && pkg.scripts && pkg.scripts.start);
}

function scan() {
  const root = parsersRoot();
  if (!fs.existsSync(root)) return [];

  const entries = fs.readdirSync(root, { withFileTypes: true });
  const parsers = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    if (!isParserDir(dir, entry.name)) continue;

    const pkg = readJson(path.join(dir, 'package.json')) || {};
    parsers.push({
      id: entry.name,
      slug: entry.name,
      name: pkg.name ? humanize(pkg.name) : humanize(entry.name),
      description: pkg.description || '',
      dir,
      command: 'npm start',
    });
  }

  parsers.sort((a, b) => a.name.localeCompare(b.name));
  return parsers;
}

function humanize(value) {
  return String(value)
    .replace(/[-_]+scraper$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

module.exports = { scan, parsersRoot };
