#!/usr/bin/env node
/**
 * Unattended Everton scrape supervisor.
 *
 * - starts queue server + two Chrome-for-Testing windows (10 tabs each)
 * - pipes all output to logs/run.log (tail -f logs/run.log)
 * - writes periodic snapshots to logs/progress.log (tail -f logs/progress.log)
 * - on completion: export jsonl/csv, upload via SFTP, write DONE marker
 *
 * When this runs under the spider platform, SKIP_SFTP=1 is injected and the
 * platform performs the upload instead.
 *
 * Usage:
 *   cp .env.example .env   # fill credentials
 *   npm install
 *   npm start
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { loadEnv, ROOT } = require('./lib/env');
const {
  progressLine,
  createChildLogger,
  pipeChildOutput,
  RUN_LOG,
  PROGRESS_LOG,
} = require('./lib/logger');
const { fetchStatus, formatStatus, isComplete } = require('./lib/progress');
const { exportAll } = require('./lib/export');
const { uploadFiles } = require('./lib/sftp');

loadEnv();

const PORT = process.env.PORT || '5054';
const SERVER_BASE = process.env.SERVER || `http://127.0.0.1:${PORT}`;
const STATUS_INTERVAL_MS = parseInt(process.env.STATUS_INTERVAL_MS || '30000', 10);
const COMPLETE_STABLE_POLLS = parseInt(process.env.COMPLETE_STABLE_POLLS || '3', 10);
const MIN_URLS_BEFORE_DONE = parseInt(process.env.MIN_URLS_BEFORE_DONE || '100', 10);
const SKIP_SFTP = process.env.SKIP_SFTP === '1';
const DONE_MARKER = path.join(ROOT, 'logs', 'uploaded.done');
const WINDOWS = Math.max(1, parseInt(process.env.WINDOWS || '2', 10) || 2);
const TABS = process.env.THREADS || '10';
const WORKER = process.env.WORKER || 'puppeteer_worker.js';

const log = createChildLogger('supervisor');

let serverProc = null;
let workerProcs = [];
let monitorTimer = null;
let stableCompletePolls = 0;
let finishing = false;
let shuttingDown = false;

function ensureDirs() {
  for (const d of ['data', 'data/products', 'logs', 'archive']) {
    fs.mkdirSync(path.join(ROOT, d), { recursive: true });
  }
}

function ensureUrls() {
  const urlsPath = path.join(ROOT, 'urls.json');
  if (fs.existsSync(urlsPath)) return;
  const sample = path.join(ROOT, 'urls.sample.json');
  if (!fs.existsSync(sample)) {
    throw new Error('urls.json missing and no urls.sample.json');
  }
  fs.copyFileSync(sample, urlsPath);
  log.info('seeded urls.json from urls.sample.json');
}

function childEnv(extra) {
  return {
    ...process.env,
    PORT: String(PORT),
    SERVER: SERVER_BASE,
    THREADS: TABS,
    ...extra,
  };
}

function spawnChild(name, script, extraEnv = {}) {
  const proc = spawn(process.execPath, [script], {
    cwd: ROOT,
    env: childEnv(extraEnv),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  pipeChildOutput(name, proc.stdout, false);
  pipeChildOutput(name, proc.stderr, true);

  proc.on('exit', (code, signal) => {
    if (shuttingDown || finishing) return;
    log.warn(`${name} exited code=${code} signal=${signal || '-'}`);
    if (name === 'server') {
      restartAll('server-exit').catch((e) => log.error(e.message));
    } else {
      const idx = parseInt(extraEnv.WINDOW_INDEX, 10) || 0;
      startWorker(idx);
    }
  });

  return proc;
}

function startServer() {
  serverProc = spawnChild('server', 'server.js');
  log.info(`started server.js on :${PORT}`);
}

function startWorker(index) {
  const i = Number.isInteger(index) ? index : 0;
  const name = WINDOWS > 1 ? `worker-${i + 1}` : 'worker';
  const profile = process.env.PROFILE
    ? `${process.env.PROFILE}-${i + 1}`
    : `/tmp/everton-pp-profile-${i + 1}`;
  workerProcs[i] = spawnChild(name, WORKER, {
    WINDOW_INDEX: String(i),
    PROFILE: profile,
  });
  log.info(`started ${WORKER} as ${name} (${TABS} tabs, ${profile})`);
}

function startWorkers() {
  workerProcs = [];
  for (let i = 0; i < WINDOWS; i += 1) startWorker(i);
  log.info(`chrome layout: ${WINDOWS} window(s) × ${TABS} tab(s)`);
}

function stopChild(proc) {
  if (!proc || proc.killed) return Promise.resolve();
  return new Promise((resolve) => {
    proc.once('exit', () => resolve());
    try {
      proc.kill('SIGTERM');
    } catch (e) {
      return resolve();
    }
    setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch (e2) {}
      resolve();
    }, 5000);
  });
}

async function stopWorkers() {
  await Promise.all(workerProcs.map((proc) => stopChild(proc)));
  workerProcs = [];
}

async function restartWorker(reason) {
  log.warn(`restarting workers (${reason})`);
  await stopWorkers();
  startWorkers();
}

async function restartAll(reason) {
  log.warn(`restarting all (${reason})`);
  await stopWorkers();
  await stopChild(serverProc);
  serverProc = null;
  await delay(2000);
  startServer();
  await delay(1500);
  startWorkers();
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(maxMs) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      await fetchStatus(SERVER_BASE);
      return true;
    } catch (e) {
      await delay(500);
    }
  }
  return false;
}

async function onComplete(status) {
  if (finishing) return;
  finishing = true;
  progressLine(`CRAWL COMPLETE — ${formatStatus(status)}`);
  log.info('exporting products...');

  let exported;
  try {
    exported = exportAll({ root: ROOT });
    progressLine(
      `exported ${exported.rows} rows -> ${path.basename(exported.jsonl)}, ${path.basename(exported.csv)}`
    );
    log.info(`archive copies: ${exported.archivedJsonl}, ${exported.archivedCsv}`);
  } catch (e) {
    progressLine(`EXPORT FAILED: ${e.message}`);
    log.error(`export failed: ${e.message}`);
    finishing = false;
    return;
  }

  if (SKIP_SFTP) {
    progressLine('SKIP_SFTP=1 — upload skipped (the platform delivers the CSV)');
  } else {
    try {
      progressLine('SFTP upload starting...');
      const uploaded = await uploadFiles([exported.jsonl, exported.csv]);
      progressLine(`SFTP done (${uploaded.length} file(s))`);
    } catch (e) {
      progressLine(`SFTP FAILED: ${e.message}`);
      log.error(`sftp failed: ${e.message}`);
      finishing = false;
      return;
    }
  }

  fs.writeFileSync(
    DONE_MARKER,
    JSON.stringify({ finishedAt: new Date().toISOString(), status, exported }, null, 2)
  );
  progressLine('ALL DONE — scrape finished, export complete');
  log.info(`done marker written: ${DONE_MARKER}`);

  if (process.env.EXIT_ON_COMPLETE === '1') {
    shuttingDown = true;
    clearInterval(monitorTimer);
    await stopWorkers();
    await stopChild(serverProc);
    process.exit(0);
  }
}

async function monitorTick() {
  if (finishing || shuttingDown) return;
  let status;
  try {
    status = await fetchStatus(SERVER_BASE);
  } catch (e) {
    progressLine(`status check failed: ${e.message}`);
    return;
  }

  progressLine(formatStatus(status));

  if (isComplete(status, MIN_URLS_BEFORE_DONE)) {
    stableCompletePolls += 1;
    if (stableCompletePolls >= COMPLETE_STABLE_POLLS) {
      await onComplete(status);
    }
  } else {
    stableCompletePolls = 0;
  }
}

async function main() {
  ensureDirs();
  ensureUrls();

  if (fs.existsSync(DONE_MARKER) && process.env.FORCE_RUN !== '1') {
    log.warn(
      `previous run marked complete (${DONE_MARKER}). Set FORCE_RUN=1 to run again.`
    );
  }

  progressLine('=== Everton scrape starting ===');
  progressLine(`run log: ${RUN_LOG}`);
  progressLine(`progress log: ${PROGRESS_LOG}`);
  progressLine(`server: ${SERVER_BASE}`);
  progressLine(`chrome layout: ${WINDOWS} window(s) × ${TABS} tab(s)`);

  startServer();
  const up = await waitForServer(30000);
  if (!up) {
    progressLine('ERROR: queue server did not start within 30s');
    process.exit(1);
  }
  startWorkers();

  await monitorTick();
  monitorTimer = setInterval(() => {
    monitorTick().catch((e) => log.error(`monitor: ${e.message}`));
  }, STATUS_INTERVAL_MS);

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
      shuttingDown = true;
      progressLine(`shutdown requested (${signal})`);
      clearInterval(monitorTimer);
      await stopWorkers();
      await stopChild(serverProc);
      process.exit(0);
    });
  }
}

main().catch((e) => {
  progressLine(`FATAL: ${e.message}`);
  log.error(e.stack || e.message);
  process.exit(1);
});
