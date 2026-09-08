/**
 * Filesystem layout for the platform.
 *
 * Everything mutable lives under DATA_DIR so the whole runtime state can be
 * moved to the server (or backed up) by copying a single directory.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function resolveFromRoot(p, fallback) {
  const value = p || fallback;
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

const DATA_DIR = resolveFromRoot(process.env.DATA_DIR, 'data');
const SPIDERS_DIR = resolveFromRoot(process.env.SPIDERS_DIR, path.join(DATA_DIR, 'spiders'));
const RUNS_DIR = path.join(DATA_DIR, 'runs');
const ARTIFACTS_DIR = path.join(DATA_DIR, 'artifacts');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const STORE_DIR = path.join(DATA_DIR, 'store');
const PLATFORM_LOG_DIR = path.join(DATA_DIR, 'logs');

function ensureDirs() {
  for (const dir of [
    DATA_DIR,
    SPIDERS_DIR,
    RUNS_DIR,
    ARTIFACTS_DIR,
    UPLOADS_DIR,
    STORE_DIR,
    PLATFORM_LOG_DIR,
  ]) {
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
  SPIDERS_DIR,
  RUNS_DIR,
  ARTIFACTS_DIR,
  UPLOADS_DIR,
  STORE_DIR,
  PLATFORM_LOG_DIR,
  ensureDirs,
  runDir,
  runLogPath,
  artifactDir,
};
