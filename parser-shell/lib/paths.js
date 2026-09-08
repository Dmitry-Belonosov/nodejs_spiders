const fs = require('fs');
const path = require('path');
const { ROOT } = require('./env');

function resolveFromRoot(value, fallback) {
  const raw = value || fallback;
  return path.isAbsolute(raw) ? raw : path.join(ROOT, raw);
}

const DATA_DIR = resolveFromRoot(process.env.DATA_DIR, 'data');
const RUNS_DIR = path.join(DATA_DIR, 'runs');
const STORE_DIR = path.join(DATA_DIR, 'store');
const ARTIFACTS_DIR = path.join(DATA_DIR, 'artifacts');

function parsersRoot() {
  if (process.env.PARSERS_DIR) {
    return path.resolve(process.env.PARSERS_DIR);
  }
  return path.resolve(ROOT, '..');
}

function ensureDirs() {
  for (const dir of [DATA_DIR, RUNS_DIR, STORE_DIR, ARTIFACTS_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function runDir(runId) {
  return path.join(RUNS_DIR, runId);
}

function runLogPath(runId) {
  return path.join(runDir(runId), 'run.log');
}

function artifactDir(slug, runId) {
  return path.join(ARTIFACTS_DIR, slug, runId);
}

module.exports = {
  ROOT,
  DATA_DIR,
  RUNS_DIR,
  STORE_DIR,
  ARTIFACTS_DIR,
  parsersRoot,
  ensureDirs,
  runDir,
  runLogPath,
  artifactDir,
};
