/**
 * REST API used by the web UI.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');

const store = require('./store');
const runner = require('./runner');
const scheduler = require('./scheduler');
const scheduleModel = require('./schedule');
const packages = require('./packages');
const artifacts = require('./artifacts');
const sftp = require('./sftp');
const paths = require('./paths');
const auth = require('./auth');
const { createLogger } = require('./logger');

const log = createLogger('api');

const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '300', 10);

const upload = multer({
  dest: paths.UPLOADS_DIR,
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024,
    files: parseInt(process.env.MAX_UPLOAD_FILES || '20000', 10),
  },
  fileFilter: (req, file, cb) => {
    // "archive" is a single ZIP; "files" is a browser folder upload.
    if (file.fieldname === 'archive' && !/\.zip$/i.test(file.originalname)) {
      return cb(new Error('only .zip archives are accepted'));
    }
    cb(null, true);
  },
});

// A spider can arrive either as one ZIP or as every file of a folder.
const acceptSpiderCode = upload.fields([
  { name: 'archive', maxCount: 1 },
  { name: 'files' },
]);

function uploadedCode(req) {
  const archive = (req.files && req.files.archive && req.files.archive[0]) || null;
  const files = (req.files && req.files.files) || [];
  const relativePaths = parseJsonField(req.body.relativePaths, []);
  return {
    archive,
    files: files.map((file, i) => ({
      tmpPath: file.path,
      relativePath: relativePaths[i] || file.originalname,
    })),
    tmpPaths: [archive, ...files].filter(Boolean).map((f) => f.path),
  };
}

function cleanupUploads(tmpPaths) {
  for (const tmp of tmpPaths) fs.rm(tmp, { force: true }, () => {});
}

/** Logged for every upload so a slow or stuck attempt can be traced afterwards. */
function logReceived(what, code) {
  const parts = [];
  if (code.archive) parts.push(`ZIP ${code.archive.originalname} (${Math.round(code.archive.size / 1024)} KB)`);
  if (code.files.length) parts.push(`${code.files.length} files from a folder`);
  log.info(`received ${what}: ${parts.join(' + ') || 'nothing'}`);
}

/** Name a spider after the ZIP or the uploaded folder when the user left it blank. */
function deriveName(req, code) {
  const given = String(req.body.name || '').trim();
  if (given) return given;
  if (code.archive) return code.archive.originalname.replace(/\.zip$/i, '');
  const first = code.files.find((f) => f.relativePath.includes('/'));
  return first ? first.relativePath.split('/')[0] : '';
}

const DEFAULT_OUTPUT_PATTERNS = ['*.csv', '*.jsonl'];
const DEFAULT_UPLOAD_PATTERNS = ['*.csv'];

function defaultSftp(reqBody) {
  const remoteDir =
    (reqBody && reqBody.remoteDir) ||
    process.env.SFTP_REMOTE_PATH ||
    process.env.SFTP_REMOTE_DIR ||
    '';
  return {
    enabled: !!(process.env.SFTP_HOST && remoteDir),
    remoteDir,
    uploadPatterns: DEFAULT_UPLOAD_PATTERNS,
  };
}

function asStringMap(value) {
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const [k, v] of Object.entries(value)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) continue;
    out[k] = String(v);
  }
  return out;
}

function asPatternList(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const list = value.map((v) => String(v).trim()).filter(Boolean);
  return list.length ? list : fallback;
}

