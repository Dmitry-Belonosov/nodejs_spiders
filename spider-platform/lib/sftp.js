/**
 * SFTP delivery of finished exports.
 *
 * Per-spider settings win; anything omitted falls back to the platform .env,
 * so a spider usually only needs to declare its remote directory.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');

function resolveConfig(spider) {
  const s = (spider && spider.sftp) || {};
  const env = process.env;
  const host = s.host || env.SFTP_HOST;
  const username = s.user || env.SFTP_USERNAME || env.SFTP_USER;
  const password = s.pass || env.SFTP_PASSWORD || env.SFTP_PASS;
  const privateKeyPath = s.privateKeyPath || env.SFTP_PRIVATE_KEY;
  const port = parseInt(s.port || env.SFTP_PORT || '2222', 10);
  const remoteDir = (
    s.remoteDir ||
    env.SFTP_REMOTE_PATH ||
    env.SFTP_REMOTE_DIR ||
    ''
  ).replace(/\\/g, '/');

  if (!host || !username) {
    throw new Error('SFTP host/user are not configured (set them on the spider or in .env)');
  }
  if (!password && !privateKeyPath) {
    throw new Error('SFTP needs either a password or a private key');
  }
  if (!remoteDir) {
    throw new Error('SFTP remote directory is not configured');
  }

  const cfg = { host, port, username, readyTimeout: 30000 };
  if (privateKeyPath) cfg.privateKey = fs.readFileSync(privateKeyPath);
  if (password) cfg.password = password;

  return { cfg, remoteDir };
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
            sftp.mkdir(cur, () => resolve()); // already-exists is not an error here
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

/**
 * @param {Array<{path:string,name:string,remoteName?:string}>} files
 *        `remoteName` is the timestamped name a run delivers under; without it
 *        the local basename is used and repeated runs would overwrite.
 * @param {object} spider
 * @param {function(string):void} [onProgress]
 * @returns {Promise<Array<{local:string,remote:string}>>}
 */
function uploadFiles(files, spider, onProgress = () => {}) {
  const { cfg, remoteDir } = resolveConfig(spider);

  return new Promise((resolve, reject) => {
    const conn = new Client();
    let settled = false;
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      try {
        conn.end();
      } catch (e) {
        /* connection already gone */
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

function testConnection(spider) {
  const { cfg, remoteDir } = resolveConfig(spider);
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

module.exports = { uploadFiles, testConnection, resolveConfig };
