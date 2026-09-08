/**
 * Executes spiders as supervised child processes.
 *
 * A run is: allocate a queue port -> spawn the spider's start command in its
 * own process group -> stream stdout/stderr to a per-run log -> on clean exit
 * collect the exported files and hand them to SFTP.
 *
 * The platform deliberately owns SFTP delivery (spiders are started with
 * SKIP_SFTP=1) so that every spider delivers files the same way and failures
 * are visible in one place.
 */
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');
const { EventEmitter } = require('events');

const store = require('./store');
const paths = require('./paths');
const { createLogger } = require('./logger');
const { collectArtifacts, selectForUpload, buildRemoteNames } = require('./artifacts');
const { uploadFiles } = require('./sftp');
const { detectChrome, installHint } = require('./chrome');

const log = createLogger('runner');
const events = new EventEmitter();
events.setMaxListeners(0);

const PORT_RANGE_START = parseInt(process.env.SPIDER_PORT_START || '5100', 10);
const PORT_RANGE_END = parseInt(process.env.SPIDER_PORT_END || '5199', 10);
const LOG_TAIL_LINES = 800;
const KILL_GRACE_MS = 15000;
const DESCENDANT_POLL_MS = 20000;

/** runId -> live execution state (not persisted) */
const active = new Map();
/** FIFO of runIds waiting for a concurrency slot */
const queue = [];

// detectChrome lives in ./chrome.js — spiders always use Chrome for Testing.

/* ------------------------------------------------- descendant bookkeeping */

/**
 * Puppeteer starts Chrome detached, in its own process group, so killing the
 * spider's group does not reach the browser. We therefore keep a record of
 * every descendant seen while the run is alive and kill those explicitly.
 *
 * The recorded command line is compared again before killing, so a recycled
 * PID belonging to something else is never signalled.
 */
