#!/usr/bin/env node
/**
 * Spider platform: web UI + scheduler + runner.
 *
 *   cp .env.example .env
 *   npm install
 *   npm start
 */
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const { loadEnv } = require('./lib/env');
loadEnv();

const paths = require('./lib/paths');
paths.ensureDirs();

const store = require('./lib/store');
const runner = require('./lib/runner');
const scheduler = require('./lib/scheduler');
const auth = require('./lib/auth');
const maintenance = require('./lib/maintenance');
const { buildRouter } = require('./lib/api');
const { createLogger } = require('./lib/logger');

const log = createLogger('server');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = parseInt(process.env.PLATFORM_PORT || '8080', 10);

const app = express();
app.disable('x-powered-by');
if (process.env.BEHIND_PROXY === '1') app.set('trust proxy', 1);
app.use(cookieParser());

const PUBLIC_DIR = path.join(__dirname, 'public');

app.get('/login', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'login.html')));
app.get('/healthz', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.use('/api', (req, res, next) => {
  if (req.path === '/login' || req.path === '/logout') return next();
  return auth.requireAuth(req, res, next);
});
app.use('/api', buildRouter());

app.use(auth.requireAuth, express.static(PUBLIC_DIR));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // A browser cancelling an upload is normal, not a platform failure.
  if (err.message === 'Request aborted' || err.code === 'ECONNABORTED') {
    log.warn(`upload aborted by the browser: ${req.method} ${req.originalUrl}`);
    return;
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: `larger than the ${process.env.MAX_UPLOAD_MB || 300} MB limit — a ZIP of a whole spider folder`
        + ' includes data/ and node_modules; choose the folder instead, which sends only the code',
    });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(413).json({ error: 'too many files — remove node_modules or upload a ZIP instead' });
  }
  log.error(`unhandled: ${err.stack || err.message}`);
  if (res.headersSent) return;
  res.status(err.status || 500).json({ error: err.message || 'internal error' });
});

runner.recoverStaleRuns();
scheduler.syncAll();
maintenance.start();

const server = app.listen(PORT, HOST, () => {
  log.info(`platform listening on http://${HOST}:${PORT}`);
  log.info(`data directory: ${paths.DATA_DIR}`);
  log.info(`spiders: ${store.listSpiders().length}, chrome: ${process.env.CHROME || runner.detectChrome() || 'not found'}`);
  if (!auth.isEnabled()) {
    log.warn('ADMIN_PASSWORD is not set — only localhost requests are accepted');
  }
  if (!auth.isEnabled() && HOST !== '127.0.0.1' && HOST !== 'localhost') {
    log.error(`refusing remote access without ADMIN_PASSWORD (HOST=${HOST}); set one before exposing the UI`);
  }
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.warn(`${signal} received — shutting down`);
  scheduler.stopAll();
  server.close();
  await runner.shutdown();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  log.error(`unhandled rejection: ${(reason && reason.stack) || reason}`);
});
