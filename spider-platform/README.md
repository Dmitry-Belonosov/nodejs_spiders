# Spider Platform

Runs the Node.js spiders from this folder unattended: upload a spider, give it
a schedule, watch its log, and have the exported CSV delivered to SFTP when the
crawl finishes.

Built to run next to the existing Python 2.7 system without touching it — it is
a self-contained folder with its own port and its own data directory.

## What it does

- **Add spiders** through the web UI by choosing the project folder or a ZIP
  (or by pointing at a folder already on disk). `node_modules` is skipped on
  upload and reinstalled here.
- **Schedule** them by picking a repeat rule and a start time: every day, on
  selected weekdays (Mon-Fri, Mon+Thu, weekends), monthly, or once — plus
  "Run now". The timezone is one platform-wide setting, `Europe/London` by
  default, so 03:00 means 03:00 in London whatever the server clock is set to.
- **Run** each spider as a supervised child process with its own queue port,
  timeout, and full stdout/stderr captured to a per-run log.
- **Clean up** afterwards: Puppeteer starts Chrome detached, so the platform
  tracks every descendant process of a run and terminates the browsers a
  cancelled, timed-out or crashed spider leaves behind.
- **Collect** the files a run produced (`*.csv`, `*.jsonl`) into a per-run archive,
  so a later run never overwrites earlier results.
- **Deliver** the CSV to a per-spider SFTP directory after a successful run.
  Each file is uploaded as `{spider}_{YYYY-MM-DD_HH-mm-ss}.csv`, so runs never
  overwrite one another remotely. If the crawl works but the upload does not,
  the run ends as `upload_failed`, the CSV is kept, and one button retries it.

## Requirements

- Node.js 20 or newer (no native modules, no build step, nothing to compile).
- **Chrome for Testing** for Puppeteer spiders (not Google Chrome.app). On a
  dedicated Mac: see [deploy/MAC.md](deploy/MAC.md).
- Outbound access to the target sites, the proxy provider, and the SFTP host.

## Getting started

```bash
cd spider-platform
npm install
cp .env.example .env      # set ADMIN_PASSWORD, proxy and SFTP credentials
npm start
```

Open http://127.0.0.1:8080.

Without `ADMIN_PASSWORD` the platform accepts localhost connections only, which
is fine for local development and never acceptable once it is reachable from
outside.

### Trying it without a real spider

`examples/demo-spider` is a fake spider that prints progress and writes a CSV.
Link it from the UI ("Link folder"), or from the command line:

```bash
node scripts/import_spider.js examples/demo-spider --name "Demo Spider"
```

Then press "Run now" and watch the live log.

## What a spider must look like

A spider is a normal project folder, exactly like `everton-server`:

- `package.json` with a `start` script,
- the script **runs the crawl and exits** when the crawl is finished,
- exit code `0` means success; anything else marks the run as failed.

The spiders in this folder are two processes — a queue server holding the URL
list and a worker draining it — and neither exits on its own. `run.js` is the
supervisor that bridges that gap: it starts both, polls `/status` until the
queue is drained, exports the CSV, and exits. `everton-server`, `everton`,
`autodoc`, `bueromarkt` and `ghedirect` all have one, so `npm start` is enough.

To adapt another spider of the same shape, copy `run.js` from one of them and
change the three constants at the top (name, default port, worker script).

