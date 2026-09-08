/**
 * Tiny JSON-file store.
 *
 * The platform tracks at most a few dozen spiders and a few thousand runs, so
 * a native database would add build complexity (and a compile step on the
 * server) for no benefit. Each collection is one JSON file, held in memory and
 * flushed with write-then-rename so a crash mid-write cannot corrupt it.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { STORE_DIR } = require('./paths');

const MAX_RUNS_KEPT = parseInt(process.env.MAX_RUNS_KEPT || '3000', 10);

const files = {
  spiders: path.join(STORE_DIR, 'spiders.json'),
  runs: path.join(STORE_DIR, 'runs.json'),
  settings: path.join(STORE_DIR, 'settings.json'),
};

const cache = {
  spiders: null,
  runs: null,
  settings: null,
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

function newId(prefix) {
  const d = new Date();
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = crypto.randomBytes(2).toString('hex');
  return prefix ? `${prefix}-${stamp}-${rand}` : `${stamp}-${rand}`;
}

/* ---------------------------------------------------------------- spiders */

function listSpiders() {
  return readCollection('spiders', []);
}

function getSpider(id) {
  return listSpiders().find((s) => s.id === id) || null;
}

function getSpiderBySlug(slug) {
  return listSpiders().find((s) => s.slug === slug) || null;
}

function createSpider(data) {
  const spiders = listSpiders();
  const now = new Date().toISOString();
  const spider = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...data,
  };
  spiders.push(spider);
  writeCollection('spiders');
  return spider;
}

function updateSpider(id, patch) {
  const spiders = listSpiders();
  const idx = spiders.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  spiders[idx] = {
    ...spiders[idx],
    ...patch,
    id: spiders[idx].id,
    updatedAt: new Date().toISOString(),
  };
  writeCollection('spiders');
  return spiders[idx];
}

function deleteSpider(id) {
  const spiders = listSpiders();
  const idx = spiders.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  spiders.splice(idx, 1);
  writeCollection('spiders');
  return true;
}

/* ------------------------------------------------------------------- runs */

function listRuns(filter = {}) {
  let runs = readCollection('runs', []);
  if (filter.spiderId) runs = runs.filter((r) => r.spiderId === filter.spiderId);
  if (filter.status) runs = runs.filter((r) => r.status === filter.status);
  runs = runs.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const offset = filter.offset || 0;
  const limit = filter.limit || runs.length;
  return runs.slice(offset, offset + limit);
}

function countRuns(filter = {}) {
  let runs = readCollection('runs', []);
  if (filter.spiderId) runs = runs.filter((r) => r.spiderId === filter.spiderId);
  if (filter.status) runs = runs.filter((r) => r.status === filter.status);
  return runs.length;
}

function getRun(id) {
  return readCollection('runs', []).find((r) => r.id === id) || null;
}

function createRun(data) {
  const runs = readCollection('runs', []);
  const run = {
    id: newId(),
    createdAt: new Date().toISOString(),
    status: 'queued',
    artifacts: [],
    ...data,
  };
  runs.push(run);
  if (runs.length > MAX_RUNS_KEPT) {
    runs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    runs.length = MAX_RUNS_KEPT;
  }
  writeCollection('runs');
  return run;
}

function updateRun(id, patch) {
  const runs = readCollection('runs', []);
  const idx = runs.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  runs[idx] = { ...runs[idx], ...patch, id: runs[idx].id };
  writeCollection('runs');
  return runs[idx];
}

/** Remove every run matching the predicate. Returns how many were dropped. */
function dropRuns(predicate) {
  const runs = readCollection('runs', []);
  const kept = runs.filter((r) => !predicate(r));
  const removed = runs.length - kept.length;
  if (removed) {
    cache.runs = kept;
    writeCollection('runs');
  }
  return removed;
}

function lastRunForSpider(spiderId) {
  return listRuns({ spiderId, limit: 1 })[0] || null;
}

/* --------------------------------------------------------------- settings */

const DEFAULT_SETTINGS = {
  maxConcurrentRuns: 2,
  defaultTimeoutMinutes: 240,
  timezone: 'Europe/London',
};

function getSettings() {
  return { ...DEFAULT_SETTINGS, ...readCollection('settings', {}) };
}

function updateSettings(patch) {
  cache.settings = { ...getSettings(), ...patch };
  writeCollection('settings');
  return cache.settings;
}

module.exports = {
  newId,
  listSpiders,
  getSpider,
  getSpiderBySlug,
  createSpider,
  updateSpider,
  deleteSpider,
  listRuns,
  countRuns,
  getRun,
  createRun,
  updateRun,
  dropRuns,
  lastRunForSpider,
  getSettings,
  updateSettings,
};
