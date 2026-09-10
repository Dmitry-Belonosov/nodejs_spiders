# Move this spider to another Mac (same OS)

Prefer **git**. This folder is `google-shopping/` inside `nodejs_spiders`. `.env` is gitignored — copy it by hand.

Repo: `https://github.com/Dmitry-Belonosov/nodejs_spiders.git`

## 1. On this Mac — save to git

Commit the spider + Cursor skill/rule, then:

```bash
git push origin main
```

Do not commit `.env`, `data/`, `node_modules/`, or transfer zips.

## 2. On the other Mac — clone or pull

First time:

```bash
git clone https://github.com/Dmitry-Belonosov/nodejs_spiders.git
cd nodejs_spiders/google-shopping
```

If the folder is already there:

```bash
cd nodejs_spiders
git pull
cd google-shopping
```

Then install once (Node 20+, Chrome for Testing 132 — not Google Chrome.app):

```bash
node -v   # v20 or newer
npx @puppeteer/browsers install chrome@132.0.6834.83 --path ~/chrome-for-testing
cp .env.example .env
# paste PROXY_PASS into .env, or AirDrop the existing .env (never commit it)
npm install
npm test
```

Expected Chrome binary (Apple Silicon):

`~/chrome-for-testing/chrome/mac_arm-132.0.6834.83/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`

Intel Mac uses `mac-132.0.6834.83/chrome-mac-x64/...`. Or set `CHROME` to that path.

## 3. Cursor on the other Mac

1. Open **`nodejs_spiders`** or **`google-shopping`** in Cursor. Skills/rules are in both `.cursor/` (repo root) and `google-shopping/.cursor/`.
2. Grant Cursor **Screen Recording** and **Accessibility** so it can see the VPN window and Chrome for Testing.
3. Tell Cursor: follow the skill `google-shopping-full-run`. Do not start until you say run.

Cursor **user** rules (English replies, git habits) follow your Cursor account, not this git repo.

## 4. VPN

Install the same VPN app. Leave its window on screen. Connect a **US** city before a trusted full run (`STRICT_US=1`). London/GB is a different Google Shopping dataset.

## 5. First smoke (optional, 5 cards)

```bash
npm run seed-sample
rm -rf data/products /tmp/google-shopping-captcha /tmp/google-shopping-pp-profile-1
mkdir -p data/products /tmp/google-shopping-captcha
STRICT_US=1 USE_PROXY=0 HEADLESS=0 HIDE_CHROME=0 \
  WINDOWS=1 THREADS=1 DELAY_MS=5000 \
  CAPTCHA_WAIT_MS=300000 COMPLETE_STABLE_POLLS=1 \
  npm start
```

Chrome for Testing must appear on screen. Captcha dumps go to `/tmp/google-shopping-captcha/`.

## 6. Full 50-card run

Ask Cursor to follow `.cursor/skills/google-shopping-full-run/SKILL.md` and start. Or:

```bash
npm run seed
# then the same npm start env as above, COMPLETE_STABLE_POLLS=3
```

## Zip fallback (no git on the other Mac)

```bash
bash scripts/pack_for_other_mac.sh
```

Writes `google-shopping/google-shopping-transfer-YYYYMMDD.zip` with no `.env`. AirDrop the zip plus `.env` separately.

## Do not copy via git or zip

| Skip | Why |
|---|---|
| `.env` | Secrets — copy by hand |
| `node_modules/` | `npm install` on the new Mac |
| `data/` | Old products make the queue look finished |
| `/tmp/google-shopping-pp-profile-*` | Machine locks |
| `/tmp/google-shopping-captcha/` | Stale grids |
| `google-shopping.csv` / `.jsonl` | Previous machine’s export |

## Checklist

- [ ] `git clone` or `git pull` of `nodejs_spiders`
- [ ] Node 20+
- [ ] Chrome for Testing 132 under `~/chrome-for-testing`
- [ ] `.env` present (`USE_PROXY=0`, `HIDE_CHROME=0`, `THREADS=1`, `WINDOWS=1`)
- [ ] `npm install` && `npm test`
- [ ] VPN Connected, US, window visible
- [ ] Cursor opened this repo (skill + rule visible)
- [ ] Screen Recording + Accessibility for Cursor
- [ ] One tab only; do not also start Parser Shell on port 5057
