# Moving the platform to the server

The platform is self-contained: one directory, one user, one port.

**Dedicated Mac:** follow [MAC.md](MAC.md) instead of this file. Chrome for
Testing, launchd, two windows of ten tabs.

**Linux server:** keep reading. The existing Python 2.7 spider system stays
untouched — nothing here writes outside `/opt/spider-platform`, and the default
port (8080) and the spider port range (5100–5199) were chosen to stay clear of it.

## 1. Check the server first

```bash
ssh user@server
cat /etc/os-release          # distribution and version
node -v 2>/dev/null          # is Node already installed?
free -h && df -h /           # RAM and free disk
ss -lntp | sort -k4          # which ports are already taken
```

Confirm that 8080 and 5100–5199 are free, and note where the Python system
lives so we stay away from it. Chrome needs roughly 1 GB of RAM per concurrent
Puppeteer spider.

## 2. Copy and install

From this folder on your machine:

```bash
rsync -av --exclude node_modules --exclude data \
  ./spider-platform/ user@server:/tmp/spider-platform/

ssh user@server
sudo bash /tmp/spider-platform/deploy/install.sh
```

The script installs Node.js 20 and Chrome if they are missing, creates the
`spiders` user, installs dependencies into `/opt/spider-platform`, and registers
the systemd service. It never removes anything that is already there.

## 3. Configure

```bash
sudo -e /opt/spider-platform/.env
```

At minimum:

```
ADMIN_PASSWORD=<a long password>
SESSION_SECRET=<openssl rand -hex 32>
PROXY_USER=competitormonitor-country-GB
PROXY_PASS=<proxy password>
SFTP_HOST=sftp.competitormonitor.com
SFTP_PORT=2222
SFTP_USERNAME=external_data
SFTP_PASSWORD=<sftp password>
SFTP_REMOTE_PATH=/external_data/Dmitry
```

Credentials belong here and nowhere else — never in spider code and never in
anything committed to git. `.env` is listed in `.gitignore`.

Then start it:

```bash
sudo systemctl start spider-platform
journalctl -u spider-platform -f
```

## 4. Publish the UI

Copy `deploy/nginx.conf.example` to `/etc/nginx/sites-available/spider-platform`,
set `server_name`, obtain a certificate with certbot, and enable the site. After
that set `BEHIND_PROXY=1` and `COOKIE_SECURE=1` in `.env` and restart the
service.

If the UI does not need to be public, skip nginx and reach it through an SSH
tunnel instead:

```bash
ssh -L 8080:127.0.0.1:8080 user@server
# then open http://127.0.0.1:8080
```

## 5. Move the spiders over

Two options per spider:

- **Upload a ZIP through the UI** — zip the project folder without
  `node_modules`; dependencies are installed on the server.
- **Copy the folder and link it** — `rsync` it to the server, then register it:

```bash
sudo -u spiders node /opt/spider-platform/scripts/import_spider.js \
  /opt/spiders/everton-server --name Everton \
  --time 03:00 --repeat daily --remote-dir Kitbag/Everton
```

For each spider, verify in this order:

1. **Run now** with SFTP disabled, and watch the live log.
2. Check that the CSV appears under the run's files and the row count is right.
3. Enable SFTP, use **Test connection**, then **Retry SFTP upload** on the
   finished run.
4. Only then enable the schedule.

## 6. Checks before leaving it unattended

```bash
sudo systemctl restart spider-platform   # survives a restart
sudo reboot                              # comes back automatically
```

- A scheduled run fires at the expected local time (`timedatectl` for the server clock).
- The CSV lands in the right SFTP directory.
- `df -h` after a few full runs; adjust `RETENTION_DAYS` if the archive grows faster than expected.

## Rollback

The platform is one directory and one service:

```bash
sudo systemctl stop spider-platform && sudo systemctl disable spider-platform
```

Nothing else on the server changes. `/opt/spider-platform/data` holds every run
log and exported file, so it is the only thing worth backing up.
