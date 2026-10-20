/**
 * Google /sorry/ recaptcha. Several tabs queue: one image grid at a time,
 * then the next tab starts after Verify.
 *
 * Image rounds dump a grid + tiles under CAPTCHA_DUMP_DIR and wait for
 * solution.json: { "indices": [6, 10, 11] } (0-based tile numbers).
 */
const fs = require('fs');
const path = require('path');

const DUMP_DIR = process.env.CAPTCHA_DUMP_DIR || '/tmp/google-shopping-captcha';
const MAX_ROUNDS = parseInt(process.env.CAPTCHA_MAX_ROUNDS || '4', 10);
const SOLUTION_WAIT_MS = parseInt(process.env.CAPTCHA_WAIT_MS || String(3 * 60 * 1000), 10);
const GIVE_UP_MS = parseInt(process.env.CAPTCHA_GIVE_UP_MS || String(8 * 60 * 1000), 10);
const RECHECK_PASSES = parseInt(process.env.CAPTCHA_RECHECK_PASSES || '6', 10);
const RECHECK_FADE_MS = parseInt(process.env.CAPTCHA_RECHECK_FADE_MS || '4500', 10);

let solving = false;
let solveChain = Promise.resolve();
let tilePicker = null;

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isCaptchaSolving() {
  return solving;
}

function withCaptchaLock(fn) {
  const queued = solving;
  if (queued) {
    console.log('recaptcha: queued — another tab is on the image grid; this tab waits');
  }
  const run = solveChain.then(async () => {
    solving = true;
    try {
      return await fn();
    } finally {
      solving = false;
    }
  });
  solveChain = run.catch(() => {});
  return run;
}

/** Tests / live assist: async ({ prompt, tileCount, gridPath, tilePaths, tab }) => number[] */
function setRecaptchaTilePicker(fn) {
  tilePicker = typeof fn === 'function' ? fn : null;
}

function recaptchaFrames(page) {
  const frames = page.frames();
  const checkbox =
    frames.find((f) => /recaptcha\/(?:api2|enterprise)\/anchor/i.test(f.url())) ||
    frames.find((f) => /recaptcha/i.test(f.url()) && /anchor|checkbox/i.test(f.url()));
  const challenge =
    frames.find((f) => /recaptcha\/(?:api2|enterprise)\/bframe/i.test(f.url())) ||
    frames.find((f) => /recaptcha/i.test(f.url()) && /bframe|challenge/i.test(f.url()));
  return { checkbox, challenge, any: frames.filter((f) => /recaptcha/i.test(f.url())) };
}

async function pageLooksLikeRecaptcha(page) {
  try {
    const href = page.url() || '';
    if (/\/sorry\//i.test(href)) return true;
    const { checkbox, challenge } = recaptchaFrames(page);
    if (checkbox || challenge) return true;
    const html = await page.content().catch(() => '');
    return /unusual traffic from your computer/i.test(html) && /not a robot/i.test(html);
  } catch (e) {
    return false;
  }
}

async function clickRecaptchaCheckbox(page, { log = console.log } = {}) {
  const { checkbox, any } = recaptchaFrames(page);
  const frame = checkbox || any.find((f) => /anchor|checkbox/i.test(f.url())) || any[0];
  if (!frame) return false;
  try {
    const el =
      (await frame.$('#recaptcha-anchor')) ||
      (await frame.$('.recaptcha-checkbox-border')) ||
      (await frame.$('[role="checkbox"]'));
    if (!el) return false;
    const checked = await frame.evaluate(() => {
      const a = document.querySelector('#recaptcha-anchor');
      return a && a.getAttribute('aria-checked') === 'true';
    });
    if (checked) {
      log('recaptcha: checkbox already ticked');
      return true;
    }
    // Element click uses the iframe DOM, so a bouncing OS window cannot miss it.
    await el.click({ delay: 40 });
    log('recaptcha: clicked checkbox');
    return true;
  } catch (e) {
    log(`recaptcha: checkbox click failed (${e.message})`);
    return false;
  }
}

async function waitForCheckboxFrame(page, ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const { checkbox, challenge } = recaptchaFrames(page);
    if (checkbox || challenge) return checkbox || challenge;
    if (!(await pageLooksLikeRecaptcha(page))) return null;
    await delay(400);
  }
  return recaptchaFrames(page).checkbox || recaptchaFrames(page).challenge || null;
}

async function readPrompt(challenge) {
  try {
    return await challenge.evaluate(() => {
      const el = document.querySelector(
        '.rc-imageselect-desc-wrapper, .rc-imageselect-desc, .rc-imageselect-desc-no-canonical'
      );
      return ((el && el.innerText) || '').replace(/\s+/g, ' ').trim();
    });
  } catch (e) {
    return '';
  }
}

async function bringWindowOnscreen(page) {
  try {
    const client = await page.createCDPSession();
    const { windowId } = await client.send('Browser.getWindowForTarget');
    await client.send('Browser.setWindowBounds', {
      windowId,
      bounds: { left: 80, top: 60, width: 1280, height: 900, windowState: 'normal' },
    });
  } catch (e) {}
}

