/**
 * Copy this file into a spider folder to use Scraper Shell 2 services.
 * Without SHELL_URL (spider started by hand) everything is a no-op.
 *
 *   const shell = require('./shell_client');
 *   if (shell.enabled) setRecaptchaTilePicker(shell.recaptchaPicker);
 *   shell.report('note', { line: 'something worth seeing' });
 */
const fs = require('fs');

const SHELL_URL = (process.env.SHELL_URL || '').replace(/\/$/, '');
const SPIDER = process.env.SHELL_SPIDER || 'unknown';

async function post(path, body, timeoutMs) {
  const res = await fetch(`${SHELL_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`shell HTTP ${res.status}`);
  return res.json();
}

/** recaptcha.js tile picker: ({ prompt, round, tab, tilePaths }) → number[] ([] = fall back to solution.json) */
async function recaptchaPicker(meta) {
  try {
    const tiles = (meta.tilePaths || []).map((p) => fs.readFileSync(p).toString('base64'));
    const out = await post('/api/captcha/recaptcha', { spider: SPIDER, prompt: meta.prompt, round: meta.round, tab: meta.tab, recheck: !!(meta.recheck || meta.emptyOk), positions: meta.positions, tiles }, 10 * 60 * 1000);
    return Array.isArray(out.indices) ? out.indices : [];
  } catch (e) {
    console.error(`shell captcha failed: ${e.message}`);
    return [];
  }
}

function report(type, data = {}) {
  if (!SHELL_URL) return;
  post('/api/events', { type, spider: SPIDER, ...data }, 5000).catch(() => {});
}

module.exports = { enabled: !!SHELL_URL, recaptchaPicker, report };
