#!/usr/bin/env node
/**
 * Clear run history and remove spiders by slug — used to hand over a clean
 * installation after testing.
 *
 *   node scripts/reset_runs.js --remove demo-spider,uploaded-demo --all-runs
 *
 * Stop the platform before running this.
 */
const fs = require('fs');
const path = require('path');

require('../lib/env').loadEnv();
const paths = require('../lib/paths');
paths.ensureDirs();

const store = require('../lib/store');
const packages = require('../lib/packages');

function arg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  const value = process.argv[idx + 1];
  return value && !value.startsWith('--') ? value : true;
}

function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

const toRemove = String(arg('remove') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

for (const slug of toRemove) {
  const spider = store.getSpiderBySlug(slug);
  if (!spider) {
    console.log(`- ${slug}: not registered`);
    continue;
  }
  for (const run of store.listRuns({ spiderId: spider.id })) {
    removeDir(paths.runDir(run.id));
  }
  store.dropRuns((run) => run.spiderId === spider.id);
  removeDir(path.join(paths.ARTIFACTS_DIR, spider.slug));
  if (spider.source !== 'link') {
    try {
      packages.removeSpiderFiles(spider);
    } catch (e) {
      console.log(`  could not remove files: ${e.message}`);
    }
  }
  store.deleteSpider(spider.id);
  console.log(`- removed ${slug}`);
}

if (arg('all-runs')) {
  const runs = store.listRuns({});
  for (const run of runs) removeDir(paths.runDir(run.id));
  removeDir(paths.ARTIFACTS_DIR);
  fs.mkdirSync(paths.ARTIFACTS_DIR, { recursive: true });
  const dropped = store.dropRuns(() => true);
  console.log(`- cleared ${dropped} run record(s) and their files`);
}

const rename = arg('rename');
if (rename) {
  const [slug, ...nameParts] = rename.split('=');
  const spider = store.getSpiderBySlug(slug.trim());
  if (spider) {
    store.updateSpider(spider.id, { name: nameParts.join('=').trim() });
    console.log(`- renamed ${slug} to "${nameParts.join('=').trim()}"`);
  }
}

console.log('\nremaining spiders:');
for (const s of store.listSpiders()) {
  console.log(`  ${s.slug.padEnd(16)} ${s.name}`);
}
console.log(`remaining runs: ${store.listRuns({}).length}`);
