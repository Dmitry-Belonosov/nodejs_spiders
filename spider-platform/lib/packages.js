/**
 * Installing spider code: ZIP upload, dependency install, folder linking.
 *
 * An uploaded spider is expected to be a normal project folder like
 * everton-server: package.json with a "start" script that runs the crawl and
 * exits when finished (EXIT_ON_COMPLETE=1 is injected by the runner).
 */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const AdmZip = require('adm-zip');
const { SPIDERS_DIR, DATA_DIR } = require('./paths');
const { createLogger } = require('./logger');

const log = createLogger('packages');

// Config/state worth keeping when a spider is re-uploaded.
const PRESERVED_ENTRIES = ['.env', 'urls.json', 'data'];

function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 60);
}

function assertSafeSlug(slug) {
  if (!slug || !/^[a-z0-9][a-z0-9._-]*$/.test(slug) || slug.includes('..')) {
    throw new Error(`invalid spider slug: "${slug}"`);
  }
}

function spiderDirFor(slug) {
  assertSafeSlug(slug);
  return path.join(SPIDERS_DIR, slug);
}

/**
 * Never copied into a spider folder: dependencies are reinstalled here and the
 * runtime directories (a spider's data/ can hold hundreds of thousands of
 * checkpoint files) are recreated by the spider itself.
 */
const IGNORED_SEGMENTS = new Set([
  'node_modules', '.git', '__MACOSX', '.DS_Store',
  'data', 'logs', 'archive', '.cache', 'chrome_profile', 'dist', 'coverage',
]);

function isIgnoredPath(relativePath) {
  if (/\.log$/i.test(relativePath)) return true;
  return relativePath
    .split('/')
    .some((segment) => IGNORED_SEGMENTS.has(segment));
}

/** Strip a single wrapping folder, as created by "zip -r spider.zip spider/". */
function commonRootPrefix(entries) {
  const tops = new Set();
  for (const entry of entries) {
    const normalized = entry.entryName.replace(/\\/g, '/');
    if (normalized.startsWith('__MACOSX/') || normalized.startsWith('.')) continue;
    const top = normalized.split('/')[0];
    if (top) tops.add(top);
  }
  if (tops.size !== 1) return null;
  const only = Array.from(tops)[0];
  const isFolder = entries.some((e) => {
    const n = e.entryName.replace(/\\/g, '/');
    return n.startsWith(`${only}/`);
  });
  return isFolder ? `${only}/` : null;
}

/**
 * Browser folder uploads prefix every path with the chosen folder name, so the
 * wrapping directory is peeled off in place until real files sit at the root.
 */
function stripCommonRoot(entries) {
  for (;;) {
    const tops = new Set(entries.map((e) => (e.relativePath.includes('/') ? e.relativePath.split('/')[0] : null)));
    if (tops.size !== 1 || tops.has(null)) return entries;
    const prefix = `${tops.values().next().value}/`;
    for (const entry of entries) entry.relativePath = entry.relativePath.slice(prefix.length);
  }
}

/** Resolve a relative path inside targetDir, refusing traversal and absolute paths. */
function safeJoin(targetDir, relativePath) {
  const dest = path.resolve(targetDir, relativePath);
  if (dest !== targetDir && !dest.startsWith(targetDir + path.sep)) {
    throw new Error(`unsafe path in upload: ${relativePath}`);
  }
  return dest;
}

function extractZip(zipPath, targetDir) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  if (!entries.length) throw new Error('archive is empty');

  const prefix = commonRootPrefix(entries);
  let written = 0;

  for (const entry of entries) {
    let name = entry.entryName.replace(/\\/g, '/');
    if (name.startsWith('__MACOSX/') || name.endsWith('.DS_Store')) continue;
    if (prefix) {
      if (!name.startsWith(prefix)) continue;
      name = name.slice(prefix.length);
    }
    if (!name || isIgnoredPath(name)) continue;

    // Reject path traversal / absolute paths inside the archive.
    const dest = path.resolve(targetDir, name);
    if (dest !== targetDir && !dest.startsWith(targetDir + path.sep)) {
      throw new Error(`archive contains an unsafe path: ${entry.entryName}`);
    }

    if (entry.isDirectory) {
      fs.mkdirSync(dest, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, entry.getData());
      written += 1;
    }
  }

  if (!written) throw new Error('archive contained no files');
  return written;
}

function readPackageJson(dir) {
  const file = path.join(dir, 'package.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`package.json is not valid JSON: ${e.message}`);
  }
}

/** Guess how to start the spider and warn about anything suspicious. */
function inspectSpiderDir(dir) {
  const pkg = readPackageJson(dir);
  const warnings = [];
  let command = null;

  if (pkg && pkg.scripts && pkg.scripts.start) {
    command = 'npm start';
  } else if (fs.existsSync(path.join(dir, 'run.js'))) {
    command = 'node run.js';
    warnings.push('no "start" script found; using "node run.js"');
  } else if (fs.existsSync(path.join(dir, 'index.js'))) {
    command = 'node index.js';
    warnings.push('no "start" script found; using "node index.js"');
  } else {
    warnings.push('could not detect a start command — set it manually');
  }

  if (!pkg) warnings.push('no package.json found; dependencies will not be installed');
  if (pkg && pkg.dependencies && pkg.dependencies.puppeteer) {
    warnings.push('depends on full "puppeteer" (downloads Chromium); the spiders here use puppeteer-core');
  }
  if (fs.existsSync(path.join(dir, 'urls.sample.json')) && !fs.existsSync(path.join(dir, 'urls.json'))) {
    warnings.push('urls.json missing — the spider is expected to seed it from urls.sample.json');
  }

  return { pkg, command, warnings, hasDependencies: !!(pkg && pkg.dependencies) };
}

