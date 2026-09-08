/**
 * Credentials for the John Lewis scrapers.
 *
 * These used to be written into every john_*.js in plain text. They now come
 * from the environment: the spider platform passes its own .env through to
 * every spider it starts, and for a standalone run a `.env` file next to this
 * one is read as well.
 *
 * Copy .env.example to .env and fill it in. .env must never be committed.
 */
const fs = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');

/** Minimal KEY=VALUE reader — avoids adding a dotenv dependency. */
function loadEnvFile(file = path.join(__dirname, '.env')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    // Existing environment wins, so the platform can override the file.
    if (process.env[key] !== undefined) continue;
    process.env[key] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
}

loadEnvFile();

function required(name, hint) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — put it in Portmerion/.env${hint ? ` (${hint})` : ''}`);
  }
  return value;
}

/** Connection settings for ssh2's Client.connect(). */
function sftpSettings() {
  return {
    host: process.env.SFTP_HOST || 'sftp.competitormonitor.com',
    port: parseInt(process.env.SFTP_PORT || '2222', 10),
    username: process.env.SFTP_USERNAME || process.env.SFTP_USER || 'external_data',
    password: required('SFTP_PASSWORD', 'the CompetitorMonitor SFTP password'),
  };
}

/**
 * One proxy agent per port, matching the original behaviour: ProxyRack hands
 * out a different residential IP per port in the range.
 */
function proxyAgents(count = parseInt(process.env.PROXY_COUNT || '200', 10)) {
  const user = process.env.PROXY_USER || 'competitormonitor-country-in';
  const pass = required('PROXY_PASS', 'the ProxyRack password');
  const host = process.env.PROXY_HOST || 'private.residential.proxyrack.net';
  const agents = [];
  for (let i = 0; i < count; i += 1) {
    agents.push(new HttpsProxyAgent(`http://${user}:${pass}@${host}:${10000 + i}`));
  }
  return agents;
}

function apiKey() {
  return required('JOHNLEWIS_API_KEY', 'the x-api-key sent with John Lewis requests');
}

module.exports = { sftpSettings, proxyAgents, apiKey, loadEnvFile };
