/**
 * Find the files a spider produced and copy them into the platform archive.
 *
 * Spiders write their exports into their own directory (everton.csv,
 * everton.jsonl, archive/...). We snapshot them per run so a later run cannot
 * overwrite the evidence of an earlier one.
 */
const fs = require('fs');
const path = require('path');
const { artifactDir } = require('./paths');

const SKIP_DIRS = new Set(['node_modules', '.git', 'data', 'logs', 'extension', '.cache']);
const MAX_DEPTH = 3;
// Chrome/export writes can lag slightly behind the recorded start time.
const MTIME_SKEW_MS = 5 * 60 * 1000;

function patternToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*')
    .replace(/\?/g, '[^/]');
  return new RegExp(`^${escaped}$`, 'i');
}

function matchesAny(relPath, patterns) {
  return patterns.some((p) => patternToRegex(p).test(relPath));
}

function walk(dir, baseDir, depth, out) {
  if (depth > MAX_DEPTH) return out;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, baseDir, depth + 1, out);
    } else if (entry.isFile()) {
      out.push({ full, rel: path.relative(baseDir, full).split(path.sep).join('/') });
    }
  }
  return out;
}

/**
 * @param {object} spider  spider record (dir, outputPatterns)
 * @param {object} run     run record (id, startedAt)
 * @returns {Array} artifact descriptors, already copied into the archive
 */
function collectArtifacts(spider, run) {
  const patterns =
    spider.outputPatterns && spider.outputPatterns.length
      ? spider.outputPatterns
      : ['*.csv', '*.jsonl'];
  const since = run.startedAt ? new Date(run.startedAt).getTime() - MTIME_SKEW_MS : 0;

  const candidates = walk(spider.dir, spider.dir, 0, []).filter((f) => matchesAny(f.rel, patterns));

  const fresh = candidates.filter((f) => {
    try {
      return fs.statSync(f.full).mtimeMs >= since;
    } catch (e) {
      return false;
    }
  });

  const destDir = artifactDir(spider.slug, run.id);
  fs.mkdirSync(destDir, { recursive: true });

  const artifacts = [];
  for (const file of fresh) {
    const stat = fs.statSync(file.full);
    // Flatten nested paths so archive/x.csv and x.csv cannot collide.
    const flatName = file.rel.replace(/\//g, '__');
    const dest = path.join(destDir, flatName);
    fs.copyFileSync(file.full, dest);
    artifacts.push({
      name: path.basename(file.rel),
      storedName: flatName,
      relPath: file.rel,
      path: dest,
      size: stat.size,
      modifiedAt: new Date(stat.mtimeMs).toISOString(),
      uploaded: false,
    });
  }

  artifacts.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return artifacts;
}

function selectForUpload(artifacts, spider) {
  const patterns =
    spider.sftp && spider.sftp.uploadPatterns && spider.sftp.uploadPatterns.length
      ? spider.sftp.uploadPatterns
      : ['*.csv'];
  return artifacts.filter((a) => matchesAny(a.name, patterns) || matchesAny(a.relPath, patterns));
}

/** `YYYY-MM-DD_HH-mm-ss` for a moment, read in the platform timezone. */
function timestampIn(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone || 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => (parts.find((p) => p.type === type) || {}).value || '00';
  return (
    `${get('year')}-${get('month')}-${get('day')}` +
    `_${get('hour')}-${get('minute')}-${get('second')}`
  );
}

/**
 * Remote filenames for the files a run delivers.
 *
 * Every spider exports under a fixed name (`everton.csv` on every run), so
 * uploading under the basename would make each delivery overwrite the previous
 * one on the SFTP server. Stamping the run's start time keeps deliveries
 * distinct and sorts them chronologically in the remote directory.
 *
 * @returns {Map<string,string>} artifact path -> remote filename
 */
function buildRemoteNames(artifacts, spider, run, timezone) {
  const stamp = timestampIn(run.startedAt ? new Date(run.startedAt) : new Date(), timezone);
  const safeSlug = String(spider.slug || 'spider').replace(/[^A-Za-z0-9._-]+/g, '-');

  const perExtension = new Map();
  for (const artifact of artifacts) {
    const ext = path.extname(artifact.name).toLowerCase();
    perExtension.set(ext, (perExtension.get(ext) || 0) + 1);
  }

  const names = new Map();
  for (const artifact of artifacts) {
    const ext = path.extname(artifact.name);
    const stem = path.basename(artifact.name, ext).replace(/[^A-Za-z0-9._-]+/g, '-');
    // The spider name alone is enough unless the run delivers several files of
    // the same type, in which case the original name keeps them apart.
    const base =
      perExtension.get(ext.toLowerCase()) > 1 && stem.toLowerCase() !== safeSlug.toLowerCase()
        ? `${safeSlug}-${stem}`
        : safeSlug;
    names.set(artifact.path, `${base}_${stamp}${ext}`);
  }
  return names;
}

module.exports = { collectArtifacts, selectForUpload, matchesAny, buildRemoteNames, timestampIn };
