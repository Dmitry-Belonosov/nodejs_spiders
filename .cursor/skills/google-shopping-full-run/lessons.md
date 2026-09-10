# Lessons from the live Google Shopping run

Facts from the headed sample crawl (5 cards). Apply these on a 50-card full run.

## What worked

- **VPN, not ProxyRack.** `USE_PROXY=1` hung on `ERR_TIMED_OUT` / `ERR_EMPTY_RESPONSE`. Headed `USE_PROXY=0` loaded Google.
- **Iframe checkbox click**, not mouse coordinates. OS clicks miss when the window moves.
- **One screenshot per wait**, then `solution.json`. User solved motorcycles; page became Shopping + cookie dialog.
- **Tile selector** must be only `#rc-imageselect-target td.rc-imageselect-tile`. Comma selector counted 16 tiles as 32; indices like 20,22,23 missed.
- **Dump dir** `/tmp/google-shopping-captcha/visible.png` is more reliable than desktop capture. AppleScript can say the window is at 80,80 while `screencapture` shows wallpaper.

## What broke the crawl

- Screenshot + `setWindowBounds` every ~1.5s **shook** Chrome; captcha clicks missed.
- Stall-refresh and VPN-block **profile wipe** killed the window while a human was solving. Do not refresh during an open grid.
- `kill -STOP` on the worker so it would not steal clicks, then `SIGKILL` of a paused duplicate → supervisor `FAILED: worker keeps exiting; giving up after 5 restart(s)`. Chrome launch then failed (UKM db locked, Mach rendezvous).
- Replaying **old** tile indices (motorcycles) on a **new** prompt (fire hydrants) → try again → expired → Chrome reset.
- `STRICT_US=1` on a **GB London** VPN falls back to ProxyRack (timeouts) or mismatches US fixture ids/prices.
- Two `puppeteer_worker.js` on one profile.
- Export only runs on **clean finish**. A dead sample run left 4/5 products and no new CSV; old `google-shopping.csv` was from a previous completed crawl.

## Captcha prompts seen

Stairs, bicycles, motorcycles, fire hydrants, crosswalks, buses. Always read `prompt.txt` for **this** round.

## Sample outcome (not a full run)

Expected 5. Extracted 4 into `data/products/0.json`–`3.json`. Last Munro `CP300B` still pending. Worker died exit 1. Munro cards often `blocked` / `fetch_failed` from `/sorry/`.

Dense cards that did scrape: Little Giant Smoker Fuel (6 offers), Orbit Slip-Lok (`VERIFIED_MPN`, 6), Orbit Cyclone II (6).

## Parser Shell vs this babysit

Parser Shell runs `USE_PROXY=… THREADS=… WINDOWS=… SKIP_SFTP=1 FORCE_RUN=1 npm start`. Default **10 tabs × 2 windows** overrides `.env`. It does not set `HIDE_CHROME` / `STRICT_US` / `DELAY_MS`. For a watched captcha run, start `npm start` from Terminal with the env in the skill, or force the Shell card to 1×1 and still watch dumps.
