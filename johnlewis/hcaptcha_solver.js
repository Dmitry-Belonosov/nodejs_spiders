/**
 * hCaptcha tile solver (proven on bueromarkt / rsonline). Used here if John Lewis
 * presents the same "I am human" challenge.
 *
 * Reference image / prompt → what to click:
 *  1) smartphone / "more money|expensive"     → airplane / plane
 *  2) watering can / "grow when you use"      → flowers
 *  3) turtle / "live where the reference"     → shark + jellyfish
 *  4) spray / "spray with the item"           → flowers
 *  5) towel / "foldable|towel"                → towel / blanket
 *
 * Classification uses CLIP zero-shot (@xenova/transformers) on tile screenshots.
 * Falls back to dumping tiles under /tmp/johnlewis-captcha for manual assist.
 */
const fs = require('fs');
const path = require('path');

const DUMP_DIR = process.env.CAPTCHA_DUMP_DIR || '/tmp/johnlewis-captcha';
const MAX_ROUNDS = parseInt(process.env.CAPTCHA_MAX_ROUNDS || '4', 10);
const CLICK_DELAY_MS = parseInt(process.env.CAPTCHA_CLICK_DELAY_MS || '700', 10);
const CHECKBOX_WAIT_MS = parseInt(process.env.CAPTCHA_CHECKBOX_WAIT_MS || '15000', 10);
const ROUND_WAIT_MS = parseInt(process.env.CAPTCHA_ROUND_WAIT_MS || '15000', 10);
const CAPTCHA_GIVE_UP_MS = parseInt(process.env.CAPTCHA_GIVE_UP_MS || String(4 * 60 * 1000), 10);
// Moving/resizing the window during challenge makes the modal twitch/shrink.
const MOVE_WINDOW = process.env.CAPTCHA_MOVE_WINDOW === '1';

let classifierPromise = null;
let solving = false;
let solveChain = Promise.resolve();

function isCaptchaSolving() {
  return solving;
}

