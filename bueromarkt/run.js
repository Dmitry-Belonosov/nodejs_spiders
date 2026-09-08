#!/usr/bin/env node
/**
 * Unattended crawl supervisor.
 *
 * This spider is two processes that never exit on their own: a queue server
 * holding the URL list, and a worker draining it. The management platform needs
 * a single command that runs the crawl and *finishes*, so this starts both,
 * watches /status until the queue is drained, exports the results and exits.
 *
 * Exit code 0 means the crawl completed and the CSV was written.
 *
 * SFTP delivery is intentionally absent: the platform uploads the exported CSV
 * itself, so credentials live in one place instead of in every spider.
 *
 *   npm start
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/* ------------------------------------------------------------ spider setup */

const SPIDER = 'bueromarkt';
const DEFAULT_PORT = '5053';
const DEFAULT_WORKER = 'puppeteer_worker.js';

/* -------------------------------------------------------------- parameters */

const ROOT = __dirname;

function int(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const PORT = process.env.PORT || DEFAULT_PORT;
const SERVER = process.env.SERVER || `http://127.0.0.1:${PORT}`;
const WORKER = process.env.WORKER || DEFAULT_WORKER;

const STATUS_INTERVAL_MS = int(process.env.STATUS_INTERVAL_MS, 30000);
// The queue grows while the crawl discovers links, so "drained" is only
// believed after it holds still for several polls.
const COMPLETE_STABLE_POLLS = int(process.env.COMPLETE_STABLE_POLLS, 3);
const MIN_URLS_BEFORE_DONE = int(process.env.MIN_URLS_BEFORE_DONE, 1);
// Stop early once this many products are collected (0 = crawl everything).
// Useful to verify a newly uploaded spider without waiting for a full crawl.
const MAX_PRODUCTS = int(process.env.MAX_PRODUCTS, 0);
// A crawl that drains its queue but extracts nothing usually means the site
// changed and parsing broke, which must not be reported as a success.
const MIN_PRODUCTS = int(process.env.MIN_PRODUCTS, 1);
const SERVER_START_TIMEOUT_MS = int(process.env.SERVER_START_TIMEOUT_MS, 60000);
const MAX_RESTARTS = int(process.env.MAX_RESTARTS, 5);

let serverProc = null;
let workerProcs = [];
let monitorTimer = null;
let stablePolls = 0;
let restarts = 0;
let finishing = false;
let shuttingDown = false;
let firstTick = true;

// Two Chrome-for-Testing windows of 10 tabs was the layout that got through
// captcha on the Mac. Each window is its own worker process + Chrome profile.
const WINDOWS = Math.max(1, int(process.env.WINDOWS, 2));
const TABS = process.env.THREADS || '10';

/* ----------------------------------------------------------------- logging */

function log(message) {
  console.log(`[supervisor] ${message}`);
}

/** Forward a child's output line by line so the platform log stays readable. */
function pipeOutput(name, stream, isError) {
  let pending = '';
  stream.on('data', (chunk) => {
    pending += chunk.toString();
    const lines = pending.split('\n');
    pending = lines.pop();
    const out = isError ? process.stderr : process.stdout;
    for (const line of lines) out.write(`[${name}] ${line}\n`);
  });
  stream.on('end', () => {
    if (pending) (isError ? process.stderr : process.stdout).write(`[${name}] ${pending}\n`);
  });
}

/* ---------------------------------------------------------------- children */

function spawnChild(name, script, extraEnv = {}) {
  const proc = spawn(process.execPath, [script], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), SERVER, THREADS: TABS, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  pipeOutput(name, proc.stdout, false);
  pipeOutput(name, proc.stderr, true);

  proc.on('exit', (code, signal) => {
    if (shuttingDown || finishing) return;
    log(`${name} exited unexpectedly (code=${code} signal=${signal || '-'})`);
    if (restarts >= MAX_RESTARTS) {
      fail(`${name} keeps exiting; giving up after ${restarts} restart(s)`);
      return;
    }
    restarts += 1;
    // Crawl state lives on disk (data/products, urls.json), so a restart
    // resumes rather than starting over.
    log(`restarting ${name} (${restarts}/${MAX_RESTARTS})`);
    setTimeout(() => {
      if (shuttingDown || finishing) return;
      if (name === 'server') startServer();
      else startWorker(parseInt(extraEnv.WINDOW_INDEX, 10) || 0);
    }, 2000);
  });

  return proc;
}

function startServer() {
  serverProc = spawnChild('server', 'server.js');
  log(`started server.js on port ${PORT}`);
}

function startWorker(index) {
  const i = Number.isInteger(index) ? index : 0;
  const name = WINDOWS > 1 ? `worker-${i + 1}` : 'worker';
  const profile = process.env.PROFILE
    ? `${process.env.PROFILE}-${i + 1}`
    : `/tmp/${SPIDER}-pp-profile-${i + 1}`;
  workerProcs[i] = spawnChild(name, WORKER, {
    WINDOW_INDEX: String(i),
    PROFILE: profile,
  });
  log(`started ${WORKER} as ${name} (profile ${profile}, ${TABS} tabs)`);
}

function startWorkers() {
  workerProcs = [];
  for (let i = 0; i < WINDOWS; i += 1) startWorker(i);
  log(`chrome layout: ${WINDOWS} window(s) × ${TABS} tab(s)`);
}

function stopChild(proc) {
  if (!proc || proc.exitCode !== null || proc.signalCode) return Promise.resolve();
  return new Promise((resolve) => {
    const done = setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch (e) {
        /* already gone */
      }
      resolve();
    }, 5000);
    proc.once('exit', () => {
      clearTimeout(done);
      resolve();
    });
    try {
      proc.kill('SIGTERM');
    } catch (e) {
      clearTimeout(done);
      resolve();
    }
  });
}

