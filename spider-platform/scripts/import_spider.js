#!/usr/bin/env node
/**
 * Register a spider folder from the command line (same as "Link folder" in
 * the UI). Useful for the first setup, before the UI is reachable.
 *
 *   node scripts/import_spider.js ../everton-server --name Everton \
 *     --time 03:00 --repeat daily --remote-dir /external_data/Dmitry
 *
 *   node scripts/import_spider.js ../autodoc --name Autodoc \
 *     --time 02:30 --repeat weekly --days mon-fri
 */
const fs = require('fs');
const path = require('path');

require('../lib/env').loadEnv();
require('../lib/paths').ensureDirs();

const store = require('../lib/store');
const packages = require('../lib/packages');
const scheduleModel = require('../lib/schedule');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

const DAY_NUMBERS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/** "mon-fri", "mon,wed,fri" or "1,2,3" -> [1,2,3,4,5] */
function parseDays(value) {
  const text = String(value).toLowerCase().trim();
  const toNumber = (token) => {
    const name = token.trim().slice(0, 3);
    if (name in DAY_NUMBERS) return DAY_NUMBERS[name];
    const numeric = parseInt(token, 10);
    return Number.isInteger(numeric) && numeric >= 0 && numeric <= 6 ? numeric : null;
  };

  const range = /^([a-z]+)-([a-z]+)$/.exec(text);
  if (range) {
    const from = toNumber(range[1]);
    const to = toNumber(range[2]);
    if (from === null || to === null) return [];
    // Weeks are written Monday-first, so a range may wrap past Sunday.
    const order = [1, 2, 3, 4, 5, 6, 0];
    const start = order.indexOf(from);
    const end = order.indexOf(to);
    const picked = [];
    for (let i = start; ; i = (i + 1) % order.length) {
      picked.push(order[i]);
      if (i === end) break;
    }
    return picked.sort((a, b) => a - b);
  }

  const days = [];
  for (const token of text.split(',')) {
    const day = toNumber(token);
    if (day !== null && !days.includes(day)) days.push(day);
  }
  return days.sort((a, b) => a - b);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = args._[0];
  if (!target) {
    console.error('usage: node scripts/import_spider.js <dir> [--name X] [--slug x] [--time 03:00] [--repeat daily|weekly|monthly|once] [--days mon-fri|mon,thu] [--date YYYY-MM-DD] [--remote-dir /external_data/Dmitry] [--command "npm start"]');
    process.exit(1);
  }

  const dir = path.resolve(target);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    console.error(`not a directory: ${dir}`);
    process.exit(1);
  }

  const name = args.name || path.basename(dir);
  const slug = packages.slugify(args.slug || name);
  packages.assertSafeSlug(slug);

  if (store.getSpiderBySlug(slug)) {
    console.error(`a spider with slug "${slug}" already exists`);
    process.exit(1);
  }

  const inspection = packages.inspectSpiderDir(dir);
  const settings = store.getSettings();
  const remoteDir = args['remote-dir'] || process.env.SFTP_REMOTE_PATH || process.env.SFTP_REMOTE_DIR || '';

  const schedule = scheduleModel.defaultSchedule(settings.timezone);
  if (args.time) schedule.time = String(args.time);
  if (args.repeat) schedule.repeat = String(args.repeat);
  if (args.date) schedule.date = String(args.date);
  if (args.days) {
    const days = parseDays(args.days);
    if (!days.length) {
      console.error(`could not read --days "${args.days}" (try mon-fri, or mon,wed,fri)`);
      process.exit(1);
    }
    schedule.days = days;
    schedule.repeat = 'weekly';
  }
  schedule.enabled = !!args.time;

  const built = scheduleModel.toCron(schedule);
  if (schedule.enabled && !built.valid) {
    console.error(`invalid schedule: ${built.error}`);
    process.exit(1);
  }

  const spider = store.createSpider({
    slug,
    name,
    dir,
    source: 'link',
    command: args.command || inspection.command || 'npm start',
    enabled: true,
    schedule,
    env: {},
    timeoutMinutes: null,
    outputPatterns: ['*.csv', '*.jsonl'],
    sftp: { enabled: !!remoteDir, remoteDir, uploadPatterns: ['*.csv'] },
  });

  console.log(`registered "${spider.name}" (${spider.slug})`);
  console.log(`  dir:      ${spider.dir}`);
  console.log(`  command:  ${spider.command}`);
  console.log(`  schedule: ${scheduleModel.describe(spider.schedule)} (${spider.schedule.timezone})`);
  console.log(`  sftp:     ${spider.sftp.enabled ? spider.sftp.remoteDir : 'disabled'}`);
  for (const warning of inspection.warnings) console.log(`  warning:  ${warning}`);
  console.log('\nRestart the platform (or it will pick this up on next start) to activate the schedule.');
}

main();
