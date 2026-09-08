/**
 * Export products to jsonl + csv with timestamped archive copies.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { ROOT } = require('./env');

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    p(d.getMonth() + 1) +
    p(d.getDate()) +
    '-' +
    p(d.getHours()) +
    p(d.getMinutes()) +
    p(d.getSeconds())
  );
}

function exportAll(opts = {}) {
  const root = opts.root || ROOT;
  const archiveDir = path.join(root, 'archive');
  fs.mkdirSync(archiveDir, { recursive: true });

  const jsonlOut = path.join(root, 'everton.jsonl');
  const csvOut = path.join(root, 'everton.csv');
  const ts = stamp();

  execSync('node export_jsonl.js', {
    cwd: root,
    stdio: 'pipe',
    env: { ...process.env, OUT: jsonlOut },
  });
  execSync('node export_csv.js', {
    cwd: root,
    stdio: 'pipe',
    env: { ...process.env, OUT: csvOut },
  });

  const archivedJsonl = path.join(archiveDir, `everton-${ts}.jsonl`);
  const archivedCsv = path.join(archiveDir, `everton-${ts}.csv`);
  fs.copyFileSync(jsonlOut, archivedJsonl);
  fs.copyFileSync(csvOut, archivedCsv);

  let rows = 0;
  if (fs.existsSync(jsonlOut)) {
    rows = fs.readFileSync(jsonlOut, 'utf8').split('\n').filter(Boolean).length;
  }

  return {
    jsonl: jsonlOut,
    csv: csvOut,
    archivedJsonl,
    archivedCsv,
    rows,
    timestamp: ts,
  };
}

module.exports = { exportAll, stamp };
