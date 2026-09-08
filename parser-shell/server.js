#!/usr/bin/env node
/**
 * Parser shell: cards for every Node parser in this folder.
 *
 *   cd parser-shell
 *   npm install
 *   npm start
 *
 * Open http://127.0.0.1:8090
 */
const path = require('path');
const express = require('express');

const { loadEnv } = require('./lib/env');
loadEnv();

const paths = require('./lib/paths');
paths.ensureDirs();

const runner = require('./lib/runner');
const { buildRouter } = require('./lib/api');
const { scan, parsersRoot } = require('./lib/scan');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = parseInt(process.env.PORT || '8090', 10);

const app = express();
app.disable('x-powered-by');

const PUBLIC_DIR = path.join(__dirname, 'public');
app.use('/api', buildRouter());
app.use(express.static(PUBLIC_DIR));

app.use((err, req, res, next) => {
  console.error(`[server] ${err.stack || err.message}`);
  if (res.headersSent) return;
  res.status(500).json({ error: err.message || 'internal error' });
});

runner.recoverStaleRuns();

const server = app.listen(PORT, HOST, () => {
  const parsers = scan();
  console.log(`[shell] listening on http://${HOST}:${PORT}`);
  console.log(`[shell] parsers folder: ${parsersRoot()}`);
  console.log(`[shell] found ${parsers.length} parser(s): ${parsers.map((p) => p.slug).join(', ') || '(none)'}`);
});

function shutdown() {
  console.log('[shell] shutting down');
  runner.shutdown().finally(() => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 8000);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
