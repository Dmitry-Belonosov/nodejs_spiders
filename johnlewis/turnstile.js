/**
 * Cloudflare Turnstile — click "Verify you are human" checkbox.
 *
 * The widget iframe lives in a closed shadow root, so querySelectorAll('iframe')
 * on the main document is empty. Use page.frames() + frame.frameElement().
 */
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pageLooksChallenged(page) {
  try {
    return await page.evaluate(() => {
      const title = document.title || '';
      const t = (document.body && document.body.innerText) || '';
      const href = location.href || '';
      return (
        /Just a moment/i.test(title) ||
        /Verify you are human|Performing security verification|Checking your browser/i.test(
          t
        ) ||
        href.includes('ki-cf-botcl')
      );
    });
  } catch (e) {
    return false;
  }
}

function findTurnstileFrame(page) {
  return (
    page.frames().find((f) => /challenges\.cloudflare\.com.*turnstile/i.test(f.url())) ||
    page.frames().find((f) => /challenges\.cloudflare\.com/i.test(f.url())) ||
    null
  );
}

async function getTurnstileBox(page) {
  const frame = findTurnstileFrame(page);
  if (!frame || typeof frame.frameElement !== 'function') return null;
  try {
    const el = await frame.frameElement();
    if (!el) return null;
    const box = await el.boundingBox();
    if (!box || box.width < 40 || box.height < 20) return null;
    return { box, el, frame };
  } catch (e) {
    return null;
  }
}

async function humanClick(page, x, y) {
  const start = await page.evaluate(() => ({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  }));
  await page.mouse.move(start.x, start.y);
  await delay(40 + Math.floor(Math.random() * 80));
  await page.mouse.move(x, y, { steps: 12 + Math.floor(Math.random() * 10) });
  await delay(60 + Math.floor(Math.random() * 140));
  await page.mouse.down();
  await delay(40 + Math.floor(Math.random() * 80));
  await page.mouse.up();
}

/**
 * Click the Turnstile checkbox (left side of the 300x65 widget).
 * Returns true if a click was attempted.
 */
async function clickTurnstileCheckbox(page, { log = console.log } = {}) {
  const info = await getTurnstileBox(page);
  if (!info) {
    log('turnstile: no widget box yet');
    return false;
  }
  const { box, el } = info;
  // Checkbox sits on the left of the Turnstile bar (~26px from left, vertical center)
  const x = box.x + Math.min(28, Math.max(20, box.width * 0.1));
  const y = box.y + box.height / 2;
  try {
    // Prefer elementHandle.click with offset (works through shadow host)
    await el.click({
      offset: { x: Math.min(28, box.width * 0.1), y: box.height / 2 },
      delay: 45,
    });
    log(
      `turnstile: clicked checkbox (el.click) at ~${Math.round(x)},${Math.round(y)} (${Math.round(box.width)}x${Math.round(box.height)})`
    );
    return true;
  } catch (e) {
    try {
      await humanClick(page, x, y);
      log(
        `turnstile: clicked checkbox (mouse) at ${Math.round(x)},${Math.round(y)} (${Math.round(box.width)}x${Math.round(box.height)})`
      );
      return true;
    } catch (e2) {
      log('turnstile: click failed: ' + (e2.message || e2));
      return false;
    }
  }
}

/**
 * If CF challenge is up, click the checkbox once and wait for clearance.
 */
async function solveTurnstileIfPresent(
  page,
  { timeout = 60000, log = console.log, onBeforeClick = null } = {}
) {
  const challenged = await pageLooksChallenged(page);
  if (!challenged) return false;

  log('turnstile: challenge detected — waiting for widget…');
  const deadline = Date.now() + timeout;
  let clicked = false;
  let lastClickAt = 0;

  while (Date.now() < deadline) {
    if (!(await pageLooksChallenged(page))) {
      log('turnstile: cleared');
      return true;
    }

    // Success interstitial sometimes appears before redirect
    try {
      const success = await page.evaluate(() =>
        /Verification successful/i.test(
          (document.body && document.body.innerText) || ''
        )
      );
      if (success) {
        log('turnstile: verification successful — waiting for redirect…');
        await delay(3000);
        if (!(await pageLooksChallenged(page))) {
          log('turnstile: cleared after success');
          return true;
        }
      }
    } catch (e) {}

    const boxInfo = await getTurnstileBox(page);
    if (boxInfo && !clicked) {
      if (typeof onBeforeClick === 'function') {
        try {
          await onBeforeClick();
        } catch (e) {}
      }
      // Let the widget finish painting
      await delay(800 + Math.floor(Math.random() * 700));
      clicked = await clickTurnstileCheckbox(page, { log });
      lastClickAt = Date.now();
    } else if (boxInfo && clicked && Date.now() - lastClickAt > 20000) {
      // One retry only after 20s if still stuck
      log('turnstile: retry click…');
      clicked = await clickTurnstileCheckbox(page, { log });
      lastClickAt = Date.now();
    }

    try {
      await page.waitForFunction(
        () => {
          const title = document.title || '';
          const t = (document.body && document.body.innerText) || '';
          const href = location.href || '';
          if (/Verification successful/i.test(t)) return false; // keep waiting for nav
          return (
            !/Just a moment/i.test(title) &&
            !/Verify you are human|Performing security verification|Checking your browser/i.test(
              t
            ) &&
            !href.includes('ki-cf-botcl')
          );
        },
        { timeout: 5000 }
      );
      log('turnstile: cleared after wait');
      return true;
    } catch (e) {
      // still challenged
    }
    await delay(400);
  }

  log('turnstile: timeout still challenged');
  return false;
}

module.exports = {
  pageLooksChallenged,
  clickTurnstileCheckbox,
  solveTurnstileIfPresent,
  getTurnstileBox,
  findTurnstileFrame,
};
