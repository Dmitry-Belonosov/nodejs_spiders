/**
 * Upload export files to CompetitorMonitor SFTP when crawl finishes.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('ssh2');
const { progressLine, logLine } = require('./logger');

function sftpConfig() {
  const host = process.env.SFTP_HOST;
  const user = process.env.SFTP_USER;
  const pass = process.env.SFTP_PASS;
  if (!host || !user || !pass) {
    throw new Error('SFTP_HOST, SFTP_USER, SFTP_PASS must be set in .env');
  }
  return {
    host,
    port: parseInt(process.env.SFTP_PORT || '2222', 10),
    username: user,
    password: pass,
  };
}

function remotePath(filename) {
  const dir = (process.env.SFTP_REMOTE_DIR || 'Kitbag/Everton').replace(/\\/g, '/');
  const base = dir.replace(/\/$/, '');
  return `${base}/${filename}`;
}

function putFile(sftp, localPath, remote) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(localPath, remote, {}, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function ensureRemoteDir(sftp, remoteDir) {
  const parts = remoteDir.split('/').filter(Boolean);
  let cur = '';
  return parts.reduce((chain, part) => {
    return chain.then(
      () =>
        new Promise((resolve) => {
          cur = cur ? `${cur}/${part}` : part;
          sftp.mkdir(cur, (err) => {
            // ignore exists
            resolve();
          });
        })
    );
  }, Promise.resolve());
}

function uploadFiles(files) {
  const cfg = sftpConfig();
  const remoteDir = (process.env.SFTP_REMOTE_DIR || 'Kitbag/Everton').replace(/\\/g, '/');

  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on('ready', () => {
        conn.sftp(async (err, sftp) => {
          if (err) {
            conn.end();
            return reject(err);
          }
          try {
            await ensureRemoteDir(sftp, remoteDir);
            const uploaded = [];
            for (const localPath of files) {
              if (!fs.existsSync(localPath)) {
                logLine('sftp', `skip missing ${localPath}`);
                continue;
              }
              const name = path.basename(localPath);
              const remote = remotePath(name);
              await putFile(sftp, localPath, remote);
              uploaded.push({ local: localPath, remote });
              progressLine(`SFTP uploaded ${name} -> ${remote}`);
            }
            conn.end();
            resolve(uploaded);
          } catch (e) {
            conn.end();
            reject(e);
          }
        });
      })
      .on('error', reject)
      .connect(cfg);
  });
}

module.exports = { uploadFiles, remotePath };