It fails the run rather than reporting a false success when the queue is empty,
when the crawl extracts no products (`MIN_PRODUCTS`, default 1 — a good signal
that the site's layout changed), or when the CSV is missing after export.

Zip the project folder **without `node_modules`** — dependencies are installed
by the platform after upload.

[SPIDER_CONTRACT.md](SPIDER_CONTRACT.md) states the full set of rules a spider
must satisfy, with a checklist to run through before uploading one.

### Run statuses

| Status | Meaning |
|---|---|
| `queued` | waiting for a free slot |
| `running` | the spider process is alive |
| `success` | exited 0, CSV produced, and delivered if SFTP is on |
| `failed` | non-zero exit, crash, or no CSV to deliver |
| `upload_failed` | the crawl and CSV are fine; only SFTP delivery failed |
| `timeout` / `cancelled` | stopped by the timeout, or by hand |

### Environment given to every spider

The runner starts each spider with a **clean environment**, close to
`cd <spider> && npm start`:

- OS basics (`PATH`, `HOME`, locale, Homebrew)
- proxy / API credentials from the platform `.env`
- Chrome for Testing if it is installed
- `PORT`, `SERVER`, `SKIP_SFTP=1`, `FORCE_RUN=1`

It does **not** copy Cursor/`npm_config_*`/`HTTP_PROXY` from the process that
started the platform, and it does **not** force `THREADS`, `WINDOWS`,
`HEADLESS`, `HIDE_CHROME` or `USE_PROXY`. Set those per spider in the UI only
when you want to override the spider's own defaults.

SFTP is centralised on purpose: every spider delivers the same way, and a
failed upload is visible and retryable in one place instead of being buried in
a spider log. New spiders get SFTP switched on when `SFTP_HOST` and
`SFTP_REMOTE_PATH` are set in `.env`.

Useful per-spider variables, set under "Settings for this spider" in the UI:

| Variable | Default | Effect |
|---|---|---|
| `MAX_PRODUCTS` | `0` (no limit) | stop after N products — the quickest way to verify a newly uploaded spider |
| `MIN_PRODUCTS` | `1` | fail the run if the crawl extracted fewer |
| `STATUS_INTERVAL_MS` | `30000` | how often progress is polled and logged |
| `COMPLETE_STABLE_POLLS` | `3` | consecutive drained polls before the crawl counts as finished |
| `WORKER` | per spider | which worker script to run (`axios_worker.js` or `puppeteer_worker.js`) |
| `THREADS`, `USE_PROXY`, … | per spider | passed straight through to the worker |

## Data layout

Everything mutable lives under `data/`, so a backup or a move to the server is
a copy of one directory:

```
data/
  spiders/<slug>/          uploaded spider code
  runs/<runId>/run.log     full stdout/stderr of a run
  artifacts/<slug>/<runId>/ CSV/JSONL produced by that run
  backups/<slug>-<ts>/     previous version after a re-upload
  store/                   spiders.json, runs.json, settings.json
  logs/platform.log        platform's own log
```

When a spider is re-uploaded, `.env`, `urls.json` and `data/` are carried over
from the previous version so crawl checkpoints and credentials survive.

## Configuration

Platform-wide values live in `.env` (see `.env.example`): bind address and port,
admin password, upload limits, the spider port range, and the default proxy and
SFTP credentials.

Per-spider values are edited in the UI: name, schedule, the SFTP destination
folder, and any environment variables that spider needs. Start command, timeout
and output patterns are detected automatically and sit under "Advanced".

## Security

Uploading a spider means uploading code that the server will execute. Treat the
UI as an administrative tool:

- always set `ADMIN_PASSWORD` before exposing it,
- put it behind nginx with TLS (`BEHIND_PROXY=1`, `COOKIE_SECURE=1`), and
  restrict it by VPN or IP allowlist where possible,
- keep credentials in `.env` or the spider settings, never inside spider code.

## API

The UI is a thin client over a REST API, so runs can also be triggered from
scripts or another scheduler:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/state` | spiders, settings, active runs |
| `POST` | `/api/spiders` | upload a spider (multipart `archive`) |
| `POST` | `/api/spiders/link` | register an existing folder |
| `POST` | `/api/validate-schedule` | check a date/time schedule and get its next run |
| `PATCH` | `/api/spiders/:id` | update configuration |
| `POST` | `/api/spiders/:id/run` | trigger a run |
| `POST` | `/api/spiders/:id/test-sftp` | verify SFTP settings |
| `GET` | `/api/runs` | run history |
| `GET` | `/api/runs/:id/log` | run log |
| `GET` | `/api/runs/:id/stream` | live log (server-sent events) |
| `POST` | `/api/runs/:id/cancel` | stop a run |
| `POST` | `/api/runs/:id/reupload` | retry SFTP delivery |
