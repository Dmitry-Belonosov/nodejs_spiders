---
name: google-shopping-full-run
description: Launch and babysit a full Google Shopping card crawl (Chrome for Testing, recaptcha, VPN reconnect, session refresh, parse pauses). Use when the user asks to run google-shopping, watch captchas, do a full 50-card progon, keep an eye on Chrome, or monitor Parser Shell / npm start for this spider.
---

# Google Shopping full-run babysit

Do **not** start the crawl unless the user explicitly says to run it. This skill is the operating plan.

Spider root: the folder that contains this project's `package.json` / `run.js` (usually `google-shopping/` in the workspace). Do not hardcode `/Users/dmitry/...`.  
Captcha dumps: `/tmp/google-shopping-captcha/`  
Chrome profile: `/tmp/google-shopping-pp-profile-1`  
Queue: `http://127.0.0.1:5057/status`  
Locale must be **US** (`gl=us&hl=en`). A UK/DE/RU exit is a different dataset.

You must **see the screen**. Never click blind. Never reuse tile numbers from a previous grid.

## Layout (mandatory)

- **1 Chrome for Testing window × 1 tab.** Never 10×2 (Parser Shell default).
- `HEADLESS=0` `HIDE_CHROME=0` so the window is on-screen at about `{80,80}`.
- `USE_PROXY=0` — system VPN, not ProxyRack (ProxyRack timed out / empty responses).
- `STRICT_US=1` only when the VPN window shows a **US** exit. If the VPN is GB/London, either reconnect to US first or the crawl will mismatch fixture ids.
- `WINDOWS=1` `THREADS=1` `DELAY_MS=5000` (pauses between products; see Pauses).
- `CAPTCHA_WAIT_MS=300000` so a grid is not abandoned while you look at it.
- Binary: Chrome **for Testing**, not Google Chrome.app.

## Watch the screen (every tick)

You cannot trust desktop `screencapture` alone — Chrome for Testing often sits off the captured desktop. Always use **both**:

1. Worker dump `/tmp/google-shopping-captcha/visible.png` (source of truth for captcha).
2. `/tmp/google-shopping-captcha/grid.png`, `prompt.txt`, `current.json`, `tiles/N.png`.
3. A full desktop screenshot (`screencapture -x /tmp/gs-desktop.png`) for the **VPN window**.
4. Supervisor log: recaptcha / `/sorry/` / `blocked` / `ERR_` / `progress N/50`.
5. `curl -s http://127.0.0.1:5057/status`

Bring Chrome on-screen (do this **once** after launch, not in a loop — looping bounds/screenshots **shakes** the window and misses clicks):

```applescript
tell application "System Events"
  tell process "Google Chrome for Testing"
    set frontmost to true
    if (count of windows) > 0 then
      set position of window 1 to {80, 80}
      set size of window 1 to {1280, 800}
    end if
  end tell
end tell
```

**Never** poll `visible.png` every 1.5s and never reset window bounds in a loop.

## Captcha sequence (automatic, visual)

Do this **every** challenge. Read **this** grid’s prompt only.

1. **See** `visible.png`. Confirm `/sorry/` + “I’m not a robot”. If the page is `ERR_TIMED_OUT` / `ERR_EMPTY_RESPONSE` / chrome-error, there is **no** checkbox — go to VPN + session refresh. Do not click empty space.
2. **Click the checkbox** via the recaptcha **iframe DOM** (`#recaptcha-anchor`), not OS coordinates. Worker already does this (`recaptcha.js` `element.click()`). If it did not tick, attach to DevTools (`/tmp/google-shopping-pp-profile-1/DevToolsActivePort`) and click the iframe element once.
3. Wait until `current.json` + `grid.png` appear. Confirm `tileCount` is **9 or 16**, not 32 (32 means the dual-selector bug — only `#rc-imageselect-target td.rc-imageselect-tile`).
4. **Click the tiles that match the prompt** (0-based). Write `/tmp/google-shopping-captcha/solution.json` as `{"indices":[...]}` after you have **looked at the pictures**. Examples of prompts seen live: stairs, bicycles, motorcycles, fire hydrants, crosswalks, buses.
5. **Wait 5 seconds.**
6. **Check that all is OK** — new `visible.png`: selected tiles still match the prompt; no “try again”; grid not expired; checkmarks on the right squares. If a new object was asked, click the extra tiles and wait 5s again.
7. **Then** press **Verify**.

If the worker still auto-Verify’s ~600ms after tiles, patch `recaptcha.js` **before** the run so after `clickTiles` it: dumps `visible.png`, waits **5000ms**, dumps again, then clicks Verify. Cursor must still look at those dumps and only write `solution.json` for the tiles.