async function stopAll() {
  clearInterval(monitorTimer);
  await Promise.all(workerProcs.map((proc) => stopChild(proc)));
  workerProcs = [];
  await stopChild(serverProc);
}

/* ------------------------------------------------------------- crawl state */

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchStatus() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${SERVER}/status`, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function waitForServer() {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      await fetchStatus();
      return true;
    } catch (e) {
      await delay(500);
    }
  }
  return false;
}

function formatStatus(status) {
  const percent = status.total ? Math.round((status.progress / status.total) * 100) : 0;
  const pending = status.pending === undefined ? '' : ` | pending ${status.pending}`;
  return `progress ${status.progress}/${status.total} (${percent}%)${pending} | products ${status.products || 0}`;
}

/**
 * Some queue servers report `pending`, others only `progress`/`total`; treat a
 * missing `pending` as "nothing outstanding beyond the counters".
 */
function isDrained(status) {
  if (!status || !status.total) return false;
  if (status.pending !== undefined && status.pending !== 0) return false;
  if (status.progress < status.total) return false;
  if (MIN_URLS_BEFORE_DONE && status.total < MIN_URLS_BEFORE_DONE) return false;
  return true;
}

function hitProductLimit(status) {
  return MAX_PRODUCTS > 0 && (status.products || 0) >= MAX_PRODUCTS;
}

/* -------------------------------------------------------------- exporting */

function runScript(script, extraEnv) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(path.join(ROOT, script))) {
      log(`${script} not present — skipped`);
      return resolve();
    }
    const proc = spawn(process.execPath, [script], {
      cwd: ROOT,
      env: { ...process.env, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    pipeOutput(script, proc.stdout, false);
    pipeOutput(script, proc.stderr, true);
    proc.on('error', reject);
    proc.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${script} exited with code ${code}`))
    );
  });
}

async function exportResults(products) {
  if (products < MIN_PRODUCTS) {
    throw new Error(
      `crawl extracted ${products} product(s), expected at least ${MIN_PRODUCTS} — ` +
        'the site layout has probably changed'
    );
  }

  // Names are fixed here rather than left to each script's default, so the
  // platform always finds the same file to collect and deliver.
  await runScript('export_jsonl.js', { OUT: `${SPIDER}.jsonl` });
  await runScript('export_csv.js', { OUT: `${SPIDER}.csv` });

  const csv = path.join(ROOT, `${SPIDER}.csv`);
  if (!fs.existsSync(csv)) throw new Error(`export finished but ${SPIDER}.csv was not created`);
  const { size } = fs.statSync(csv);
  if (!size) throw new Error(`${SPIDER}.csv is empty`);
  log(`exported ${SPIDER}.csv (${products} products, ${size} bytes)`);
}

