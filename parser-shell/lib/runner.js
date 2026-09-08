/**
 * Start a parser the same way a Terminal window would.
 *
 * The shell does not wrap, rewrite, or host the crawl. It opens a login zsh
 * in the parser folder and runs:
 *
 *   USE_PROXY=… THREADS=… WINDOWS=… npm start
 *
 * stdout/stderr are copied into a log file so the UI can show them. When
 * npm start exits, the shell picks up the CSV and uploads it to SFTP.
 */
const fs = require('fs');
const os = require('os');
const { spawn, execFileSync } = require('child_process');
const { EventEmitter } = require('events');

const store = require('./store');
const paths = require('./paths');
const { collectCsv } = require('./artifacts');
const { uploadFiles, remoteFilename } = require('./sftp');

const events = new EventEmitter();
events.setMaxListeners(0);

const log = {
  info: (msg) => console.log(`[runner] ${msg}`),
};

const LOG_TAIL_LINES = 1200;
const KILL_GRACE_MS = 15000;
const DESCENDANT_POLL_MS = 20000;
const SHELL = process.env.SHELL || '/bin/zsh';

/** runId -> live execution */
const active = new Map();

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

function sweepDescendants(state, signal) {
  if (!state.descendants.size) return 0;
  const snapshot = psSnapshot();
  let signalled = 0;
  for (const [pid, cmd] of state.descendants) {
    const current = snapshot.get(pid);
    if (!current || current.cmd !== cmd) continue;
    try {
      process.kill(pid, signal);
      signalled += 1;
    } catch (e) {
      /* died between snapshot and signal */
    }
  }
  if (signalled) systemLine(state, `stop: ${signal} sent to ${signalled} leftover process(es)`);
  return signalled;
}

/**
 * Environment of a fresh Terminal.app window: home, locale, then the user's
 * login shell rebuilds PATH from /etc/zprofile and ~/.zprofile / ~/.zshrc.
 *
 * Cursor / npm / HTTP_PROXY variables from the process that started this
 * shell are deliberately left out — they are the reason the old platform
 * crawl differed from a manual `npm start`.
 */
