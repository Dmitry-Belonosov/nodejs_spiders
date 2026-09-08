# What a spider must do to work on this platform

Rules a spider project has to satisfy so that it uploads cleanly, runs to
completion, and delivers its CSV. Each rule says what the platform actually
does, so it is clear what breaks when the rule is ignored.

`everton-server` is the reference implementation; `everton`, `autodoc`,
`bueromarkt` and `ghedirect` follow the same shape.

---

## 1. Packaging

**1.1 — Ship a normal project folder, zipped.**
A single wrapping directory (`zip -r spider.zip spider/`) is detected and peeled
off automatically, so both `spider.zip` containing `spider/package.json` and one
containing `package.json` at the root work. Uploading the folder directly from
the browser works too.

**1.2 — Do not ship `node_modules`.**
The platform runs `npm install --omit=dev` in the spider folder after upload.
`node_modules` is stripped from the archive during extraction anyway, so
including it only makes the upload slow.

**1.3 — Never keep files you need inside these directories.**
They are dropped on upload and will not exist at runtime:

`node_modules`, `.git`, `__MACOSX`, `.DS_Store`, `data`, `logs`, `archive`,
`.cache`, `chrome_profile`, `dist`, `coverage`, and any `*.log` file.

This is the most common upload surprise: a spider that reads its seed list from
`data/urls.json` will find nothing after upload. Keep inputs at the project
root, and create runtime directories from code at startup.

**1.4 — Declare runtime dependencies under `dependencies`.**
`devDependencies` are not installed. `package.json` must be valid JSON or the
upload is rejected.

**1.5 — Use `puppeteer-core`, not `puppeteer`.**
Full `puppeteer` downloads its own Chromium on install. The platform supplies a
browser path in `CHROME` instead. Uploading a spider that depends on `puppeteer`
raises a warning.

**1.6 — No absolute paths or `..` inside the archive.**
Such entries are refused outright as a path-traversal attempt.

**1.7 — Re-uploads preserve local state.**
`.env`, `urls.json` and `data/` are carried over from the previous version if
the new upload does not contain them, so updating code does not wipe a seed list
or a checkpoint.

## 2. Entry point

**2.1 — Provide `scripts.start` in `package.json`.**
It is detected as `npm start`. Without it the platform falls back to `run.js`,
then `index.js`, and if neither exists the start command must be typed by hand
in the UI.

**2.2 — The start command runs with the spider folder as the working directory.**
Resolve paths relative to the project, never relative to where the platform is
installed.

## 3. Execution

**3.1 — The process must exit by itself when the crawl is done.**
This is the single most important rule. The platform waits for process exit and
only then collects output files. A spider that keeps running (a bare queue
server, a `setInterval` that never clears, an open HTTP listener) will hang until
the timeout and be recorded as `timeout` with nothing delivered.

The spiders here are two processes — a queue server holding the URL list, and a
worker draining it — and neither exits on its own. `run.js` is the supervisor
that bridges the gap: it starts both, polls `/status` until the queue is
drained, runs the export, and exits. Copy it and change the three constants at
the top for a new spider of the same shape.

**3.2 — Exit code 0 means success; anything else fails the run.**
There is no other success signal. Log output is not inspected.

**3.3 — Fail loudly rather than exiting 0 with nothing.**
A crawl that extracted zero products because the site changed its markup must
exit non-zero. Silent success is worse than a visible failure, because the
schedule keeps running and nobody notices for weeks. `run.js` already fails on
an empty queue, on fewer than `MIN_PRODUCTS` products, and on a missing CSV
after export.

**3.4 — Take the queue port from `PORT`, and the worker's target from `SERVER`.**
Each run is allocated a port from 5100–5199 so two spiders can run at once. A
hardcoded port collides as soon as the second spider starts.

**3.5 — Honour the injected environment.**
The platform sets these on every run, and a spider must not fight them:

| Variable | Value | Meaning |
|---|---|---|
| `EXIT_ON_COMPLETE` | `1` | terminate when finished |
| `SKIP_SFTP` | `1` | the platform delivers the files, the spider must not |
| `FORCE_RUN` | `1` | ignore any previous "already uploaded" marker |
| `PORT` / `SERVER` | allocated per run | queue server address |
| `CHROME` | Chrome for Testing path, if found | same binary `npm start` would pick |
| `LOG_TO_CONSOLE` | `1` | write logs to stdout, not only to a file |

`THREADS`, `WINDOWS`, `HEADLESS`, `HIDE_CHROME` and `USE_PROXY` are **not**
forced. They stay at the spider's own defaults, matching `cd spider && npm start`,
unless set for that spider in the UI.