/** Serialize captcha solves across tabs; blocks browser rotates while busy. */
function withCaptchaLock(fn) {
  const queued = solving;
  if (queued) {
    console.log('hcaptcha: queued — other tab is solving; this tab waits on "I am human"');
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

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function ensureDumpDir() {
  fs.mkdirSync(DUMP_DIR, { recursive: true });
}

/**
 * @param {string} prompt
 * @returns {string[]|null} CLIP labels to accept
 */
function targetsFromPrompt(prompt) {
  const p = String(prompt || '').toLowerCase();
  if (/more money|cost you more|expensive than/.test(p)) {
    return ['airplane', 'jet airliner', 'passenger plane'];
  }
  if (/grow when you use|watering can|interact with watering/.test(p)) {
    return ['flower', 'sunflower', 'lily', 'plant blossom'];
  }
  if (/live where the reference|same area|animals that live/.test(p)) {
    return ['shark', 'jellyfish', 'jelly fish', 'marine animal underwater'];
  }
  if (/spray with the item|usually spray|tap on things you would usually spray/.test(p)) {
    return ['flower', 'sunflower', 'lily', 'plant blossom'];
  }
  if (/foldable|towel|another towel/.test(p)) {
    return ['towel', 'beach towel', 'blanket', 'folded fabric'];
  }
  return null;
}

/**
 * @param {string} refLabel top CLIP label for reference thumbnail
 */
function targetsFromReferenceLabel(refLabel) {
  const l = String(refLabel || '').toLowerCase();
  if (/phone|smartphone|mobile/.test(l)) {
    return ['airplane', 'jet airliner', 'passenger plane'];
  }
  if (/watering|can|garden can/.test(l)) {
    return ['flower', 'sunflower', 'lily', 'plant blossom'];
  }
  if (/turtle|tortoise/.test(l)) {
    return ['shark', 'jellyfish', 'jelly fish', 'marine animal underwater'];
  }
  if (/spray|bottle|cleaner/.test(l)) {
    return ['flower', 'sunflower', 'lily', 'plant blossom'];
  }
  if (/towel|linen|cloth/.test(l)) {
    return ['towel', 'beach towel', 'blanket', 'folded fabric'];
  }
  return null;
}

const TILE_CANDIDATE_LABELS = [
  'airplane',
  'jet airliner',
  'passenger plane',
  'flower',
  'sunflower',
  'lily',
  'plant blossom',
  'shark',
  'jellyfish',
  'jelly fish',
  'marine animal underwater',
  'towel',
  'beach towel',
  'blanket',
  'folded fabric',
  'broom',
  'envelope',
  'basketball',
  'donkey',
  'dog',
  'deer',
  'mountain',
  'window',
  'construction site',
  'cement mixer truck',
  'bus',
  'smartphone',
  'watering can',
  'sea turtle',
  'spray bottle',
];

const REF_CANDIDATE_LABELS = [
  'smartphone',
  'mobile phone',
  'watering can',
  'sea turtle',
  'turtle underwater',
  'spray bottle',
  'cleaning spray',
  'folded towel',
  'beach towel',
];

async function getClassifier() {
  if (!classifierPromise) {
    classifierPromise = (async () => {
      const { pipeline, env } = await import('@xenova/transformers');
      // Keep models in project-local cache when possible.
      env.cacheDir = path.join(__dirname, '.cache', 'transformers');
      fs.mkdirSync(env.cacheDir, { recursive: true });
      console.log('hcaptcha: loading CLIP classifier (first run downloads model)...');
      const pipe = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
      console.log('hcaptcha: CLIP ready');
      return pipe;
    })().catch((e) => {
      classifierPromise = null;
      throw e;
    });
  }
  return classifierPromise;
}

async function classifyImageFile(filePath, labels) {
  const pipe = await getClassifier();
  const result = await pipe(filePath, labels);
  return result; // [{label, score}, ...]
}

function labelMatchesTargets(label, targets) {
  const l = String(label || '').toLowerCase();
  return targets.some((t) => {
    const tt = t.toLowerCase();
    return l.includes(tt) || tt.includes(l) || l.split(/\s+/).some((w) => tt.includes(w) && w.length > 3);
  });
}

async function bringWindowOnscreen(page) {
  if (!MOVE_WINDOW) return;
  try {
    const client = await page.createCDPSession();
    const { windowId } = await client.send('Browser.getWindowForTarget');
    await client.send('Browser.setWindowBounds', {
      windowId,
      bounds: { left: 80, top: 40, width: 1280, height: 900, windowPosition: 'normal' },
    });
  } catch (e) {}
}

function findChallengeFrame(page) {
  return (
    page.frames().find((f) => /frame=challenge/i.test(f.url())) ||
    page
      .frames()
      .find((f) => /hcaptcha\.com\/captcha\//i.test(f.url()) && !/checkbox/i.test(f.url())) ||
    null
  );
}

function isRealPrompt(prompt) {
  const p = String(prompt || '');
  if (!p.trim()) return false;
  // Real challenge text wins even if an old "Please try again" toast is still in the DOM.
  if (/select |find |tap on /i.test(p)) return true;
  if (/please try again/i.test(p)) return false;
  return false;
}

/**
 * After checkbox click, wait patiently for the full 3x3 challenge to render.
 * Do NOT click anything else during this wait (causes twitch / shrink).
 * If hCaptcha shows "Please try again", hit refresh and keep waiting.
 */
async function waitForChallengeReady(page, timeoutMs) {
  const start = Date.now();
  let lastLog = 0;
  let lastRefresh = 0;
  while (Date.now() - start < timeoutMs) {
    const challenge = findChallengeFrame(page);
    if (challenge) {
      try {
        const info = await challenge.evaluate(() => {
          const promptEl =
            document.querySelector('.prompt-text') ||
            document.querySelector('.prompt-padding') ||
            document.querySelector('[class*="prompt"]');
          return {
            tiles: document.querySelectorAll('.task-image').length,
            prompt: (promptEl && promptEl.textContent) || '',
            text: (document.body && document.body.innerText.slice(0, 160)) || '',
          };
        });
        const combined = `${info.prompt}\n${info.text}`;
        if (Date.now() - lastLog > 4000) {
          console.log(
            `hcaptcha: waiting for grid… tiles=${info.tiles} prompt=${JSON.stringify(
              combined
            ).slice(0, 80)}`
          );
          lastLog = Date.now();
        }
        if (info.tiles >= 9 && isRealPrompt(combined)) {
          console.log(`hcaptcha: grid ready after ${Date.now() - start}ms`);
          return challenge;
        }
        // Only refresh on real error state — never when a normal prompt is visible.
        if (
          /please try again/i.test(combined) &&
          !isRealPrompt(combined) &&
          info.tiles < 9 &&
          Date.now() - lastRefresh > 6000
        ) {
          console.log('hcaptcha: "Please try again" — clicking refresh');
          await challenge.evaluate(() => {
            const refresh =
              document.querySelector('.refresh-button') ||
              document.querySelector('[aria-label*="Refresh" i]') ||
              document.querySelector('.button-refresh') ||
              Array.from(document.querySelectorAll('button, .button, div[role="button"]')).find(
                (b) => /refresh|reload/i.test(b.getAttribute('title') || b.getAttribute('aria-label') || '')
              );
            if (refresh) refresh.click();
            else {
              const candidates = Array.from(document.querySelectorAll('div, button, span'));
              const arrow = candidates.find((el) => {
                const c = el.className || '';
                return /refresh|reload/i.test(c);
              });
              if (arrow) arrow.click();
            }
          }).catch(() => {});
          lastRefresh = Date.now();
          await delay(2500);
        }
      } catch (e) {
        // frame navigated mid-wait
      }
    }
    await delay(250);
  }
  return findChallengeFrame(page);
}

/** Soft-reset challenge: refresh or re-click "I am human". */
async function recoverChallenge(page) {
  const challenge = findChallengeFrame(page);
  if (challenge) {
    try {
      await challenge.evaluate(() => {
        const refresh =
          document.querySelector('.refresh-button') ||
          document.querySelector('[aria-label*="Refresh" i]');
        if (refresh) refresh.click();
      });
      await delay(2000);
      return;
    } catch (e) {}
  }
  // Re-open from checkbox
  console.log('hcaptcha: recover via checkbox re-click');
  await clickCheckboxIfNeeded(page);
  await delay(2000);
}

function findHcaptchaFrames(page) {
  const frames = page.frames();
  const checkbox = frames.find(
    (f) => /hcaptcha\.com/i.test(f.url()) && /checkbox|frame=checkbox/i.test(f.url())
  );
  const challenge = frames.find(
    (f) =>
      /hcaptcha\.com/i.test(f.url()) &&
      (/challenge|frame=challenge/i.test(f.url()) || /newassets\.hcaptcha\.com\/captcha/i.test(f.url()))
  );
  // Broad fallback: any hcaptcha frame that isn't the tiny checkbox
  const any = frames.filter((f) => /hcaptcha\.com/i.test(f.url()));
  return { checkbox, challenge, any };
}

async function isCheckboxAlreadyChecked(page) {
  const { checkbox, any } = findHcaptchaFrames(page);
  const frame = checkbox || any.find((f) => /checkbox/i.test(f.url()));
  if (!frame) return false;
  try {
    return await frame.evaluate(() => {
      const el = document.querySelector('#checkbox, [role="checkbox"]');
      if (!el) return false;
      const aria = (el.getAttribute('aria-checked') || '').toLowerCase();
      if (aria === 'true') return true;
      return el.classList.contains('checked') || el.getAttribute('data-checked') === 'true';
    });
  } catch (e) {
    return false;
  }
}

async function clickCheckboxIfNeeded(page, { force = false } = {}) {
  // Skip only when already ticked — never skip just because a stale challenge iframe exists.
  if (!force) {
    try {
      if (await isCheckboxAlreadyChecked(page)) {
        const challenge = page.frames().find((f) => /frame=challenge/i.test(f.url()));
        if (challenge) {
          const info = await challenge
            .evaluate(() => {
              const promptEl = document.querySelector('.prompt-text');
              return {
                tiles: document.querySelectorAll('.task-image').length,
                text: (document.body && document.body.innerText.slice(0, 120)) || '',
                prompt: (promptEl && promptEl.textContent) || '',
              };
            })
            .catch(() => ({ tiles: 0, text: '', prompt: '' }));
          const combined = `${info.prompt}\n${info.text}`;
          if (info.tiles >= 9 && isRealPrompt(combined)) {
            console.log('hcaptcha: "I am human" already checked + 3x3 open');
            return false;
          }
        }
      }
    } catch (e) {}
  }

  console.log('hcaptcha: clicking "I am human" checkbox…');
  const { checkbox, any } = findHcaptchaFrames(page);
  const frame = checkbox || any.find((f) => /checkbox/i.test(f.url()));
  if (!frame) {
    // Fallback: click the visible widget on the page
    try {
      const widget = await page.$('iframe[src*="hcaptcha"]');
      if (widget) {
        const bb = await widget.boundingBox();
        if (bb) {
          await page.mouse.click(bb.x + 28, bb.y + bb.height / 2, { delay: 40 });
          console.log('hcaptcha: clicked widget iframe (I am human)');
          await delay(500);
          return true;
        }
      }
    } catch (e) {}
    console.error('hcaptcha: no checkbox frame found');
    return false;
  }
  try {
    const el = await frame.$('#checkbox, [role="checkbox"]');
    if (el) {
      const box = await el.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { delay: 40 });
        console.log('hcaptcha: clicked "I am human"');
        await delay(500);
        return true;
      }
    }
  } catch (e) {
    console.error('hcaptcha checkbox click:', e.message);
  }
  try {
    const widget = await page.$(
      'iframe[src*="hcaptcha"][src*="checkbox"], iframe[src*="hcaptcha"]'
    );
    if (widget) {
      const bb = await widget.boundingBox();
      if (bb) {
        await page.mouse.click(bb.x + 28, bb.y + bb.height / 2);
        console.log('hcaptcha: clicked widget iframe');
        await delay(500);
        return true;
      }
    }
  } catch (e) {}
  return false;
}

async function readPrompt(challengeFrame) {
  try {
    return await challengeFrame.evaluate(() => {
      const el =
        document.querySelector('.prompt-text') ||
        document.querySelector('.prompt-padding') ||
        document.querySelector('[class*="prompt"]') ||
        document.querySelector('h2');
      return (el && el.textContent) || document.body.innerText.slice(0, 300);
    });
  } catch (e) {
    return '';
  }
}

/** Pull tile/ref image bytes via fetch inside the challenge frame (works offscreen). */
async function fetchChallengeImages(challengeFrame) {
  try {
    return await challengeFrame.evaluate(async () => {
      async function urlToB64(url) {
        if (!url || url === 'none') return null;
        const r = await fetch(url);
        const buf = await r.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return btoa(binary);
      }
      function bgUrl(el) {
        if (!el) return null;
        const img = el.tagName === 'IMG' ? el : el.querySelector('img');
        if (img && img.src) return img.src;
        const style = window.getComputedStyle(el);
        const m = /url\(["']?(.*?)["']?\)/.exec(style.backgroundImage || '');
        return m ? m[1] : null;
      }
      const refEl =
        document.querySelector('.prompt-image') ||
        document.querySelector('.challenge-header .image') ||
        document.querySelector('.challenge-header img') ||
        document.querySelector('.prompt-padding img');
      const tileEls = Array.from(document.querySelectorAll('.task-image'));
      const tiles = [];
      for (const el of tileEls.slice(0, 12)) {
        const inner = el.querySelector('.image') || el;
        tiles.push(await urlToB64(bgUrl(inner)));
      }
      return { ref: await urlToB64(bgUrl(refEl)), tiles };
    });
  } catch (e) {
    console.error('hcaptcha fetch images failed:', e.message);
    return { ref: null, tiles: [] };
  }
}

async function dumpChallenge(challengeFrame, round) {
  ensureDumpDir();
  const stamp = `${Date.now()}_r${round}`;
  const fullPath = path.join(DUMP_DIR, `${stamp}_full.png`);
  // Optional full-page dump — skip if offscreen (often hangs).
  if (MOVE_WINDOW) {
    try {
      await challengeFrame.page().screenshot({ path: fullPath, fullPage: false });
    } catch (e) {}
  }

  let tiles = await challengeFrame.$$('.task-image');
  if (tiles.length < 9) tiles = await challengeFrame.$$('.task-grid .image, .task-grid > div');
  if (tiles.length < 9) tiles = await challengeFrame.$$('div[class*="task"]');

  // Prefer fetching tile image URLs (no CDP screenshot — works with offscreen Chrome).
  const fetched = await fetchChallengeImages(challengeFrame);
  let refPath = path.join(DUMP_DIR, `${stamp}_ref.png`);
  if (fetched.ref) {
    fs.writeFileSync(refPath, Buffer.from(fetched.ref, 'base64'));
  } else {
    refPath = null;
    if (MOVE_WINDOW) {
      try {
        const ref = await challengeFrame.$(
          '.prompt-image, .challenge-header img, .header img, img'
        );
        if (ref) {
          refPath = path.join(DUMP_DIR, `${stamp}_ref.png`);
          await ref.screenshot({ path: refPath });
        }
      } catch (e) {
        refPath = null;
      }
    }
  }

  const tilePaths = [];
  for (let i = 0; i < Math.min(tiles.length, 12); i += 1) {
    const p = path.join(DUMP_DIR, `${stamp}_tile_${i}.png`);
    let ok = false;
    if (fetched.tiles[i]) {
      try {
        fs.writeFileSync(p, Buffer.from(fetched.tiles[i], 'base64'));
        ok = true;
      } catch (e) {}
    }
    if (!ok && MOVE_WINDOW) {
      try {
        await tiles[i].screenshot({ path: p });
        ok = true;
      } catch (e) {
        console.error(`hcaptcha tile ${i} screenshot failed:`, e.message);
      }
    }
    if (!ok && !fetched.tiles[i]) {
      console.error(`hcaptcha tile ${i}: no image bytes`);
    }
    if (ok) tilePaths.push({ index: i, path: p, handle: tiles[i] });
  }
  console.log(
    `hcaptcha: dumped ${tilePaths.length}/${tiles.length} tiles via ${
      fetched.tiles.filter(Boolean).length ? 'fetch' : 'screenshot'
    }`
  );

  const prompt = await readPrompt(challengeFrame);
  fs.writeFileSync(
    path.join(DUMP_DIR, `${stamp}_meta.json`),
    JSON.stringify(
      { prompt, refPath, tiles: tilePaths.map((t) => ({ index: t.index, path: t.path })) },
      null,
      2
    )
  );
  return { prompt, refPath, tiles: tilePaths, stamp, fullPath };
}

async function resolveTargets(prompt, refPath) {
  let targets = targetsFromPrompt(prompt);
  if (targets) {
    console.log(`hcaptcha: targets from prompt → ${targets.join(', ')}`);
    return targets;
  }
  if (refPath && fs.existsSync(refPath)) {
    try {
      const ranked = await classifyImageFile(refPath, REF_CANDIDATE_LABELS);
      console.log(
        'hcaptcha: ref classification',
        ranked.slice(0, 3).map((r) => `${r.label}:${r.score.toFixed(2)}`).join(', ')
      );
      targets = targetsFromReferenceLabel(ranked[0] && ranked[0].label);
      if (targets) return targets;
    } catch (e) {
      console.error('hcaptcha ref classify:', e.message);
    }
  }
  return null;
}

async function chooseTiles(tileInfos, targets) {
  const picks = [];
  for (const t of tileInfos) {
    try {
      const ranked = await classifyImageFile(t.path, TILE_CANDIDATE_LABELS);
      const top = ranked.slice(0, 4);
      const hit = top.find((r) => r.score >= 0.12 && labelMatchesTargets(r.label, targets));
      console.log(
        `hcaptcha tile[${t.index}]`,
        top.map((r) => `${r.label}:${r.score.toFixed(2)}`).join(' | '),
        hit ? '→ CLICK' : ''
      );
      if (hit) picks.push(t);
    } catch (e) {
      console.error(`hcaptcha tile[${t.index}] classify:`, e.message);
    }
  }
  return picks;
}

async function clickNextOrVerify(challengeFrame) {
  const clicked = await challengeFrame.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, .button'));
    const prefer = buttons.find((b) => /verify|submit|check/i.test(b.textContent || ''));
    const next = buttons.find((b) => /next/i.test(b.textContent || ''));
    const btn = prefer || next;
    if (btn) {
      btn.click();
      return (btn.textContent || '').trim();
    }
    return '';
  });
  if (clicked) {
    console.log(`hcaptcha: clicked ${clicked}`);
    await delay(2000);
    return true;
  }
  // fallback selectors
  for (const sel of ['.button-submit', '.verify-button', '#menu-info .button']) {
    try {
      const el = await challengeFrame.$(sel);
      if (el) {
        await el.click();
        await delay(2000);
        return true;
      }
    } catch (e) {}
  }
  return false;
}

async function challengeStillOpen(page) {
  const html = await page.content().catch(() => '');
  const title = await page.title().catch(() => '');
  if (/Sicherheitsfrage/i.test(title)) return true;
  if (/hcaptcha/i.test(html) && /sicherheits/i.test(html)) return true;
  const { challenge, any } = findHcaptchaFrames(page);
  if (challenge) {
    try {
      const hasGrid = await challenge.$('.task-image, .task-grid');
      if (hasGrid) return true;
    } catch (e) {}
  }
  return any.some((f) => /challenge/i.test(f.url()));
}

/**
 * Attempt to solve hCaptcha on the page. Returns true if challenge cleared.
 * @param {import('puppeteer-core').Page} page
 */
async function solveHcaptcha(page) {
  return withCaptchaLock(async () => {
    ensureDumpDir();
    await bringWindowOnscreen(page);

    // Step 1 MUST always be "I am human" first (skip only if already checked + grid open).
    const alreadyChecked = await isCheckboxAlreadyChecked(page);
    let gridReady = false;
    if (alreadyChecked) {
      const already = findChallengeFrame(page);
      if (already) {
        try {
          const info = await already.evaluate(() => {
            const promptEl = document.querySelector('.prompt-text');
            return {
              tiles: document.querySelectorAll('.task-image').length,
              prompt: (promptEl && promptEl.textContent) || '',
              text: (document.body && document.body.innerText.slice(0, 120)) || '',
            };
          });
          gridReady = info.tiles >= 9 && isRealPrompt(`${info.prompt}\n${info.text}`);
        } catch (e) {}
      }
    }
    if (!gridReady) {
      console.log('hcaptcha: step 1 — tick "I am human" first');
      await clickCheckboxIfNeeded(page, { force: !alreadyChecked });
      await delay(800);
      console.log(`hcaptcha: step 2 — wait up to ${CHECKBOX_WAIT_MS}ms for 3x3 grid…`);
      await waitForChallengeReady(page, CHECKBOX_WAIT_MS);
    } else {
      console.log('hcaptcha: "I am human" already ticked + 3x3 open');
    }

    for (let round = 1; round <= MAX_ROUNDS; round += 1) {
      if (!(await challengeStillOpen(page))) {
        console.log('hcaptcha: cleared');
        return true;
      }

      let challenge = await waitForChallengeReady(page, ROUND_WAIT_MS);
      if (!challenge) {
        console.error('hcaptcha: no challenge frame (round ' + round + ')');
        return false;
      }

      // Dump tiles once per round — avoid full-page screenshot spam.
      const dump = await dumpChallenge(challenge, round);
      console.log(`hcaptcha round ${round} prompt: ${JSON.stringify(dump.prompt).slice(0, 120)}`);

      if (!isRealPrompt(dump.prompt)) {
        console.error('hcaptcha: prompt not ready / error state — recover (refresh/checkbox)');
        await recoverChallenge(page);
        await waitForChallengeReady(page, ROUND_WAIT_MS);
        continue;
      }

      let targets;
      try {
        targets = await resolveTargets(dump.prompt, dump.refPath);
      } catch (e) {
        console.error('hcaptcha resolveTargets:', e.message);
        targets = targetsFromPrompt(dump.prompt);
      }

      if (!targets) {
        console.error('hcaptcha: unknown challenge type — tiles dumped to', DUMP_DIR);
        return false;
      }

      let picks;
      try {
        picks = await chooseTiles(dump.tiles, targets);
      } catch (e) {
        console.error('hcaptcha classify failed:', e.message);
        return false;
      }

      // Click by index inside the challenge iframe (works even when Chrome is offscreen).
      challenge = findChallengeFrame(page);
      if (!challenge) return false;
      if (!picks.length) {
        console.error('hcaptcha: no tiles matched targets');
      } else {
        const indices = picks.map((t) => t.index);
        console.log(`hcaptcha: clicking tiles [${indices.join(',')}] slowly`);
        for (const index of indices) {
          const ch = findChallengeFrame(page);
          if (!ch) break;
          const clicked = await ch
            .evaluate((idx) => {
              const tiles = Array.from(document.querySelectorAll('.task-image'));
              const el = tiles[idx];
              if (!el) return false;
              el.click();
              return true;
            }, index)
            .catch(() => false);
          console.log(
            clicked ? `hcaptcha: clicked tile ${index}` : `hcaptcha: tile ${index} click missed`
          );
          await delay(CLICK_DELAY_MS);
        }
      }

      await delay(800);
      const freshForBtn = findChallengeFrame(page);
      if (freshForBtn) await clickNextOrVerify(freshForBtn);

      // Important: give round-2 (or verify) a moment, then poll for next grid.
      console.log(`hcaptcha: waiting for next round / verify (up to ${ROUND_WAIT_MS}ms)…`);
      await delay(800);
      if (!(await challengeStillOpen(page))) {
        console.log('hcaptcha: cleared after verify');
        return true;
      }
      await waitForChallengeReady(page, ROUND_WAIT_MS);
    }

    const cleared = !(await challengeStillOpen(page));
    console.log(
      cleared ? 'hcaptcha: cleared after rounds' : 'hcaptcha: still open after max rounds'
    );
    return cleared;
  });
}

function pageLooksLikeHcaptcha(html, title) {
  const s = `${title || ''}\n${html || ''}`;
  // Exact interstitial the site shows before the shop (user-confirmed).
  if (/Sicherheitsfrage/i.test(s)) return true;
  if (/Captcha-Abfrage/i.test(s) && /Shop leiten/i.test(s)) return true;
  if (/security check is required/i.test(s)) return true;
  if (/I am human/i.test(s) && /hcaptcha/i.test(s)) return true;
  return /hcaptcha\.com/i.test(s) && /Incapsula|sicherheits/i.test(s);
}

module.exports = {
  solveHcaptcha,
  pageLooksLikeHcaptcha,
  targetsFromPrompt,
  bringWindowOnscreen,
  isCaptchaSolving,
  withCaptchaLock,
  DUMP_DIR,
  CAPTCHA_GIVE_UP_MS,
};
