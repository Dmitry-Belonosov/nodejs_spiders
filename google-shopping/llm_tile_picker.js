/**
 * reCAPTCHA tile picker backed by a local Ollama vision model.
 * Asks one yes/no question per tile; returns the 0-based "yes" indices.
 *
 * Returns [] (→ recaptcha.js falls back to solution.json / a human) when:
 *   - the round is past LLM_CAPTCHA_ROUNDS (model already had its tries),
 *   - Ollama is unreachable or errors,
 *   - no tile prompt / no tiles, or the model said "no" to every tile.
 *
 * Every round is archived under <dump>/history/ with the model's answers,
 * so real Google grids can be labelled later and used as a benchmark.
 *
 *   LLM_CAPTCHA=1                    enable (wired in puppeteer_worker.js)
 *   LLM_CAPTCHA_MODEL=qwen3-vl:8b-instruct
 *   OLLAMA_URL=http://127.0.0.1:11434
 *   LLM_CAPTCHA_ROUNDS=2             rounds the model solves before a human
 *   LLM_CAPTCHA_ARCHIVE=1
 */
const fs = require('fs');
const path = require('path');

const MODEL = process.env.LLM_CAPTCHA_MODEL || 'qwen3-vl:8b-instruct';
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const MAX_LLM_ROUNDS = parseInt(process.env.LLM_CAPTCHA_ROUNDS || '2', 10);
const ARCHIVE = !['0', 'false', 'no', 'off'].includes(String(process.env.LLM_CAPTCHA_ARCHIVE || '1').toLowerCase());
const ASK_TIMEOUT_MS = 60000;

const QUESTION =
  'This is one tile cut from a reCAPTCHA image grid. ' +
  'Does this tile contain any part of {target}? Answer with exactly one word: yes or no.';

const SINGULAR = {
  buses: 'a bus',
  bicycles: 'a bicycle',
  motorcycles: 'a motorcycle',
  cars: 'a car',
  'fire hydrants': 'a fire hydrant',
  'fire hydrant': 'a fire hydrant',
  crosswalks: 'a crosswalk',
  'traffic lights': 'a traffic light',
  stairs: 'stairs',
  chimneys: 'a chimney',
  bridges: 'a bridge',
  'palm trees': 'a palm tree',
  tractors: 'a tractor',
  boats: 'a boat',
  taxis: 'a taxi',
  'parking meters': 'a parking meter',
  'mountains or hills': 'mountains or hills',
};

/** "Select all squares with\nmotorcycles\nIf there are none, click skip" → "a motorcycle" */
function targetFromPrompt(prompt) {
  const text = String(prompt || '').replace(/\s+/g, ' ').trim();
  const m = text.match(/(?:images|squares|pictures)\s+with\s+(?:a |an )?(.+?)(?:\s+(?:Click|If there|once)\b|[.]|$)/i);
  if (!m) return null;
  const noun = m[1].trim().toLowerCase();
  return SINGULAR[noun] || noun;
}

async function askTile(file, target) {
  const body = {
    model: MODEL,
    stream: false,
    think: false,
    options: { temperature: 0, num_predict: 4 },
    messages: [
      {
        role: 'user',
        content: QUESTION.replace('{target}', target),
        images: [fs.readFileSync(file).toString('base64')],
      },
    ],
  };
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(ASK_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`ollama HTTP ${res.status}`);
  const json = await res.json();
  const answer = String((json.message && json.message.content) || '').trim().toLowerCase();
  return { yes: answer.startsWith('yes'), answer };
}

function archiveRound(meta, target, answers, picked) {
  if (!ARCHIVE || !meta.tilePaths || !meta.tilePaths.length) return;
  try {
    const dir = path.join(
      path.dirname(path.dirname(meta.tilePaths[0])),
      'history',
      `${new Date().toISOString().replace(/[:.]/g, '-')}-t${meta.tab}-r${meta.round}`
    );
    fs.mkdirSync(dir, { recursive: true });
    for (const p of [meta.gridPath, meta.visiblePath, ...meta.tilePaths]) {
      if (p && fs.existsSync(p)) fs.copyFileSync(p, path.join(dir, path.basename(p)));
    }
    fs.writeFileSync(
      path.join(dir, 'llm.json'),
      JSON.stringify({ model: MODEL, prompt: meta.prompt, target, answers, picked }, null, 2)
    );
  } catch (e) {}
}

/** ask(file, target) is injectable for tests. */
function createLlmTilePicker({ log = console.log, ask = askTile } = {}) {
  return async function llmTilePicker(meta) {
    if (meta.round > MAX_LLM_ROUNDS && !meta.recheck) {
      log(`llm-captcha: round ${meta.round} > ${MAX_LLM_ROUNDS} — handing to human`);
      return [];
    }
    const target = targetFromPrompt(meta.prompt);
    if (!target || !meta.tilePaths || !meta.tilePaths.length) {
      log(`llm-captcha: cannot read target/tiles (prompt="${meta.prompt}") — handing to human`);
      return [];
    }
    const started = Date.now();
    const answers = [];
    try {
      for (const file of meta.tilePaths) answers.push((await ask(file, target)).yes);
    } catch (e) {
      log(`llm-captcha: ${MODEL} failed (${e.message}) — handing to human`);
      return [];
    }
    const picked = answers.flatMap((yes, i) => (yes ? [i] : []));
    archiveRound(meta, target, answers, picked);
    log(
      `llm-captcha: "${target}" ${meta.tilePaths.length} tiles → [${picked.join(',')}] ` +
        `in ${((Date.now() - started) / 1000).toFixed(1)}s`
    );
    if (!picked.length && !meta.recheck) log('llm-captcha: model found nothing — handing to human');
    return picked;
  };
}

module.exports = { createLlmTilePicker, targetFromPrompt };
