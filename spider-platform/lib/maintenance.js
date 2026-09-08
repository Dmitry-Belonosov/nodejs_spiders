/**
 * Disk retention.
 *
 * Run logs and archived exports accumulate forever otherwise, which is how a
 * scraping box eventually runs out of disk. Records and their files are
 * dropped together so the UI never links to a file that is gone.
 */
const fs = require('fs');
const path = require('path');
const store = require('./store');
const paths = require('./paths');
const { createLogger } = require('./logger');

const log = createLogger('maintenance');

function daysToMs(days) {
  return days * 24 * 60 * 60 * 1000;
}

function removeDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  } catch (e) {
    log.error(`could not remove ${dir}: ${e.message}`);
    return false;
  }
}

function pruneOldRuns({ retentionDays, keepPerSpider }) {
  if (!retentionDays || retentionDays <= 0) return { removed: 0 };

  const cutoff = Date.now() - daysToMs(retentionDays);
  const allRuns = store.listRuns({});
  const keptCount = new Map();
  let removed = 0;

  for (const run of allRuns) {
    const seen = keptCount.get(run.spiderId) || 0;
    // Always keep the most recent runs of each spider, however old they are.
    if (seen < keepPerSpider) {
      keptCount.set(run.spiderId, seen + 1);
      continue;
    }
    const timestamp = Date.parse(run.finishedAt || run.startedAt || run.createdAt);
    if (!Number.isFinite(timestamp) || timestamp >= cutoff) {
      keptCount.set(run.spiderId, seen + 1);
      continue;
    }
    if (run.status === 'running' || run.status === 'queued') continue;

    removeDir(paths.runDir(run.id));
    if (run.spiderSlug) removeDir(paths.artifactDir(run.spiderSlug, run.id));
    store.updateRun(run.id, { pruned: true });
    removed += 1;
  }

  if (removed) {
    store.dropRuns((run) => run.pruned === true);
    log.info(`pruned ${removed} run(s) older than ${retentionDays} days`);
  }
  return { removed };
}

/** Remove backup copies left behind by spider re-uploads. */
function pruneOldBackups({ retentionDays }) {
  const backupRoot = path.join(paths.DATA_DIR, 'backups');
  if (!fs.existsSync(backupRoot)) return { removed: 0 };
  const cutoff = Date.now() - daysToMs(retentionDays);
  let removed = 0;
  for (const entry of fs.readdirSync(backupRoot)) {
    const dir = path.join(backupRoot, entry);
    try {
      if (fs.statSync(dir).mtimeMs < cutoff && removeDir(dir)) removed += 1;
    } catch (e) {
      /* disappeared underneath us */
    }
  }
  if (removed) log.info(`removed ${removed} old spider backup(s)`);
  return { removed };
}

function runSweep() {
  const retentionDays = parseInt(process.env.RETENTION_DAYS || '60', 10);
  const keepPerSpider = parseInt(process.env.KEEP_RUNS_PER_SPIDER || '20', 10);
  try {
    pruneOldRuns({ retentionDays, keepPerSpider });
    pruneOldBackups({ retentionDays });
  } catch (e) {
    log.error(`sweep failed: ${e.stack || e.message}`);
  }
}

function start() {
  runSweep();
  const timer = setInterval(runSweep, 12 * 60 * 60 * 1000);
  timer.unref();
  return timer;
}

module.exports = { start, runSweep, pruneOldRuns, pruneOldBackups };