**3.6 — Do not use these names for your own variables.**
`PORT`, `SERVER`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `ENV_FILE`, `DATA_DIR`,
`SPIDERS_DIR`, `MAX_RUNS_KEPT`, `SPIDER_PORT_START`, `SPIDER_PORT_END`. The
first two are overwritten per run; the rest are platform-only and never passed
to the spider.

**3.7 — Shut down on `SIGTERM` within 15 seconds.**
Cancelling a run, hitting the timeout, or stopping the platform sends `SIGTERM`
to the whole process group. After 15 seconds `SIGKILL` follows and any work in
progress is lost.

**3.8 — Close every browser you open.**
Puppeteer starts Chrome detached, in its own process group, so it survives the
death of its parent. The platform tracks and sweeps leftover descendants as a
safety net, but a spider that leaks Chrome instances will eventually exhaust the
machine's memory between sweeps.

**3.9 — Finish inside the timeout.**
Default 240 minutes, configurable per spider in the UI. Exceeding it is recorded
as `timeout`, not `failed`.

**3.10 — Write progress to stdout/stderr.**
Both streams are captured into the per-run log and streamed live to the UI. This
is the only diagnostic available after the fact, so log enough to tell a blocked
crawl from a slow one.

**3.11 — Never print credentials.**
Run logs are stored on disk and readable from the UI.

**3.12 — One run per spider at a time.**
The platform refuses to start a second run and skips a scheduled run while one
is active. Do not add your own global lock file on top; it will only survive a
crash and block subsequent runs.

## 4. Output

**4.1 — Write output files into the spider's own folder.**
Collection walks the spider directory to a depth of 3. Anything written outside
it, or deeper, is invisible to the platform.

**4.2 — Do not write output into a skipped directory.**
`node_modules`, `.git`, `data`, `logs`, `extension`, `.cache` are not searched.
The project root or `archive/` are both fine.

**4.3 — Match the output patterns.**
Default `*.csv` and `*.jsonl`, overridable per spider.

**4.4 — Rewrite the output file on every run.**
Only files modified since the run started (with five minutes of tolerance) are
collected. A CSV left over from yesterday is deliberately ignored, so a spider
that skips the export step delivers nothing rather than re-delivering stale
data.

**4.5 — A fixed output filename is correct.**
Export to `everton.csv` every time. The platform stamps the run's start time on
upload, delivering `everton_2026-08-28_14-30-05.csv`, so deliveries never
overwrite each other on the SFTP server. Timestamping the local file yourself
only makes the file harder to find.

**4.6 — Produce at least one CSV when SFTP is enabled.**
A run that exits 0 but matches no upload pattern is marked `failed`, because
delivery is the point of a scheduled crawl.

**4.7 — Do not implement SFTP in the spider.**
The platform owns delivery so that every spider delivers identically and
failures surface in one place. A delivery failure gets its own `upload_failed`
status, keeps the CSV locally, and can be retried from the UI without re-running
the crawl.

## 5. Configuration and secrets

**5.1 — Read all credentials from the environment.**
The platform's `.env` is passed through to every spider process. Nothing
sensitive belongs in the code.

**5.2 — Fail immediately when a required secret is missing.**
Print which variable is missing and exit non-zero. A crawl that silently runs
without its proxy just collects blocked pages and looks like a site change.

**5.3 — Per-spider overrides belong in the UI.**
Variables set on the spider take precedence over the platform defaults, which is
the right place for `PROXY_USER`, `THREADS` or a worker choice — not a committed
config file.

---

## Checklist before uploading

- [ ] `npm start` runs the crawl and exits on its own
- [ ] exit code is 0 only when a CSV was actually produced
- [ ] zero results, an empty queue, or a missing export exit non-zero
- [ ] the queue port comes from `PORT`
- [ ] the CSV lands in the project root and is rewritten every run
- [ ] no SFTP code, no hardcoded credentials
- [ ] `SIGTERM` closes the browser and exits
- [ ] dependencies are in `dependencies`, using `puppeteer-core`
- [ ] nothing needed at runtime lives in `data/`, `logs/`, `archive/` or `dist/`
- [ ] the archive has no `node_modules`

## Verifying a new spider

Set `MAX_PRODUCTS` to something small (20) on the spider in the UI and trigger a
manual run. It exercises the whole path — start, crawl, export, collection,
SFTP delivery — in a couple of minutes instead of hours. Clear it once the run
comes back `success` and the file has arrived.