function terminalEnv() {
  const env = {
    HOME: os.homedir(),
    USER: process.env.USER || '',
    LOGNAME: process.env.LOGNAME || process.env.USER || '',
    SHELL,
    TMPDIR: process.env.TMPDIR || '/tmp',
    TMP: process.env.TMP || '/tmp',
    TEMP: process.env.TEMP || '/tmp',
    TERM: process.env.TERM || 'xterm-256color',
    LANG: process.env.LANG || 'en_US.UTF-8',
    LC_ALL: process.env.LC_ALL || '',
    LC_CTYPE: process.env.LC_CTYPE || '',
    PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
    __CF_USER_TEXT_ENCODING: process.env.__CF_USER_TEXT_ENCODING || '',
  };

  if (process.env.SSH_AUTH_SOCK) env.SSH_AUTH_SOCK = process.env.SSH_AUTH_SOCK;

  // Credentials the parsers already read when launched by hand.
  // PROXY_USER is not copied: an empty value would wipe each spider's country.
  if (process.env.PROXY_HOST) env.PROXY_HOST = process.env.PROXY_HOST;
  if (process.env.PROXY_PASS) env.PROXY_PASS = process.env.PROXY_PASS;
  if (process.env.PROXY_COUNT) env.PROXY_COUNT = process.env.PROXY_COUNT;
  if (process.env.JOHNLEWIS_API_KEY) env.JOHNLEWIS_API_KEY = process.env.JOHNLEWIS_API_KEY;

  return env;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function buildCommand(parser, settings) {
  const useProxy = settings.network === 'proxyrack';
  const assigns = [
    `USE_PROXY=${useProxy ? '1' : '0'}`,
    `THREADS=${settings.tabs}`,
    `WINDOWS=${settings.windows}`,
    'SKIP_SFTP=1',
    'FORCE_RUN=1',
  ];
  return `cd ${shellQuote(parser.dir)} && ${assigns.join(' ')} npm start`;
}

function appendLog(state, text) {
  if (!text) return;
  try {
    state.logStream.write(text);
  } catch (e) {
    /* stream closed */
  }
  state.buffer.push(text);
  if (state.buffer.length > LOG_TAIL_LINES) {
    state.buffer.splice(0, state.buffer.length - LOG_TAIL_LINES);
  }
  events.emit(`log:${state.run.id}`, text);
}

function systemLine(state, message) {
  appendLog(state, `[shell ${new Date().toISOString()}] ${message}\n`);
}

function emitUpdate(runId) {
  events.emit('runs:changed', runId);
}

function isParserRunning(parserId) {
  for (const state of active.values()) {
    if (state.parser.id === parserId) return true;
  }
  return false;
}

function start(parser, settings) {
  if (isParserRunning(parser.id)) return null;
  if (!fs.existsSync(parser.dir)) {
    throw new Error(`parser folder missing: ${parser.dir}`);
  }
  if (settings.network === 'proxyrack' && !process.env.PROXY_PASS) {
    throw new Error('PROXY_PASS is not set in parser-shell/.env — needed for ProxyRack');
  }

  const startedAt = new Date().toISOString();
  const run = store.createRun({
    parserId: parser.id,
    parserSlug: parser.slug,
    parserName: parser.name,
    status: 'running',
    startedAt,
    network: settings.network,
    tabs: settings.tabs,
    windows: settings.windows,
    command: 'npm start',
    error: null,
  });

  fs.mkdirSync(paths.runDir(run.id), { recursive: true });
  const logStream = fs.createWriteStream(paths.runLogPath(run.id), { flags: 'a' });
  const command = buildCommand(parser, settings);

  const child = spawn(SHELL, ['-lic', command], {
    cwd: parser.dir,
    env: terminalEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  const state = {
    run,
    parser,
    settings,
    proc: child,
    logStream,
    buffer: [],
    cancelled: false,
    descendants: new Map(),
  };
  active.set(run.id, state);

  store.updateRun(run.id, { pid: child.pid, logFile: paths.runLogPath(run.id) });

  systemLine(state, `starting in ${parser.dir}`);
  systemLine(
    state,
    `same as Terminal: USE_PROXY=${settings.network === 'proxyrack' ? '1' : '0'} THREADS=${settings.tabs} WINDOWS=${settings.windows} npm start`
  );
  systemLine(
    state,
    `network=${settings.network === 'proxyrack' ? 'ProxyRack' : 'VPN / system'}  ${settings.windows} window(s) × ${settings.tabs} tab(s)`
  );
  log.info(`run ${run.id} started (${parser.slug}, pid ${child.pid})`);
  emitUpdate(run.id);

  child.stdout.on('data', (chunk) => appendLog(state, chunk.toString()));
  child.stderr.on('data', (chunk) => appendLog(state, chunk.toString()));

  trackDescendants(state);
  state.descendantTimer = setInterval(() => trackDescendants(state), DESCENDANT_POLL_MS);

  child.on('error', (e) => {
    systemLine(state, `spawn error: ${e.message}`);
    state.spawnError = e.message;
  });

  child.on('exit', (code, signal) => {
    finalize(state, code, signal).catch((e) => {
      console.error(`[runner] finalize failed for ${run.id}: ${e.stack || e.message}`);
    });
  });

  return run;
}

function killTree(state, signal = 'SIGTERM') {
  const pid = state.proc && state.proc.pid;
  if (!pid) return;

  trackDescendants(state);

  try {
    process.kill(-pid, signal);
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
  if (!state) return false;
  state.cancelled = true;
  systemLine(state, 'stop requested');
  killTree(state);
  return true;
}

async function finalize(state, code, signal) {
  const { run, parser } = state;
  clearTimeout(state.killTimer);
  clearInterval(state.descendantTimer);
  sweepDescendants(state, 'SIGTERM');

  let status;
  let error = null;
  if (state.cancelled) {
    status = 'cancelled';
    error = 'stopped';
  } else if (state.spawnError) {
    status = 'failed';
    error = state.spawnError;
  } else if (code === 0) {
    status = 'success';
  } else {
    status = 'failed';
    error = `exited with code ${code}${signal ? ` (signal ${signal})` : ''}`;
  }

  systemLine(state, `npm start exited code=${code} signal=${signal || '-'} → ${status}`);

  let artifacts = [];
  try {
    artifacts = collectCsv(parser, { ...run, startedAt: run.startedAt });
    if (artifacts.length) {
      systemLine(state, `found CSV: ${artifacts.map((a) => a.relPath).join(', ')}`);
    } else {
      systemLine(state, 'no CSV written in the parser folder');
    }
  } catch (e) {
    systemLine(state, `CSV collection failed: ${e.message}`);
  }

  let uploadError = null;
  if (status === 'success') {
    if (!artifacts.length) {
      status = 'failed';
      error = 'npm start finished but no CSV was written';
      systemLine(state, `NO OUTPUT: ${error}`);
    } else {
      for (const a of artifacts) {
        a.remoteName = remoteFilename(parser.slug, a.name, run.startedAt);
      }
      try {
        systemLine(state, `SFTP: uploading ${artifacts.length} file(s) to Dmitry…`);
        const uploaded = await uploadFiles(artifacts, (msg) => systemLine(state, `SFTP: ${msg}`));
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
        status = 'upload_failed';
        error = `SFTP upload failed: ${e.message}`;
        systemLine(state, `SFTP FAILED: ${e.message} — CSV kept locally, retry from the UI`);
      }
    }
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

  sweepDescendants(state, 'SIGKILL');
  systemLine(state, `run ${status}`);
  await new Promise((resolve) => state.logStream.end(resolve));
  active.delete(run.id);
  log.info(`run ${run.id} finished: ${status}`);
  emitUpdate(run.id);
}

async function reupload(runId) {
  const run = store.getRun(runId);
  if (!run) throw new Error('run not found');
  const files = (run.artifacts || []).filter((a) => a.path && fs.existsSync(a.path));
  if (!files.length) throw new Error('no local CSV left to upload');

  for (const a of files) {
    a.remoteName = a.remoteName || remoteFilename(run.parserSlug, a.name, run.startedAt);
  }

  const uploaded = await uploadFiles(files);
  const remoteByLocal = new Map(uploaded.map((u) => [u.local, u.remote]));
  const artifacts = (run.artifacts || []).map((a) => {
    if (!remoteByLocal.has(a.path)) return a;
    return { ...a, uploaded: true, remote: remoteByLocal.get(a.path) };
  });
  return store.updateRun(runId, {
    status: 'success',
    error: null,
    uploadError: null,
    artifacts,
  });
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
    const buf = Buffer.alloc(stat.size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    return buf.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function recoverStaleRuns() {
  const stale = store.listRuns().filter((r) => r.status === 'running');
  for (const run of stale) {
    store.updateRun(run.id, {
      status: 'failed',
      error: 'shell restarted while the run was active',
      finishedAt: new Date().toISOString(),
    });
  }
}

async function shutdown() {
  for (const state of active.values()) {
    state.cancelled = true;
    systemLine(state, 'shell shutting down — stopping parser');
    killTree(state);
  }
  const deadline = Date.now() + KILL_GRACE_MS + 5000;
  while (active.size && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250));
  }
}

module.exports = {
  events,
  start,
  cancel,
  reupload,
  getLogTail,
  isParserRunning,
  recoverStaleRuns,
  shutdown,
  active,
};