async function dumpVisible(page, name = 'visible.png') {
  fs.mkdirSync(DUMP_DIR, { recursive: true });
  const p = path.join(DUMP_DIR, name);
  try {
    await page.screenshot({ path: p, fullPage: false });
  } catch (e) {}
  return p;
}

async function tileHandles(challenge) {
  // td.rc-imageselect-tile matches twice if both selectors are used (32 "tiles").
  return challenge.$$('#rc-imageselect-target td.rc-imageselect-tile');
}

function solutionPath() {
  return path.join(DUMP_DIR, 'solution.json');
}

function readSolutionFile() {
  const p = solutionPath();
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    const indices = (raw.indices || raw.tiles || []).map((n) => parseInt(n, 10)).filter((n) => n >= 0);
    fs.unlinkSync(p);
    return indices;
  } catch (e) {
    return null;
  }
}

async function dumpChallenge(page, challenge, tab, round) {
  fs.mkdirSync(path.join(DUMP_DIR, 'tiles'), { recursive: true });
  const prompt = await readPrompt(challenge);
  const gridPath = path.join(DUMP_DIR, 'grid.png');
  try {
    const host = await challenge.frameElement();
    if (host) await host.screenshot({ path: gridPath });
    else await page.screenshot({ path: gridPath });
  } catch (e) {
    await page.screenshot({ path: gridPath }).catch(() => {});
  }
  const tiles = await tileHandles(challenge);
  const tilePaths = [];
  for (let i = 0; i < tiles.length; i += 1) {
    const p = path.join(DUMP_DIR, 'tiles', `${i}.png`);
    try {
      await tiles[i].screenshot({ path: p });
      tilePaths.push(p);
    } catch (e) {}
  }
  const visiblePath = await dumpVisible(page, 'visible.png');
  const meta = { tab, round, prompt, tileCount: tiles.length, gridPath, tilePaths, visiblePath, at: new Date().toISOString() };
  fs.writeFileSync(path.join(DUMP_DIR, 'current.json'), JSON.stringify(meta, null, 2));
  fs.writeFileSync(path.join(DUMP_DIR, 'prompt.txt'), prompt);
  return meta;
}

/** "Click verify once there are none left": clicked tiles are replaced by new images. */
function isDynamicPrompt(prompt) {
  return /none left/i.test(String(prompt || ''));
}

/** Screenshot only these tile positions (after replacement images faded in). */
async function dumpTiles(challenge, positions) {
  const tiles = await tileHandles(challenge);
  const tilePaths = [];
  const kept = [];
  for (const i of positions) {
    if (!tiles[i]) continue;
    const p = path.join(DUMP_DIR, 'tiles', `recheck-${i}.png`);
    try {
      await tiles[i].screenshot({ path: p });
      tilePaths.push(p);
      kept.push(i);
    } catch (e) {}
  }
  return { tilePaths, positions: kept };
}

/**
 * Dynamic grids: after clicking, re-check the replaced tiles until the picker
 * finds no more matches (max RECHECK_PASSES). Empty answer = "none left", done.
 */
async function recheckNewTiles(page, challenge, meta, clicked, log) {
  let positions = clicked;
  for (let pass = 1; pass <= RECHECK_PASSES && positions.length && tilePicker; pass += 1) {
    await delay(RECHECK_FADE_MS);
    const { tilePaths, positions: kept } = await dumpTiles(challenge, positions);
    if (!tilePaths.length) return;
    await dumpVisible(page, 'visible.png');
    const sub = await tilePicker({ ...meta, tilePaths, tileCount: tilePaths.length, recheck: true, positions: kept });
    const next = (Array.isArray(sub) ? sub : []).map((n) => kept[parseInt(n, 10)]).filter((n) => n != null);
    log(`recaptcha: recheck pass ${pass} of new tiles [${kept.join(',')}] → [${next.join(',')}]`);
    if (!next.length) return;
    await clickTiles(page, challenge, next, log);
    positions = next;
  }
}

async function waitForIndices(meta, log) {
  if (tilePicker) {
    const picked = await tilePicker({ ...meta, emptyOk: /click skip/i.test(meta.prompt) });
    if (Array.isArray(picked) && picked.length) return picked.map((n) => parseInt(n, 10));
    if (Array.isArray(picked) && /click skip/i.test(meta.prompt)) return [];
  }
  log(
    `recaptcha: tab=${meta.tab} round=${meta.round} "${meta.prompt}" — ${meta.tileCount} tiles. ` +
      `Look at ${path.join(DUMP_DIR, 'visible.png')} then write ${solutionPath()} {"indices":[...]}`
  );
  const deadline = Date.now() + SOLUTION_WAIT_MS;
  while (Date.now() < deadline) {
    const indices = readSolutionFile();
    if (indices && indices.length) {
      log(`recaptcha: got indices [${indices.join(',')}]`);
      return indices;
    }
    await delay(1500);
  }
  log('recaptcha: no solution.json before timeout');
  return [];
}

