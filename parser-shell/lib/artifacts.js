/**
 * Pick up CSV files a parser wrote into its own folder after npm start exits.
 */
const fs = require('fs');
const path = require('path');
const { artifactDir } = require('./paths');

const SKIP_DIRS = new Set(['node_modules', '.git', 'extension', '.cache']);
const MAX_DEPTH = 3;
const MTIME_SKEW_MS = 5 * 60 * 1000;

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
    } else if (entry.isFile() && /\.csv$/i.test(entry.name)) {
      out.push({
        full,
        rel: path.relative(baseDir, full).split(path.sep).join('/'),
      });
    }
  }
  return out;
}

function collectCsv(parser, run) {
  const since = run.startedAt ? new Date(run.startedAt).getTime() - MTIME_SKEW_MS : 0;
  const candidates = walk(parser.dir, parser.dir, 0, []).filter((f) => {
    try {
      return fs.statSync(f.full).mtimeMs >= since;
    } catch (e) {
      return false;
    }
  });

  const destDir = artifactDir(parser.slug, run.id);
  fs.mkdirSync(destDir, { recursive: true });

  return candidates.map((file) => {
    const stat = fs.statSync(file.full);
    const dest = path.join(destDir, path.basename(file.rel));
    fs.copyFileSync(file.full, dest);
    return {
      name: path.basename(file.rel),
      relPath: file.rel,
      path: dest,
      sourcePath: file.full,
      size: stat.size,
      uploaded: false,
    };
  });
}

module.exports = { collectCsv };
