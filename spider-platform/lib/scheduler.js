/**
 * Cron scheduling for spiders (timezone-aware, via croner).
 *
 * Jobs are rebuilt from the store whenever a spider changes, so the store is
 * always the source of truth and the scheduler holds no separate state.
 */
const { Cron } = require('croner');
const store = require('./store');
const runner = require('./runner');
const scheduleModel = require('./schedule');
const { createLogger } = require('./logger');

const log = createLogger('scheduler');

/** spiderId -> Cron */
const jobs = new Map();

function defaultTimezone() {
  return store.getSettings().timezone || 'Europe/London';
}

function validateCron(expression, timezone) {
  try {
    const probe = new Cron(expression, { timezone: timezone || defaultTimezone(), paused: true });
    const next = probe.nextRun();
    probe.stop();
    if (!next) return { valid: false, error: 'expression never fires' };
    return { valid: true, nextRun: next.toISOString() };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

/** Check a date/time schedule and report when it would next fire. */
function validateSchedule(schedule, timezone) {
  const built = scheduleModel.toCron(schedule);
  if (!built.valid) return built;
  const check = validateCron(built.cron, schedule.timezone || timezone);
  if (!check.valid) return check;
  return { valid: true, nextRun: check.nextRun, description: built.description };
}

function stopJob(spiderId) {
  const job = jobs.get(spiderId);
  if (job) {
    job.stop();
    jobs.delete(spiderId);
  }
}

function scheduleSpider(spider) {
  stopJob(spider.id);

  const schedule = spider.schedule || {};
  if (!spider.enabled || !schedule.enabled) return null;

  const timezone = defaultTimezone();
  const built = scheduleModel.toCron(schedule);
  if (!built.valid) {
    log.error(`${spider.slug}: invalid schedule (${built.error})`);
    return null;
  }
  const check = validateCron(built.cron, timezone);
  if (!check.valid) {
    log.error(`${spider.slug}: invalid schedule "${built.cron}" (${check.error})`);
    return null;
  }

  const options = { timezone, name: spider.slug };
  if (built.maxRuns) options.maxRuns = built.maxRuns;

  const job = new Cron(built.cron, options, () => {
    const fresh = store.getSpider(spider.id);
    if (!fresh || !fresh.enabled) return;
    const run = runner.enqueue(fresh, 'schedule');
    if (run) {
      log.info(`${fresh.slug}: scheduled run ${run.id} queued`);
    } else {
      log.warn(`${fresh.slug}: skipped scheduled run (previous run still active)`);
    }
  });

  jobs.set(spider.id, job);
  log.info(`${spider.slug}: ${built.description} (${timezone}), next ${check.nextRun}`);
  return job;
}

function syncAll() {
  const spiders = store.listSpiders();
  const seen = new Set();
  for (const spider of spiders) {
    seen.add(spider.id);
    scheduleSpider(spider);
  }
  for (const spiderId of Array.from(jobs.keys())) {
    if (!seen.has(spiderId)) stopJob(spiderId);
  }
}

function nextRunFor(spiderId) {
  const job = jobs.get(spiderId);
  if (!job) return null;
  const next = job.nextRun();
  return next ? next.toISOString() : null;
}

function stopAll() {
  for (const spiderId of Array.from(jobs.keys())) stopJob(spiderId);
}

module.exports = {
  syncAll,
  scheduleSpider,
  stopJob,
  stopAll,
  nextRunFor,
  validateCron,
  validateSchedule,
  defaultTimezone,
};