function installDependencies(dir, { timeoutMs = 15 * 60 * 1000 } = {}) {
  return new Promise((resolve) => {
    const pkg = readPackageJson(dir);
    if (!pkg || !pkg.dependencies || !Object.keys(pkg.dependencies).length) {
      return resolve({ ran: false, output: 'no dependencies declared' });
    }
    // Guarantees npm treats this folder as the project root instead of
    // walking up into the platform's own package.json.
    fs.mkdirSync(path.join(dir, 'node_modules'), { recursive: true });

    log.info(`npm install in ${dir}`);
    execFile(
      'npm',
      ['install', '--omit=dev', '--no-audit', '--no-fund'],
      { cwd: dir, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, env: process.env },
      (err, stdout, stderr) => {
        const output = `${stdout || ''}${stderr || ''}`.trim();
        if (err) {
          log.error(`npm install failed in ${dir}: ${err.message}`);
          return resolve({ ran: true, ok: false, output: output || err.message });
        }
        resolve({ ran: true, ok: true, output });
      }
    );
  });
}

function backupExisting(dir, slug) {
  if (!fs.existsSync(dir)) return null;
  const backupRoot = path.join(DATA_DIR, 'backups');
  fs.mkdirSync(backupRoot, { recursive: true });
  const backupDir = path.join(backupRoot, `${slug}-${Date.now()}`);
  fs.renameSync(dir, backupDir);
  return backupDir;
}

function restorePreserved(backupDir, targetDir) {
  if (!backupDir) return [];
  const restored = [];
  for (const entry of PRESERVED_ENTRIES) {
    const from = path.join(backupDir, entry);
    const to = path.join(targetDir, entry);
    if (fs.existsSync(from) && !fs.existsSync(to)) {
      fs.cpSync(from, to, { recursive: true });
      restored.push(entry);
    }
  }
  return restored;
}

/**
 * Install (or replace) a spider from a ZIP file.
 * Returns { dir, slug, inspection, restored, install }.
 */
async function installFromZip(zipPath, { slug, installDeps = true }) {
  assertSafeSlug(slug);
  const targetDir = spiderDirFor(slug);
  const backupDir = backupExisting(targetDir, slug);

  fs.mkdirSync(targetDir, { recursive: true });
  try {
    extractZip(zipPath, targetDir);
  } catch (e) {
    fs.rmSync(targetDir, { recursive: true, force: true });
    if (backupDir) fs.renameSync(backupDir, targetDir);
    throw e;
  }

  const restored = restorePreserved(backupDir, targetDir);
  const inspection = inspectSpiderDir(targetDir);
  const install = installDeps
    ? await installDependencies(targetDir)
    : { ran: false, output: 'skipped' };

  log.info(`installed spider "${slug}" into ${targetDir}`);
  return { dir: targetDir, slug, inspection, restored, install, backupDir };
}

/**
 * Install (or replace) a spider from individual files, as sent by a browser
 * folder upload. `files` is [{ relativePath, tmpPath }] with paths relative to
 * the chosen folder.
 * Returns { dir, slug, inspection, restored, install, skipped }.
 */
async function installFromFiles(files, { slug, installDeps = true }) {
  assertSafeSlug(slug);

  const named = files
    .map((file) => ({
      tmpPath: file.tmpPath,
      relativePath: String(file.relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '').trim(),
    }))
    .filter((file) => file.relativePath && !file.relativePath.includes('..'));

  // The chosen folder may itself be called "data"; peel it off before filtering.
  stripCommonRoot(named);
  const wanted = named.filter((file) => !isIgnoredPath(file.relativePath));
  const skipped = files.length - wanted.length;
  if (!wanted.length) throw new Error('the folder contained no usable files');

  const targetDir = spiderDirFor(slug);
  const backupDir = backupExisting(targetDir, slug);

  fs.mkdirSync(targetDir, { recursive: true });
  try {
    for (const file of wanted) {
      const dest = safeJoin(targetDir, file.relativePath);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(file.tmpPath, dest);
    }
  } catch (e) {
    fs.rmSync(targetDir, { recursive: true, force: true });
    if (backupDir) fs.renameSync(backupDir, targetDir);
    throw e;
  }

  const restored = restorePreserved(backupDir, targetDir);
  const inspection = inspectSpiderDir(targetDir);
  const install = installDeps
    ? await installDependencies(targetDir)
    : { ran: false, output: 'skipped' };

  log.info(`installed spider "${slug}" from ${wanted.length} uploaded files into ${targetDir}`);
  return { dir: targetDir, slug, inspection, restored, install, backupDir, skipped };
}

function removeSpiderFiles(spider) {
  if (spider.source === 'link') return false; // never delete code we do not own
  const dir = spider.dir;
  if (!dir || !dir.startsWith(SPIDERS_DIR)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

module.exports = {
  slugify,
  assertSafeSlug,
  spiderDirFor,
  installFromZip,
  installFromFiles,
  installDependencies,
  inspectSpiderDir,
  removeSpiderFiles,
  readPackageJson,
};