async function clickTiles(page, challenge, indices, log) {
  const tiles = await tileHandles(challenge);
  for (const i of indices) {
    const el = tiles[i];
    if (!el) continue;
    try {
      await el.click({ delay: 30 });
      log(`recaptcha: clicked tile ${i}`);
    } catch (e) {
      log(`recaptcha: tile ${i} failed (${e.message})`);
    }
    await delay(280 + Math.floor(Math.random() * 200));
  }
}

async function clickVerify(page, challenge, log) {
  try {
    const btn = await challenge.$('#recaptcha-verify-button');
    if (btn) {
      await btn.click({ delay: 40 });
      log('recaptcha: clicked Verify');
      return true;
    }
  } catch (e) {
    log(`recaptcha: verify failed (${e.message})`);
  }
  return false;
}

async function waitForGrid(page, ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const { challenge } = recaptchaFrames(page);
    if (challenge) {
      try {
        const n = (await tileHandles(challenge)).length;
        if (n >= 9) return challenge;
      } catch (e) {}
    }
    if (!(await pageLooksLikeRecaptcha(page))) return null;
    await delay(400);
  }
  return null;
}

async function solveOnePage(page, { tab = 0, log = console.log, timeout = GIVE_UP_MS } = {}) {
  if (!(await pageLooksLikeRecaptcha(page))) return false;
  log(`recaptcha: tab=${tab} unusual-traffic — waiting for checkbox iframe`);
  await bringWindowOnscreen(page);
  await dumpVisible(page, 'visible.png');
  const deadline = Date.now() + timeout;
  const frame = await waitForCheckboxFrame(page, 20000);
  if (!frame) {
    log(`recaptcha: tab=${tab} no iframe (page may still be loading)`);
  } else {
    let ticked = false;
    for (let i = 0; i < 2 && Date.now() < deadline; i += 1) {
      ticked = await clickRecaptchaCheckbox(page, { log });
      await delay(1500);
      if (!(await pageLooksLikeRecaptcha(page))) {
        log(`recaptcha: tab=${tab} cleared after checkbox`);
        return true;
      }
      if (ticked || recaptchaFrames(page).challenge) break;
    }
  }

  for (let round = 1; round <= MAX_ROUNDS && Date.now() < deadline; round += 1) {
    try {
      if (!(await pageLooksLikeRecaptcha(page))) {
        log(`recaptcha: tab=${tab} cleared`);
        return true;
      }
      const challenge = await waitForGrid(page, 25000);
      if (!challenge) {
        // Grid not ready (or already gone) — look again, never park on a human here.
        log(`recaptcha: tab=${tab} no tile grid yet — re-checking`);
        await delay(2000);
        continue;
      }
      const meta = await dumpChallenge(page, challenge, tab, round);
      const indices = await waitForIndices(meta, log);
      if (!indices.length && /click skip/i.test(meta.prompt)) {
        // "If there are none, click skip": nothing matching is a valid answer.
        log('recaptcha: no matching tiles — pressing Skip');
        await clickVerify(page, challenge, log);
        await delay(2500);
        continue;
      }
      if (!indices.length) {
        // Nobody could pick tiles: ask Google for a different grid instead of waiting.
        const reload = await challenge.$('#recaptcha-reload-button').catch(() => null);
        if (!reload) return false;
        log('recaptcha: no answer for this grid — requesting a new one');
        await reload.click().catch(() => {});
        await delay(2500);
        continue;
      }
      await clickTiles(page, challenge, indices, log);
      if (isDynamicPrompt(meta.prompt)) await recheckNewTiles(page, challenge, meta, indices, log);
      await delay(800 + Math.floor(Math.random() * 700));
      await clickVerify(page, challenge, log);
      await delay(2500);
    } catch (e) {
      // Verify/redirect replaces the iframe mid-round: re-evaluate the page.
      if (!/detached|Target closed|Execution context|Session closed/i.test(e.message)) throw e;
      log(`recaptcha: tab=${tab} frame changed (${e.message.slice(0, 40)}) — re-checking`);
      await delay(2000);
    }
  }

  const ok = !(await pageLooksLikeRecaptcha(page));
  log(ok ? `recaptcha: tab=${tab} done — next tab can start` : `recaptcha: tab=${tab} still blocked`);
  return ok;
}

async function solveRecaptchaIfPresent(page, opts = {}) {
  if (!(await pageLooksLikeRecaptcha(page))) return false;
  return withCaptchaLock(() => solveOnePage(page, opts));
}

module.exports = {
  DUMP_DIR,
  recaptchaFrames,
  pageLooksLikeRecaptcha,
  clickRecaptchaCheckbox,
  solveRecaptchaIfPresent,
  withCaptchaLock,
  isCaptchaSolving,
  setRecaptchaTilePicker,
  isDynamicPrompt,
};
