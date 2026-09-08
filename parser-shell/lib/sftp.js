/**
 * SFTP delivery of finished CSVs — same destination as spider-platform.
 *
 * Files land in /external_data/Dmitry as {parser}_{YYYY-MM-DD_HH-mm-ss}.csv
 * so repeated runs never overwrite one another.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

function resolveConfig() {
  const env = process.env;
  const host = env.SFTP_HOST;
  const username = env.SFTP_USERNAME || env.SFTP_USER;
  const password = env.SFTP_PASSWORD || env.SFTP_PASS;
  const port = parseInt(env.SFTP_PORT || '2222', 10);
  const remoteDir = (env.SFTP_REMOTE_PATH || env.SFTP_REMOTE_DIR || '').replace(/\\/g, '/');

  if (!host || !username) {
    throw new Error('SFTP host/user are not configured — set them in parser-shell/.env');
  }
  if (!password) {
    throw new Error('SFTP password is not configured — set SFTP_PASSWORD in parser-shell/.env');
  }
  if (!remoteDir) {
    throw new Error('SFTP remote directory is not configured');
  }

  return {
    cfg: { host, port, username, password, readyTimeout: 30000 },
    remoteDir,
  };
}

function ensureRemoteDir(sftp, remoteDir) {
  const parts = remoteDir.split('/').filter(Boolean);
  let cur = remoteDir.startsWith('/') ? '' : null;
  return parts.reduce(
    (chain, part) =>
      chain.then(
        () =>
          new Promise((resolve) => {
            cur = cur === null ? part : `${cur}/${part}`;
            sftp.mkdir(cur, () => resolve());
          })
      ),
    Promise.resolve()
  );
}

function putFile(sftp, localPath, remote) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(localPath, remote, {}, (err) => (err ? reject(err) : resolve()));
  });
}

function timestampName(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => (parts.find((p) => p.type === type) || {}).value || '00';
  return `${get('year')}-${get('month')}-${get('day')}_${get('hour')}-${get('minute')}-${get('second')}`;
}

function remoteFilename(parserSlug, localName, startedAt) {
  const stamp = timestampName(startedAt ? new Date(startedAt) : new Date());
  const ext = path.extname(localName) || '.csv';
  const safe = String(parserSlug || 'parser').replace(/[^A-Za-z0-9._-]+/g, '-');
  return `${safe}_${stamp}${ext}`;
}

function uploadFiles(files, onProgress = () => {}) {
  const { cfg, remoteDir } = resolveConfig();

  return new Promise((resolve, reject) => {
    const conn = new Client();
    let settled = false;
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      try {
        conn.end();
      } catch (e) {
        /* already gone */
      }
      fn(arg);
    };

    conn
      .on('ready', () => {
        conn.sftp(async (err, sftp) => {
          if (err) return finish(reject, err);
          try {
            await ensureRemoteDir(sftp, remoteDir);
            const uploaded = [];
            for (const file of files) {
              if (!fs.existsSync(file.path)) {
                onProgress(`skip missing ${file.path}`);
                continue;
              }
              const name = file.remoteName || file.name || path.basename(file.path);
              const remote = `${remoteDir.replace(/\/$/, '')}/${name}`;
              await putFile(sftp, file.path, remote);
              uploaded.push({ local: file.path, remote });
              onProgress(`uploaded ${name} -> ${remote}`);
            }
            finish(resolve, uploaded);
          } catch (e) {
            finish(reject, e);
          }
        });
      })
      .on('error', (e) => finish(reject, e))
      .connect(cfg);
  });
}

function testConnection() {
  const { cfg, remoteDir } = resolveConfig();
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on('ready', () => {
        conn.sftp((err, sftp) => {
          if (err) {
            conn.end();
            return reject(err);
          }
          sftp.readdir(remoteDir, (dirErr, list) => {
            conn.end();
            if (dirErr) {
              return reject(new Error(`connected, but cannot read ${remoteDir}: ${dirErr.message}`));
            }
            resolve({ remoteDir, entries: list.length });
          });
        });
      })
      .on('error', reject)
      .connect(cfg);
  });
}

module.exports = { uploadFiles, testConnection, resolveConfig, remoteFilename };
