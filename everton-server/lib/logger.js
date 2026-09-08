/**
 * Append-only file logger for unattended server runs.
 *
 * logs/run.log       — all worker/server output (tail -f this)
 * logs/progress.log  — periodic status snapshots only
 */
const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');
const RUN_LOG = path.join(LOG_DIR, 'run.log');
const PROGRESS_LOG = path.join(LOG_DIR, 'progress.log');

fs.mkdirSync(LOG_DIR, { recursive: true });

function ts() {
  return new Date().toISOString();
}

function append(file, line) {
  fs.appendFileSync(file, line);
}

function toConsole(line) {
  if (process.env.LOG_TO_CONSOLE === '0') return;
  process.stdout.write(line);
}

function logLine(prefix, msg) {
  const line = `[${ts()}]${prefix ? ` [${prefix}]` : ''} ${msg}\n`;
  append(RUN_LOG, line);
  toConsole(line);
}

function progressLine(msg) {
  const line = `[${ts()}] ${msg}\n`;
  append(PROGRESS_LOG, line);
  append(RUN_LOG, line);
  toConsole(line);
}

function createChildLogger(prefix) {
  return {
    info: (m) => logLine(prefix, m),
    warn: (m) => logLine(prefix, 'WARN ' + m),
    error: (m) => logLine(prefix, 'ERROR ' + m),
  };
}

function pipeChildOutput(prefix, stream, isErr) {
  let buf = '';
  stream.on('data', (chunk) => {
    buf += chunk.toString();
    const parts = buf.split('\n');
    buf = parts.pop() || '';
    for (const part of parts) {
      const msg = part.replace(/\r$/, '');
      if (!msg) continue;
      const line = `[${ts()}] [${prefix}]${isErr ? ' ERR' : ''} ${msg}\n`;
      append(RUN_LOG, line);
      toConsole(line);
    }
  });
  stream.on('end', () => {
    if (buf.trim()) {
      const line = `[${ts()}] [${prefix}]${isErr ? ' ERR' : ''} ${buf}\n`;
      append(RUN_LOG, line);
      toConsole(line);
    }
  });
}

module.exports = {
  LOG_DIR,
  RUN_LOG,
  PROGRESS_LOG,
  logLine,
  progressLine,
  createChildLogger,
  pipeChildOutput,
};
