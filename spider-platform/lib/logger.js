/**
 * Platform-level logging (scheduler, API, runner decisions).
 * Spider stdout/stderr goes to its own per-run log, not here.
 */
const fs = require('fs');
const path = require('path');
const { PLATFORM_LOG_DIR } = require('./paths');

const LOG_FILE = path.join(PLATFORM_LOG_DIR, 'platform.log');
const MAX_BYTES = parseInt(process.env.PLATFORM_LOG_MAX_BYTES || String(10 * 1024 * 1024), 10);

function rotateIfNeeded() {
  try {
    const st = fs.statSync(LOG_FILE);
    if (st.size < MAX_BYTES) return;
    fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
  } catch (e) {
    // no log file yet
  }
}

function write(level, scope, message) {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${scope}: ${message}`;
  if (process.env.LOG_TO_CONSOLE !== '0') {
    if (level === 'error') console.error(line);
    else console.log(line);
  }
  try {
    fs.mkdirSync(PLATFORM_LOG_DIR, { recursive: true });
    rotateIfNeeded();
    fs.appendFileSync(LOG_FILE, `${line}\n`);
  } catch (e) {
    console.error(`[logger] cannot write log: ${e.message}`);
  }
}

function createLogger(scope) {
  return {
    info: (msg) => write('info', scope, msg),
    warn: (msg) => write('warn', scope, msg),
    error: (msg) => write('error', scope, msg),
  };
}

module.exports = { createLogger, LOG_FILE };