function parseJsonField(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

/** Public view of a spider: secrets masked, schedule state resolved. */
function presentSpider(spider) {
  const lastRun = store.lastRunForSpider(spider.id);
  const sftpCfg = spider.sftp || {};
  return {
    ...spider,
    sftp: { ...sftpCfg, pass: sftpCfg.pass ? '********' : '' },
    running: runner.isSpiderRunning(spider.id),
    scheduleText: scheduleModel.describe(spider.schedule),
    nextRun: scheduler.nextRunFor(spider.id),
    lastRun: lastRun
      ? {
          id: lastRun.id,
          status: lastRun.status,
          startedAt: lastRun.startedAt,
          finishedAt: lastRun.finishedAt,
          durationMs: lastRun.durationMs,
          artifactCount: (lastRun.artifacts || []).length,
          error: lastRun.error,
        }
      : null,
  };
}

function buildRouter() {
  const router = express.Router();

  /* ------------------------------------------------------------- session */

  router.post('/login', express.json(), (req, res) => {
    if (!auth.isEnabled()) return res.json({ ok: true, authDisabled: true });
    if (!auth.checkPassword(req.body && req.body.password)) {
      return res.status(401).json({ error: 'wrong password' });
    }
    res.cookie(auth.COOKIE_NAME, auth.createToken(), auth.cookieOptions());
    res.json({ ok: true });
  });

  router.post('/logout', (req, res) => {
    res.clearCookie(auth.COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  });

  /* -------------------------------------------------------------- state */

  router.get('/state', (req, res) => {
    res.json({
      spiders: store.listSpiders().map(presentSpider),
      settings: { ...store.getSettings(), maxUploadMb: MAX_UPLOAD_MB },
      activeRuns: runner.activeRuns(),
      queuedRuns: runner.queuedRunIds(),
      recentRuns: store.listRuns({ limit: 25 }),
      chrome: process.env.CHROME || runner.detectChrome(),
      authEnabled: auth.isEnabled(),
    });
  });

  router.get('/settings', (req, res) => res.json({ ...store.getSettings(), maxUploadMb: MAX_UPLOAD_MB }));

  router.patch('/settings', express.json(), (req, res) => {
    const patch = {};
    if (req.body.maxConcurrentRuns !== undefined) {
      patch.maxConcurrentRuns = Math.max(1, parseInt(req.body.maxConcurrentRuns, 10) || 1);
    }
    if (req.body.defaultTimeoutMinutes !== undefined) {
      patch.defaultTimeoutMinutes = Math.max(1, parseInt(req.body.defaultTimeoutMinutes, 10) || 240);
    }
    if (req.body.timezone !== undefined) patch.timezone = String(req.body.timezone);
    const settings = store.updateSettings(patch);
    scheduler.syncAll();
    runner.pump();
    res.json(settings);
  });

  router.post('/validate-schedule', express.json(), (req, res) => {
    const timezone = store.getSettings().timezone;
    res.json(scheduler.validateSchedule(req.body || {}, timezone));
  });

  /* ------------------------------------------------------------ spiders */

  router.get('/spiders', (req, res) => {
    res.json(store.listSpiders().map(presentSpider));
  });

  router.get('/spiders/:id', (req, res) => {
    const spider = store.getSpider(req.params.id);
    if (!spider) return res.status(404).json({ error: 'spider not found' });
    res.json(presentSpider(spider));
  });

  // Create from an uploaded ZIP or folder.
  router.post('/spiders', acceptSpiderCode, async (req, res) => {
    const code = uploadedCode(req);
    logReceived('new spider', code);
    if (!code.archive && !code.files.length) {
      return res.status(400).json({ error: 'no spider folder or ZIP uploaded' });
    }
    try {
      const name = deriveName(req, code);
      const slug = packages.slugify(req.body.slug || name);
      packages.assertSafeSlug(slug);
      if (store.getSpiderBySlug(slug)) {
        return res.status(409).json({ error: `a spider named "${name}" already exists` });
      }

      const installDeps = req.body.installDeps !== '0';
      const result = code.archive
        ? await packages.installFromZip(code.archive.path, { slug, installDeps })
        : await packages.installFromFiles(code.files, { slug, installDeps });

      const settings = store.getSettings();
      const spider = store.createSpider({
        slug,
        name: name || slug,
        dir: result.dir,
        source: 'upload',
        command: req.body.command || result.inspection.command || 'npm start',
        enabled: true,
        schedule: scheduleModel.defaultSchedule(settings.timezone),
        env: asStringMap(parseJsonField(req.body.env, {})),
        timeoutMinutes: null,
        outputPatterns: DEFAULT_OUTPUT_PATTERNS,
        sftp: defaultSftp(req.body),
      });

      scheduler.scheduleSpider(spider);
      res.status(201).json({
        spider: presentSpider(spider),
        warnings: result.inspection.warnings,
        install: result.install,
      });
    } catch (e) {
      log.error(`spider upload failed: ${e.message}`);
      res.status(400).json({ error: e.message });
    } finally {
      cleanupUploads(code.tmpPaths);
    }
  });

  // Register a folder that already exists on disk (no copying).
  router.post('/spiders/link', express.json(), (req, res) => {
    try {
      const dir = path.resolve(String(req.body.dir || ''));
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        return res.status(400).json({ error: `not a directory: ${dir}` });
      }
      const name = (req.body.name || path.basename(dir)).trim();
      const slug = packages.slugify(req.body.slug || name);
      packages.assertSafeSlug(slug);
      if (store.getSpiderBySlug(slug)) {
        return res.status(409).json({ error: `a spider with slug "${slug}" already exists` });
      }

      const inspection = packages.inspectSpiderDir(dir);
      const settings = store.getSettings();
      const spider = store.createSpider({
        slug,
        name,
        dir,
        source: 'link',
        command: req.body.command || inspection.command || 'npm start',
        enabled: true,
        schedule: scheduleModel.defaultSchedule(settings.timezone),
        env: asStringMap(req.body.env),
        timeoutMinutes: null,
        outputPatterns: DEFAULT_OUTPUT_PATTERNS,
        sftp: defaultSftp(req.body),
      });

      scheduler.scheduleSpider(spider);
      res.status(201).json({ spider: presentSpider(spider), warnings: inspection.warnings });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Replace the code of an existing spider.
  router.post('/spiders/:id/archive', acceptSpiderCode, async (req, res) => {
    const code = uploadedCode(req);
    logReceived(`new code for ${req.params.id}`, code);
    const spider = store.getSpider(req.params.id);
    if (!spider) {
      cleanupUploads(code.tmpPaths);
      return res.status(404).json({ error: 'spider not found' });
    }
    if (spider.source === 'link') {
      cleanupUploads(code.tmpPaths);
      return res.status(400).json({ error: 'linked spiders are updated on disk, not via upload' });
    }
    if (!code.archive && !code.files.length) {
      return res.status(400).json({ error: 'no spider folder or ZIP uploaded' });
    }
    if (runner.isSpiderRunning(spider.id)) {
      cleanupUploads(code.tmpPaths);
      return res.status(409).json({ error: 'spider is running; wait for it to finish' });
    }

    try {
      const installDeps = req.body.installDeps !== '0';
      const result = code.archive
        ? await packages.installFromZip(code.archive.path, { slug: spider.slug, installDeps })
        : await packages.installFromFiles(code.files, { slug: spider.slug, installDeps });
      const updated = store.updateSpider(spider.id, { dir: result.dir });
      res.json({
        spider: presentSpider(updated),
        warnings: result.inspection.warnings,
        restored: result.restored,
        install: result.install,
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    } finally {
      cleanupUploads(code.tmpPaths);
    }
  });

  router.patch('/spiders/:id', express.json(), (req, res) => {
    const spider = store.getSpider(req.params.id);
    if (!spider) return res.status(404).json({ error: 'spider not found' });

    const patch = {};
    const body = req.body || {};

    if (body.name !== undefined) patch.name = String(body.name).trim() || spider.name;
    if (body.command !== undefined) patch.command = String(body.command).trim() || 'npm start';
    if (body.enabled !== undefined) patch.enabled = !!body.enabled;
    if (body.env !== undefined) patch.env = asStringMap(body.env);
    if (body.dir !== undefined) {
      const dir = path.resolve(String(body.dir));
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        return res.status(400).json({ error: `not a directory: ${dir}` });
      }
      patch.dir = dir;
      patch.source = 'link';
    }
    if (body.outputPatterns !== undefined) {
      patch.outputPatterns = asPatternList(body.outputPatterns, DEFAULT_OUTPUT_PATTERNS);
    }
    if (body.timeoutMinutes !== undefined) {
      const value = parseInt(body.timeoutMinutes, 10);
      patch.timeoutMinutes = Number.isFinite(value) && value > 0 ? value : null;
    }

    if (body.schedule !== undefined) {
      const settings = store.getSettings();
      const next = scheduleModel.normalise(body.schedule, spider.schedule, settings.timezone);
      if (next.enabled) {
        const check = scheduler.validateSchedule(next, settings.timezone);
        if (!check.valid) return res.status(400).json({ error: `invalid schedule: ${check.error}` });
      }
      patch.schedule = next;
    }

    if (body.sftp !== undefined) {
      const current = spider.sftp || {};
      const incoming = body.sftp;
      patch.sftp = {
        ...current,
        enabled: incoming.enabled !== undefined ? !!incoming.enabled : !!current.enabled,
        host: incoming.host !== undefined ? String(incoming.host).trim() : current.host,
        port: incoming.port !== undefined ? String(incoming.port).trim() : current.port,
        user: incoming.user !== undefined ? String(incoming.user).trim() : current.user,
        remoteDir:
          incoming.remoteDir !== undefined ? String(incoming.remoteDir).trim() : current.remoteDir,
        uploadPatterns: asPatternList(
          incoming.uploadPatterns,
          current.uploadPatterns || DEFAULT_UPLOAD_PATTERNS
        ),
      };
      // An unchanged masked value must not overwrite the stored password.
      if (incoming.pass !== undefined && incoming.pass !== '********') {
        patch.sftp.pass = String(incoming.pass);
      }
    }

    const updated = store.updateSpider(spider.id, patch);
    scheduler.scheduleSpider(updated);
    res.json(presentSpider(updated));
  });

  router.delete('/spiders/:id', (req, res) => {
    const spider = store.getSpider(req.params.id);
    if (!spider) return res.status(404).json({ error: 'spider not found' });
    if (runner.isSpiderRunning(spider.id)) {
      return res.status(409).json({ error: 'spider is running; cancel the run first' });
    }
    scheduler.stopJob(spider.id);
    let filesRemoved = false;
    if (req.query.deleteFiles === '1') {
      try {
        filesRemoved = packages.removeSpiderFiles(spider);
      } catch (e) {
        return res.status(500).json({ error: `could not delete files: ${e.message}` });
      }
    }
    store.deleteSpider(spider.id);
    res.json({ ok: true, filesRemoved });
  });

  router.post('/spiders/:id/run', express.json(), (req, res) => {
    const spider = store.getSpider(req.params.id);
    if (!spider) return res.status(404).json({ error: 'spider not found' });
    const run = runner.enqueue(spider, 'manual', {
      allowDuplicate: !!(req.body && req.body.force),
    });
    if (!run) return res.status(409).json({ error: 'this spider is already running or queued' });
    res.status(202).json(run);
  });

  router.post('/spiders/:id/test-sftp', async (req, res) => {
    const spider = store.getSpider(req.params.id);
    if (!spider) return res.status(404).json({ error: 'spider not found' });
    try {
      const result = await sftp.testConnection(spider);
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  /* --------------------------------------------------------------- runs */

  router.get('/runs', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const offset = parseInt(req.query.offset, 10) || 0;
    const filter = { limit, offset };
    if (req.query.spiderId) filter.spiderId = req.query.spiderId;
    if (req.query.status) filter.status = req.query.status;
    res.json({ runs: store.listRuns(filter), total: store.countRuns(filter) });
  });

  router.get('/runs/:id', (req, res) => {
    const run = store.getRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'run not found' });
    res.json(run);
  });

  router.post('/runs/:id/cancel', (req, res) => {
    if (!runner.cancel(req.params.id)) {
      return res.status(409).json({ error: 'run is not active' });
    }
    res.json({ ok: true });
  });

  router.get('/runs/:id/log', (req, res) => {
    const run = store.getRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'run not found' });
    res.type('text/plain').send(runner.getLogTail(run.id));
  });

  // Live log via server-sent events.
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

  router.get('/runs/:id/artifacts/:storedName', (req, res) => {
    const run = store.getRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'run not found' });
    const artifact = (run.artifacts || []).find((a) => a.storedName === req.params.storedName);
    if (!artifact || !fs.existsSync(artifact.path)) {
      return res.status(404).json({ error: 'artifact not found' });
    }
    res.download(artifact.path, artifact.name);
  });

  router.post('/runs/:id/reupload', async (req, res) => {
    const run = store.getRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'run not found' });
    const spider = store.getSpider(run.spiderId);
    if (!spider) return res.status(404).json({ error: 'spider not found' });

    const files = artifacts.selectForUpload(run.artifacts || [], spider);
    if (!files.length) return res.status(400).json({ error: 'no files match the upload patterns' });

    // Retrying keeps the name the original run chose, so a delivery that half
    // succeeded does not leave two differently stamped copies on the server.
    const fallbackNames = artifacts.buildRemoteNames(
      files,
      spider,
      run,
      store.getSettings().timezone
    );
    const withNames = files.map((file) => ({
      ...file,
      remoteName: file.remoteName || fallbackNames.get(file.path),
    }));

    try {
      const uploaded = await sftp.uploadFiles(withNames, spider, (msg) =>
        log.info(`reupload: ${msg}`)
      );
      const remoteByLocal = new Map(uploaded.map((u) => [u.local, u.remote]));
      const updatedArtifacts = (run.artifacts || []).map((a) =>
        remoteByLocal.has(a.path) ? { ...a, uploaded: true, remote: remoteByLocal.get(a.path) } : a
      );
      const patch = { artifacts: updatedArtifacts, uploadError: null };
      // The crawl itself had already succeeded; delivery was the only thing left.
      if (run.status === 'upload_failed') {
        patch.status = 'success';
        patch.error = null;
      }
      store.updateRun(run.id, patch);
      res.json({ ok: true, uploaded, status: patch.status || run.status });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
}

module.exports = { buildRouter, presentSpider };