function psSnapshot() {
  try {
    const out = execFileSync('ps', ['-Ao', 'pid=,ppid=,command='], {
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
    const byPid = new Map();
    for (const line of out.split('\n')) {
      const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
      if (!match) continue;
      byPid.set(parseInt(match[1], 10), {
        ppid: parseInt(match[2], 10),
        cmd: match[3].trim(),
      });
    }
    return byPid;
  } catch (e) {
    return new Map();
  }
}

function collectDescendants(rootPid, snapshot) {
  const childrenOf = new Map();
  for (const [pid, info] of snapshot) {
    if (!childrenOf.has(info.ppid)) childrenOf.set(info.ppid, []);
    childrenOf.get(info.ppid).push(pid);
  }
  const found = [];
  const queue = [rootPid];
  const seen = new Set([rootPid]);
  while (queue.length) {
    for (const child of childrenOf.get(queue.shift()) || []) {
      if (seen.has(child)) continue;
      seen.add(child);
      found.push(child);
      queue.push(child);
    }
  }
  return found;
}

function trackDescendants(state) {
  const rootPid = state.proc && state.proc.pid;
  if (!rootPid) return;
  const snapshot = psSnapshot();
  for (const pid of collectDescendants(rootPid, snapshot)) {
    state.descendants.set(pid, snapshot.get(pid).cmd);
  }
}

/** Signal descendants that are still alive and still the same process. */
function sweepDescendants(state, signal) {
  if (!state.descendants.size) return 0;
  const snapshot = psSnapshot();
  let signalled = 0;
  for (const [pid, cmd] of state.descendants) {
    const current = snapshot.get(pid);
    if (!current || current.cmd !== cmd) continue; // exited, or PID reused
    try {
      process.kill(pid, signal);
      signalled += 1;
    } catch (e) {
      /* died between snapshot and signal */
    }
  }
  if (signalled) systemLine(state, `${signal} sent to ${signalled} leftover process(es)`);
  return signalled;
}

function allocatePort(preferred) {
  const used = new Set();
  for (const state of active.values()) {
    if (state.port) used.add(state.port);
  }
  if (preferred && !used.has(preferred)) return preferred;
  for (let p = PORT_RANGE_START; p <= PORT_RANGE_END; p += 1) {
    if (!used.has(p)) return p;
  }
  throw new Error('no free port in the spider port range');
}

/**
 * A folder `npm start` does not inherit Cursor/npm/HTTP_PROXY from whoever
 * launched the platform. Copying process.env wholesale was the difference
 * that made platform runs fail while the same spider worked in a terminal.
 */
const INHERIT_ENV = new Set([
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TMPDIR',
  'TMP',
  'TEMP',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TZ',
  'TERM',
  'COLORTERM',
  'DISPLAY',
  'SSH_AUTH_SOCK',
  'HOMEBREW_PREFIX',
  'HOMEBREW_CELLAR',
  'HOMEBREW_REPOSITORY',
  'NODE_EXTRA_CA_CERTS',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'XPC_SERVICE_NAME',
  'XPC_FLAGS',
  '__CF_USER_TEXT_ENCODING',
]);

const SPIDER_SECRETS = [
  'PROXY_HOST',
  'PROXY_PASS',
  'PROXY_COUNT',
  'JOHNLEWIS_API_KEY',
];

function pickEnv(keys) {
  const out = {};
  for (const key of keys) {
    if (process.env[key]) out[key] = process.env[key];
  }
  return out;
}

function buildEnv(spider, port) {
  const base = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (INHERIT_ENV.has(key) && value) base[key] = value;
  }

  // Credentials the spiders already read from env when run by hand.
  Object.assign(base, pickEnv(SPIDER_SECRETS));
  // Empty PROXY_USER in the platform .env must not wipe the spider's country.
  if (process.env.PROXY_USER) base.PROXY_USER = process.env.PROXY_USER;

  const chrome = detectChrome();
  if (chrome) base.CHROME = chrome;

  // Only variables the platform itself needs. THREADS / WINDOWS / HIDE_CHROME
  // / HEADLESS / USE_PROXY stay at the spider's own defaults unless set in
  // the UI — that is what `cd spider && npm start` does.
  const env = {
    ...base,
    LOG_TO_CONSOLE: '1',
    EXIT_ON_COMPLETE: '1',
    FORCE_RUN: '1',
    SKIP_SFTP: '1',
    ...(spider.env || {}),
  };
  env.PORT = String(port);
  env.SERVER = (spider.env && spider.env.SERVER) || `http://127.0.0.1:${port}`;
  return env;
}

function appendLog(state, text) {
  if (!text) return;
  try {
    state.logStream.write(text);
  } catch (e) {
    /* stream closed during shutdown */
  }
  state.buffer.push(text);
  if (state.buffer.length > LOG_TAIL_LINES) {
    state.buffer.splice(0, state.buffer.length - LOG_TAIL_LINES);
  }
  events.emit(`log:${state.run.id}`, text);
}

function systemLine(state, message) {
  appendLog(state, `[platform ${new Date().toISOString()}] ${message}\n`);
}

function emitUpdate(runId) {
  events.emit('runs:changed', runId);
}

/* ------------------------------------------------------------- scheduling */

function isSpiderRunning(spiderId) {
  for (const state of active.values()) {
    if (state.spider.id === spiderId) return true;
  }
  return false;
}

function isQueued(spiderId) {
  return queue.some((runId) => {
    const run = store.getRun(runId);
    return run && run.spiderId === spiderId;
  });
}

/**
 * Queue a run. Returns the created run record, or null when the spider is
 * already running/queued and `allowDuplicate` is false.
 */
function enqueue(spider, trigger = 'manual', options = {}) {
  if (!options.allowDuplicate && (isSpiderRunning(spider.id) || isQueued(spider.id))) {
    return null;
  }
  const run = store.createRun({
    spiderId: spider.id,
    spiderSlug: spider.slug,
    spiderName: spider.name,
    trigger,
    status: 'queued',
  });
  queue.push(run.id);
  log.info(`queued run ${run.id} for ${spider.slug} (${trigger})`);
  emitUpdate(run.id);
  pump();
  return run;
}

function pump() {
  const settings = store.getSettings();
  const maxConcurrent = Math.max(1, settings.maxConcurrentRuns || 1);

  for (let i = 0; i < queue.length && active.size < maxConcurrent; ) {
    const runId = queue[i];
    const run = store.getRun(runId);
    if (!run || run.status !== 'queued') {
      queue.splice(i, 1);
      continue;
    }
    const spider = store.getSpider(run.spiderId);
    if (!spider) {
      store.updateRun(runId, {
        status: 'failed',
        error: 'spider no longer exists',
        finishedAt: new Date().toISOString(),
      });
      queue.splice(i, 1);
      emitUpdate(runId);
      continue;
    }
    if (isSpiderRunning(spider.id)) {
      i += 1; // let other spiders through
      continue;
    }
    queue.splice(i, 1);
    startRun(run, spider);
  }
}

/* ------------------------------------------------------------- execution */

function startRun(run, spider) {
  const startedAt = new Date().toISOString();
  let port;
  try {
    port = allocatePort(spider.env && spider.env.PORT ? parseInt(spider.env.PORT, 10) : null);
  } catch (e) {
    store.updateRun(run.id, { status: 'failed', error: e.message, finishedAt: startedAt });
    emitUpdate(run.id);
    return;
  }

  if (!fs.existsSync(spider.dir)) {
    store.updateRun(run.id, {
      status: 'failed',
      error: `spider directory missing: ${spider.dir}`,
      startedAt,
      finishedAt: new Date().toISOString(),
    });
    emitUpdate(run.id);
    return;
  }

  fs.mkdirSync(paths.runDir(run.id), { recursive: true });
  const logStream = fs.createWriteStream(paths.runLogPath(run.id), { flags: 'a' });

  const command = spider.command || 'npm start';
  const env = buildEnv(spider, port);
  const timeoutMinutes =
    spider.timeoutMinutes || store.getSettings().defaultTimeoutMinutes || 240;

  const child = spawn(command, {
    cwd: spider.dir,
    env,
    shell: true,
    detached: true, // own process group, so we can kill the whole tree
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const state = {
    run,
    spider,
    port,
    proc: child,
    logStream,
    buffer: [],
    cancelled: false,
    timedOut: false,
    descendants: new Map(),
  };
  active.set(run.id, state);

  const updated = store.updateRun(run.id, {
    status: 'running',
    startedAt,
    port,
    pid: child.pid,
    command,
    logFile: paths.runLogPath(run.id),
    error: null,
  });
  state.run = updated;

  systemLine(state, `starting "${command}" in ${spider.dir}`);
  systemLine(state, `queue port ${port}, timeout ${timeoutMinutes} min`);
  systemLine(
    state,
    `env USE_PROXY=${env.USE_PROXY || '(spider default)'} WINDOWS=${env.WINDOWS || '(spider default)'} THREADS=${env.THREADS || '(spider default)'} HEADLESS=${env.HEADLESS || '(spider default)'}`
  );
  if (env.CHROME) systemLine(state, `chrome: ${env.CHROME}`);
  else systemLine(state, `WARNING: ${installHint().replace(/\n/g, ' ')}`);
  log.info(`run ${run.id} started (${spider.slug}, pid ${child.pid}, port ${port})`);
  emitUpdate(run.id);

  child.stdout.on('data', (chunk) => appendLog(state, chunk.toString()));
  child.stderr.on('data', (chunk) => appendLog(state, chunk.toString()));

  trackDescendants(state);
  state.descendantTimer = setInterval(() => trackDescendants(state), DESCENDANT_POLL_MS);

  state.timer = setTimeout(() => {
    state.timedOut = true;
    systemLine(state, `timeout after ${timeoutMinutes} min — terminating`);
    killTree(state);
  }, timeoutMinutes * 60 * 1000);

  child.on('error', (e) => {
    systemLine(state, `spawn error: ${e.message}`);
    state.spawnError = e.message;
  });

  child.on('exit', (code, signal) => {
    finalize(state, code, signal).catch((e) => {
      log.error(`finalize failed for ${run.id}: ${e.stack || e.message}`);
    });
  });
}

function killTree(state, signal = 'SIGTERM') {
  const pid = state.proc && state.proc.pid;
  if (!pid) return;

  // Refresh the descendant list first: after the parents die the parent/child
  // links are gone and orphaned browsers can no longer be identified.
  trackDescendants(state);

  try {
    process.kill(-pid, signal); // negative pid = whole process group
  } catch (e) {
    try {
      state.proc.kill(signal);
    } catch (e2) {
      /* already dead */
    }
  }
  sweepDescendants(state, signal);

  if (signal === 'SIGTERM' && !state.killTimer) {
    state.killTimer = setTimeout(() => {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch (e) {
        /* already dead */
      }
      sweepDescendants(state, 'SIGKILL');
    }, KILL_GRACE_MS);
  }
}

function cancel(runId) {
  const state = active.get(runId);
  if (state) {
    state.cancelled = true;
    systemLine(state, 'cancel requested');
    killTree(state);
    return true;
  }
  const idx = queue.indexOf(runId);
  if (idx !== -1) {
    queue.splice(idx, 1);
    store.updateRun(runId, {
      status: 'cancelled',
      finishedAt: new Date().toISOString(),
      error: 'cancelled while queued',
    });
    emitUpdate(runId);
    return true;
  }
  return false;
}

/* -------------------------------------------------------------- finishing */

async function finalize(state, code, signal) {
  const { run, spider } = state;
  clearTimeout(state.timer);
  clearTimeout(state.killTimer);
  clearInterval(state.descendantTimer);

  // A spider that exits without closing its browser leaves Chrome running,
  // which would accumulate until the machine runs out of memory.
  sweepDescendants(state, 'SIGTERM');

  let status;
  let error = null;
  if (state.cancelled) {
    status = 'cancelled';
    error = 'cancelled by user';
  } else if (state.timedOut) {
    status = 'timeout';
    error = 'run exceeded its timeout';
  } else if (state.spawnError) {
    status = 'failed';
    error = state.spawnError;
  } else if (code === 0) {
    status = 'success';
  } else {
    status = 'failed';
    error = `exited with code ${code}${signal ? ` (signal ${signal})` : ''}`;
  }

  systemLine(state, `process exited code=${code} signal=${signal || '-'} → ${status}`);

  // Exports are collected even for failed runs: partial data is often useful,
  // but only successful runs are delivered over SFTP.
  let artifacts = [];
  try {
    artifacts = collectArtifacts(spider, { ...run, startedAt: run.startedAt });
    if (artifacts.length) {
      systemLine(
        state,
        `collected ${artifacts.length} file(s): ${artifacts.map((a) => a.relPath).join(', ')}`
      );
    } else {
      systemLine(state, 'no output files matched the spider output patterns');
    }
  } catch (e) {
    systemLine(state, `artifact collection failed: ${e.message}`);
  }

  let uploadError = null;
  // Upload whenever SFTP is on for the spider. An empty remoteDir still
  // resolves to SFTP_REMOTE_PATH from the platform .env.
  const sftpEnabled = !!(spider.sftp && spider.sftp.enabled);
  if (status === 'success' && sftpEnabled) {
    const toUpload = selectForUpload(artifacts, spider);
    if (!toUpload.length) {
      // Delivery is the point of a scheduled crawl, so a run that reaches this
      // step with no CSV has not succeeded, however cleanly the process exited.
      status = 'failed';
      error = 'no output file matched the upload patterns — nothing to deliver';
      systemLine(state, `NO OUTPUT: ${error}`);
    } else {
      const remoteNames = buildRemoteNames(toUpload, spider, run, store.getSettings().timezone);
      for (const a of artifacts) {
        if (remoteNames.has(a.path)) a.remoteName = remoteNames.get(a.path);
      }
      try {
        systemLine(state, `SFTP: uploading ${toUpload.length} file(s)...`);
        const uploaded = await uploadFiles(
          toUpload.map((a) => ({ ...a, remoteName: remoteNames.get(a.path) })),
          spider,
          (msg) => systemLine(state, `SFTP: ${msg}`)
        );
        const remoteByLocal = new Map(uploaded.map((u) => [u.local, u.remote]));
        for (const a of artifacts) {
          if (remoteByLocal.has(a.path)) {
            a.uploaded = true;
            a.remote = remoteByLocal.get(a.path);
          }
        }
        systemLine(state, `SFTP: done (${uploaded.length} file(s))`);
      } catch (e) {
        uploadError = e.message;
        // Extraction worked and only delivery failed. Its own status keeps that
        // distinct from a broken crawl; the archived CSV stays for a retry.
        status = 'upload_failed';
        error = `SFTP upload failed: ${e.message}`;
        systemLine(state, `SFTP FAILED: ${e.message} — files kept locally, retry from the UI`);
      }
    }
  } else if (status === 'success' && !sftpEnabled) {
    systemLine(state, 'SFTP disabled for this spider — files kept locally only');
  }

  const finishedAt = new Date().toISOString();
  const durationMs = run.startedAt ? Date.parse(finishedAt) - Date.parse(run.startedAt) : null;

  store.updateRun(run.id, {
    status,
    error,
    uploadError,
    exitCode: code,
    signal: signal || null,
    finishedAt,
    durationMs,
    artifacts,
  });

  // Collecting files and uploading gave anything still running time to exit.
  sweepDescendants(state, 'SIGKILL');

  systemLine(state, `run ${status}`);
  await new Promise((resolve) => state.logStream.end(resolve));
  active.delete(run.id);
  log.info(`run ${run.id} finished: ${status}`);
  emitUpdate(run.id);
  pump();
}

/* ----------------------------------------------------------------- access */

function getLiveState(runId) {
  return active.get(runId) || null;
}

function getLogTail(runId, maxBytes = 200000) {
  const state = active.get(runId);
  if (state) return state.buffer.join('');
  const file = paths.runLogPath(runId);
  if (!fs.existsSync(file)) return '';
  const stat = fs.statSync(file);
  const start = Math.max(0, stat.size - maxBytes);
  const fd = fs.openSync(file, 'r');
  try {
    const length = stat.size - start;
    const buf = Buffer.alloc(length);
    fs.readSync(fd, buf, 0, length, start);
    return buf.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function activeRuns() {
  return Array.from(active.values()).map((s) => ({
    runId: s.run.id,
    spiderId: s.spider.id,
    spiderSlug: s.spider.slug,
    pid: s.proc.pid,
    port: s.port,
  }));
}

function queuedRunIds() {
  return queue.slice();
}

/** After a platform restart, runs recorded as active are no longer real. */
function recoverStaleRuns() {
  const stale = store
    .listRuns({})
    .filter((r) => r.status === 'running' || r.status === 'queued');
  for (const run of stale) {
    store.updateRun(run.id, {
      status: 'failed',
      error: 'platform restarted while the run was active',
      finishedAt: new Date().toISOString(),
    });
  }
  if (stale.length) log.warn(`marked ${stale.length} interrupted run(s) as failed`);
}

async function shutdown() {
  for (const state of active.values()) {
    state.cancelled = true;
    systemLine(state, 'platform shutting down — terminating spider');
    killTree(state);
  }
  const deadline = Date.now() + KILL_GRACE_MS + 5000;
  while (active.size && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250));
  }
}

module.exports = {
  events,
  enqueue,
  cancel,
  pump,
  getLogTail,
  getLiveState,
  activeRuns,
  queuedRunIds,
  isSpiderRunning,
  recoverStaleRuns,
  shutdown,
  detectChrome,
};
