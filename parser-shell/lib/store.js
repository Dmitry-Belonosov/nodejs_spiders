const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { STORE_DIR } = require('./paths');

const MAX_RUNS = 500;

const files = {
  settings: path.join(STORE_DIR, 'settings.json'),
  runs: path.join(STORE_DIR, 'runs.json'),
};

const cache = {
  settings: null,
  runs: null,
};

function readCollection(name, fallback) {
  if (cache[name]) return cache[name];
  const file = files[name];
  if (fs.existsSync(file)) {
    try {
      cache[name] = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      const backup = `${file}.corrupt-${Date.now()}`;
      fs.renameSync(file, backup);
      console.error(`[store] ${name}.json unreadable, moved to ${backup}: ${e.message}`);
      cache[name] = fallback;
    }
  } else {
    cache[name] = fallback;
  }
  return cache[name];
}

function writeCollection(name) {
  const file = files[name];
  const tmp = `${file}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(cache[name], null, 2));
  fs.renameSync(tmp, file);
}

function newId() {
  const d = new Date();
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `${stamp}-${crypto.randomBytes(2).toString('hex')}`;
}

function defaultParserSettings() {
  return {
    network: 'vpn',
    tabs: 10,
    windows: 2,
  };
}

function getAllSettings() {
  return readCollection('settings', { parsers: {} });
}

function getParserSettings(parserId) {
  const all = getAllSettings();
  return { ...defaultParserSettings(), ...(all.parsers[parserId] || {}) };
}

function saveParserSettings(parserId, patch) {
  const all = getAllSettings();
  const current = getParserSettings(parserId);
  const next = {
    ...current,
    ...patch,
  };
  if (next.network !== 'proxyrack') next.network = 'vpn';
  next.tabs = Math.max(1, Math.min(30, parseInt(next.tabs, 10) || 10));
  next.windows = Math.max(1, Math.min(8, parseInt(next.windows, 10) || 2));
  all.parsers[parserId] = next;
  writeCollection('settings');
  return next;
}

function listRuns() {
  return readCollection('runs', []);
}

function getRun(id) {
  return listRuns().find((r) => r.id === id) || null;
}

function createRun(data) {
  const runs = listRuns();
  const run = {
    id: newId(),
    createdAt: new Date().toISOString(),
    status: 'running',
    artifacts: [],
    ...data,
  };
  runs.unshift(run);
  if (runs.length > MAX_RUNS) runs.length = MAX_RUNS;
  writeCollection('runs');
  return run;
}

function updateRun(id, patch) {
  const runs = listRuns();
  const index = runs.findIndex((r) => r.id === id);
  if (index === -1) return null;
  runs[index] = { ...runs[index], ...patch };
  writeCollection('runs');
  return runs[index];
}

function lastRunFor(parserId) {
  return listRuns().find((r) => r.parserId === parserId) || null;
}

module.exports = {
  defaultParserSettings,
  getParserSettings,
  saveParserSettings,
  listRuns,
  getRun,
  createRun,
  updateRun,
  lastRunFor,
};
