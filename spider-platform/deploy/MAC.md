# Running the platform on a dedicated Mac

This is the intended production layout: one Mac, Chrome for Testing, two
browser windows of ten tabs, CSV delivered to SFTP when a run finishes.

Linux `systemd` install (`deploy/install.sh`) is the other option. Use this
file for the Mac.

## 1. Install Node and Chrome for Testing

Node 20 or newer:

```bash
brew install node@20
node -v
```

Chrome for Testing 132 (not Google Chrome.app — captcha solving was proven
on this binary):

```bash
npx @puppeteer/browsers install chrome@132.0.6834.83 --path ~/chrome-for-testing
```

The platform looks for the binary under `~/chrome-for-testing` and
`/tmp/chrome-for-testing`. Set `CHROME=` in `.env` only if it lives somewhere
else.

## 2. Copy the project and install

```bash
cd /Users/shared/spider-platform   # or wherever you keep it
npm install --omit=dev
cp .env.example .env
```

Fill in at least:

```
ADMIN_PASSWORD=<long password>          # if the UI will be reached from another machine
SESSION_SECRET=<openssl rand -hex 32>
PROXY_PASS=<ProxyRack password>
SFTP_PASSWORD=<CompetitorMonitor password>
SFTP_REMOTE_PATH=/external_data/Dmitry
HOST=0.0.0.0                            # so the UI is reachable on the LAN
```

Leave `HEADLESS`, `WINDOWS` and `THREADS` unset — the runner injects
`HEADLESS=0`, `WINDOWS=2`, `THREADS=10`, `HIDE_CHROME=1`.

## 3. Keep it running with launchd

Copy `deploy/com.spider-platform.plist` to
`~/Library/LaunchAgents/com.spider-platform.plist`, edit the two paths
(`WorkingDirectory` and the `node` binary), then:

```bash
launchctl load ~/Library/LaunchAgents/com.spider-platform.plist
launchctl start com.spider-platform
```

Logs go to `data/platform.log` if you redirect there, or to Console.app.
To stop:

```bash
launchctl unload ~/Library/LaunchAgents/com.spider-platform.plist
```

## 4. What a run looks like

Each spider's `npm start` supervisor launches:

1. the queue server
2. **two** Chrome for Testing processes (separate profiles, so two Dock icons)
3. **ten tabs** in each window

If a page is an hCaptcha challenge, the solver that already worked on
bueromarkt runs against that tab. Headless Chrome cannot click that challenge,
which is why the Mac runs headed with the windows parked off-screen.

When the crawl exits 0, the platform collects `*.csv` and uploads it to
`SFTP_REMOTE_PATH` as `{spider}_{YYYY-MM-DD_HH-mm-ss}.csv`. A delivery failure
is `upload_failed` and can be retried from the UI without re-crawling.

## 5. First check

Open `http://<mac-lan-ip>:8080`, pick a spider, set `MAX_PRODUCTS=20` in its
environment, and trigger a manual run. You should see two Chrome for Testing
windows, a CSV in the run artifacts, and the same file on the SFTP server.
