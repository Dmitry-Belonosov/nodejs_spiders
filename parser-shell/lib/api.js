const express = require('express');
const { scan, parsersRoot } = require('./scan');
const store = require('./store');
const runner = require('./runner');
const sftp = require('./sftp');

function decorate(parser) {
  const settings = store.getParserSettings(parser.id);
  const lastRun = store.lastRunFor(parser.id);
  return {
    ...parser,
    settings,
    running: runner.isParserRunning(parser.id),
    lastRun: lastRun
      ? {
          id: lastRun.id,
          status: lastRun.status,
          startedAt: lastRun.startedAt,
          finishedAt: lastRun.finishedAt,
          error: lastRun.error || null,
        }
      : null,
  };
}

function findParser(id) {
  return scan().find((p) => p.id === id) || null;
}

function buildRouter() {
  const router = express.Router();
  router.use(express.json({ limit: '1mb' }));

  router.get('/state', (req, res) => {
    const parsers = scan().map(decorate);
    res.json({
      parsersRoot: parsersRoot(),
      parsers,
      runs: store.listRuns().slice(0, 80),
    });
  });

  router.patch('/parsers/:id', (req, res) => {
    const parser = findParser(req.params.id);
    if (!parser) return res.status(404).json({ error: 'parser not found' });
    const settings = store.saveParserSettings(parser.id, req.body || {});
    res.json({ parser: decorate({ ...parser }), settings });
  });

  router.post('/parsers/:id/run', (req, res) => {
    const parser = findParser(req.params.id);
    if (!parser) return res.status(404).json({ error: 'parser not found' });
    if (runner.isParserRunning(parser.id)) {
      return res.status(409).json({ error: 'this parser is already running' });
    }
    if (req.body && Object.keys(req.body).length) {
      store.saveParserSettings(parser.id, req.body);
    }
    const settings = store.getParserSettings(parser.id);
    try {
      const run = runner.start(parser, settings);
      res.json({ run });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post('/runs/:id/cancel', (req, res) => {
    if (!runner.cancel(req.params.id)) {
      return res.status(404).json({ error: 'run is not active' });
    }
    res.json({ ok: true });
  });

  router.post('/runs/:id/reupload', async (req, res) => {
    try {
      const run = await runner.reupload(req.params.id);
      res.json({ run });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.get('/runs/:id/log', (req, res) => {
    const run = store.getRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'run not found' });
    res.type('text/plain').send(runner.getLogTail(run.id));
  });

  router.get('/runs/:id/stream', (req, res) => {
    const run = store.getRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'run not found' });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send('log', runner.getLogTail(run.id));

    const onLog = (chunk) => send('log', chunk);
    runner.events.on(`log:${run.id}`, onLog);

    const onChange = (runId) => {
      if (runId !== run.id) return;
      const fresh = store.getRun(run.id);
      if (fresh) send('status', fresh);
    };
    runner.events.on('runs:changed', onChange);

    const heartbeat = setInterval(() => res.write(': ping\n\n'), 20000);

    req.on('close', () => {
      clearInterval(heartbeat);
      runner.events.off(`log:${run.id}`, onLog);
      runner.events.off('runs:changed', onChange);
    });
  });

  router.post('/sftp/test', async (req, res) => {
    try {
      const result = await sftp.testConnection();
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
}

module.exports = { buildRouter };