Wrong (we did this): reuse motorcycle indices on a fire-hydrant grid → expired challenge → Chrome reset.

## VPN (window is open on the desktop)

Every watch tick, look at the desktop screenshot of the VPN app:

- Must show **Connected**.
- Full run needs a **US** city, not London/GB.
- If **Disconnected**, connecting, error, or the crawl is **stuck** (`ERR_TIMED_OUT`, `ERR_EMPTY_RESPONSE`, no new `data/products` for ~3 min, Chrome on chrome-error) → **Reconnect** in that VPN UI (click the reconnect/connect control you can see). Wait until it shows Connected. Then refresh Chrome for Testing (next section). Do not keep hammering Google on a dead tunnel.

Stuck + VPN still Connected + `/sorry/` looping: pause (do not reconnect in a tight loop). Wait the worker VPN pause (~60–180s), then one session refresh.

## Refresh sessions / Chrome for Testing

Do **not** kill Chrome while a captcha is on screen.

Refresh when:

- Supervisor: no new products for 10 min (`STALL_MS`) — it already restarts the worker and wipes `/tmp/google-shopping-pp-profile-*`.
- Hard errors: `Target closed`, `Session closed`, `Protocol error`, launch failures (UKM db locked, Mach rendezvous).
- VPN reconnect just succeeded.
- Warmup/`/sorry/` block on VPN: worker wipes profile (`reason=vpn-block`) then pauses. Let that finish; do not start a second `puppeteer_worker.js`.

How to refresh by hand if the supervisor did not:

1. Confirm no live captcha (`visible.png` is not a grid waiting for you).
2. Stop only this spider’s worker+server (not unrelated Chrome).
3. `rm -rf /tmp/google-shopping-pp-profile-1` (locks / restore bubble).
4. Let `run.js` respawn, or restart `npm start` with the same env. Queue lives in `data/products/*.json` — restart **resumes**.

Never two workers on the same profile. Never `kill -STOP` a worker and then `SIGKILL` a paused duplicate (supervisor then dies: `worker keeps exiting`).

## Pauses (anti-block)

Google blocks if we go too fast or use many tabs.

- One tab only.
- `DELAY_MS=5000` → worker already waits `DELAY_MS + random(DELAY_MS)` after each saved product (~5–10s).
- After a solved captcha: extra **15–30s** idle before the next `/get` if the worker does not already pause (`waitVpnPause` on block is 60–180s — do not override it shorter).
- After every **10** saved products: extra **30–60s** pause (stop taking new tasks; do not close Chrome).
- On `/sorry/` or `blocked (VPN IP)`: do **not** refresh Chrome every few seconds. Let the pause elapse, check VPN Connected, then one refresh max.
- Never click captcha tiles from a screenshot loop; that shakes the window and looks automated.

## Preflight (only when the user says run)

1. No other `puppeteer_worker.js` / `run.js` / queue on **5057**. Parser Shell must not also Start the same spider.
2. `cd google-shopping && npm run seed` for the **50**-card fixture (`urls.json`). Sample (`seed-sample`, 5 cards) is not a full run.
3. Move leftover `data/products/*.json` aside, or supervisor refuses: “already marked complete”.
4. Clear `/tmp/google-shopping-captcha/solution.json` if stale.
5. VPN window visible, **Connected**, US if `STRICT_US=1`.
6. Start headed (not Parser Shell for this babysit — shell hides logs and defaults to 10×2):

```bash
cd "<spider-root>"
npm run seed
rm -rf data/products /tmp/google-shopping-captcha /tmp/google-shopping-pp-profile-1
mkdir -p data/products /tmp/google-shopping-captcha
STRICT_US=1 USE_PROXY=0 HEADLESS=0 HIDE_CHROME=0 \
  WINDOWS=1 THREADS=1 DELAY_MS=5000 \
  CAPTCHA_WAIT_MS=300000 COMPLETE_STABLE_POLLS=3 \
  npm start
```

If the user starts from Parser Shell instead: set **1 tab × 1 window**, Network=VPN, then you still watch dumps + desktop.

## Watch loop

Arm a local file watcher on `/tmp/google-shopping-captcha/{visible.png,current.json,prompt.txt}` plus a heartbeat every ~20s while a grid is up, ~45s while scraping, ~90s while VPN-paused. On each wake: screen + VPN + status + logs. Solve captcha immediately when `current.json` is new.

Stop when `run.js` exits 0 and `google-shopping.csv` is written, or the user says stop.

## Success

- Queue `progress == total` (50), exit 0.
- `google-shopping.csv` + `google-shopping.jsonl`.
- Statuses `ok` / `looked_empty` / `fetch_failed` / `no_candidates` — do not treat leftover files as a new scrape.

## Additional resources

- Lessons from the live run: [lessons.md](lessons.md)