/* ------------------------------------------------------------------ finish */

async function fail(message) {
  if (finishing) return;
  finishing = true;
  console.error(`[supervisor] FAILED: ${message}`);
  await stopAll();
  process.exit(1);
}

async function finish(status, reason) {
  if (finishing) return;
  finishing = true;
  clearInterval(monitorTimer);
  log(`crawl complete (${reason}) — ${formatStatus(status)}`);

  // Stop crawling before exporting so the product files cannot change midway.
  await Promise.all(workerProcs.map((proc) => stopChild(proc)));
  workerProcs = [];

  try {
    await exportResults(status.products || 0);
  } catch (e) {
    console.error(`[supervisor] export failed: ${e.message}`);
    await stopChild(serverProc);
    process.exit(1);
  }

  await stopChild(serverProc);
  log('done');
  process.exit(0);
}

/* ----------------------------------------------------------------- monitor */

async function tick() {
  if (finishing || shuttingDown) return;

  let status;
  try {
    status = await fetchStatus();
  } catch (e) {
    log(`status check failed: ${e.message}`);
    return;
  }

  log(formatStatus(status));

  // The queue is built from urls.json at startup, so an empty one can only
  // grow through link discovery — waiting for a timeout would waste hours.
  if (!status.total) {
    await fail('the queue is empty — urls.json has no URLs to crawl');
    return;
  }

  // Leftover data/products/*.json makes every current URL look complete.
  // Chrome then sits on about:blank and export dumps the previous crawl.
  if (firstTick) {
    firstTick = false;
    if (isDrained(status)) {
      await fail(
        `nothing to crawl: ${status.progress}/${status.total} URLs are already marked complete ` +
          'from leftover data/products. Chrome has no pages to open. ' +
          'This is not a new scrape — refusing to export leftover products.'
      );
      return;
    }
  }

  if (hitProductLimit(status)) {
    await finish(status, `MAX_PRODUCTS=${MAX_PRODUCTS} reached`);
    return;
  }

  if (isDrained(status)) {
    stablePolls += 1;
    if (stablePolls >= COMPLETE_STABLE_POLLS) {
      await finish(status, 'queue drained');
    }
  } else {
    stablePolls = 0;
  }
}

/* -------------------------------------------------------------------- boot */

function ensureDirs() {
  for (const dir of ['data', 'data/products', 'logs']) {
    fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
  }
}

function ensureUrls() {
  const urls = path.join(ROOT, 'urls.json');
  if (fs.existsSync(urls)) return;
  const sample = path.join(ROOT, 'urls.sample.json');
  if (!fs.existsSync(sample)) {
    throw new Error('urls.json is missing and there is no urls.sample.json to seed it from');
  }
  fs.copyFileSync(sample, urls);
  log('seeded urls.json from urls.sample.json');
}

async function main() {
  ensureDirs();
  ensureUrls();

  log(`=== ${SPIDER} crawl starting ===`);
  log(`queue server: ${SERVER}`);
  if (MAX_PRODUCTS > 0) log(`product limit: ${MAX_PRODUCTS}`);

  startServer();
  if (!(await waitForServer())) {
    await fail(`queue server did not respond within ${SERVER_START_TIMEOUT_MS} ms`);
    return;
  }
  log('queue server is up');

  startWorkers();

  await tick();
  monitorTimer = setInterval(() => {
    tick().catch((e) => log(`monitor error: ${e.message}`));
  }, STATUS_INTERVAL_MS);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`${signal} received — stopping`);
    await stopAll();
    process.exit(signal === 'SIGTERM' ? 0 : 130);
  });
}

main().catch(async (e) => {
  console.error(`[supervisor] FATAL: ${e.stack || e.message}`);
  await stopAll();
  process.exit(1);
});
