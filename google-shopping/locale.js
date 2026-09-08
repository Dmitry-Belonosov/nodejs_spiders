/**
 * Confirm the network exit is the United States. Google Shopping ids are
 * locale-specific; a UK/DE/RU exit is a different dataset.
 *
 * Node HTTP through ProxyRack often hangs, so when USE_PROXY=1 we trust
 * `competitormonitor-country-us` and confirm the country inside Chrome.
 */
const axios = require('axios');

function countryFromPayload(data) {
  if (!data || typeof data !== 'object') return '';
  return String(data.country || data.countryCode || data.country_code || '')
    .trim()
    .toUpperCase();
}

function axiosProxy(opts) {
  if (!opts || !opts.host) return undefined;
  const proxy = {
    protocol: 'http',
    host: opts.host,
    port: parseInt(opts.port, 10) || 10000,
  };
  if (opts.user) {
    proxy.auth = { username: opts.user, password: opts.pass || '' };
  }
  return proxy;
}

async function fetchJson(url, opts = {}) {
  const res = await axios.get(url, {
    timeout: opts.timeout || 8000,
    proxy: axiosProxy(opts.proxy),
    headers: { 'User-Agent': 'google-shopping-locale-check' },
    validateStatus: () => true,
  });
  if (res.status >= 400) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.data;
}

async function detectCountry(opts = {}) {
  const errors = [];
  for (const url of ['https://ipinfo.io/json', 'https://ipapi.co/json']) {
    try {
      const data = await fetchJson(url, { proxy: opts.proxy, timeout: opts.timeout });
      const country = countryFromPayload(data);
      if (country) {
        return {
          country,
          ip: data.ip || data.query || '',
          city: data.city || '',
          org: data.org || data.org_name || '',
          source: url,
        };
      }
    } catch (e) {
      errors.push(`${url}: ${e.message}`);
    }
  }
  throw new Error(`could not detect exit country (${errors.join('; ')})`);
}

function isUnitedStates(country) {
  return String(country || '').toUpperCase() === 'US';
}

function envFlag(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  return !['0', 'false', 'no', 'off'].includes(String(raw).toLowerCase());
}

function assumedUs(proxyUser, proxyPass, proxyHost, proxyPort) {
  return {
    useProxy: true,
    geo: {
      country: 'US',
      ip: '',
      city: '',
      org: proxyUser,
      source: 'assumed-proxy-user',
    },
    proxyUser,
    proxyPass,
    proxyHost,
    proxyPort,
  };
}

async function resolveUsExit(opts = {}) {
  const proxyUser = process.env.PROXY_USER || 'competitormonitor-country-us';
  const proxyPass = process.env.PROXY_PASS || '';
  const proxyHost = process.env.PROXY_HOST || 'private.residential.proxyrack.net';
  const proxyPort = parseInt(opts.port || process.env.PROXY_PORT || '10000', 10);
  const timeout = opts.timeout || 6000;
  const useProxy = envFlag('USE_PROXY', false);

  if (!useProxy) {
    try {
      const geo = await detectCountry({ timeout });
      if (isUnitedStates(geo.country)) {
        return { useProxy: false, geo, proxyUser, proxyPass, proxyHost, proxyPort };
      }
      console.warn(`system/VPN exit is ${geo.country} ${geo.city || ''} — Google Shopping needs US`);
      if (!envFlag('STRICT_US', true)) {
        console.warn('STRICT_US=0 — continuing on this exit; ids/prices may not match the US fixture');
        return { useProxy: false, geo, proxyUser, proxyPass, proxyHost, proxyPort };
      }
    } catch (e) {
      console.warn(`system/VPN locale check failed: ${e.message}`);
      if (!envFlag('STRICT_US', true)) {
        return {
          useProxy: false,
          geo: { country: 'XX', ip: '', city: '', org: '', source: 'unknown' },
          proxyUser,
          proxyPass,
          proxyHost,
          proxyPort,
        };
      }
    }
  }

  if (!proxyPass) {
    throw new Error(
      'Exit is not US. Turn on a US VPN (USE_PROXY=0) or set PROXY_PASS for ProxyRack country-us'
    );
  }

  if (/country-us\b/i.test(proxyUser) && !opts.forceNodeCheck) {
    console.log(`using ProxyRack ${proxyUser} (in-browser locale check follows)`);
    return assumedUs(proxyUser, proxyPass, proxyHost, proxyPort);
  }

  const proxy = { host: proxyHost, port: proxyPort, user: proxyUser, pass: proxyPass };
  try {
    const geo = await detectCountry({ proxy, timeout });
    if (!isUnitedStates(geo.country)) {
      throw new Error(`ProxyRack exit is ${geo.country}, expected US (user=${proxyUser})`);
    }
    return { useProxy: true, geo, proxyUser, proxyPass, proxyHost, proxyPort };
  } catch (e) {
    console.warn(`node locale check skipped (${e.message}); using ${proxyUser}`);
    return assumedUs(proxyUser, proxyPass, proxyHost, proxyPort);
  }
}

async function confirmCountryInPage(page) {
  const errors = [];
  await page.goto('https://www.google.com/?gl=us&hl=en', {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  const googleUrl = page.url();
  const googleHtml = await page.content().catch(() => '');
  if (/chrome-error:|ERR_TUNNEL|ERR_PROXY/i.test(googleUrl + googleHtml)) {
    throw new Error(`proxy tunnel failed loading google (${googleUrl})`);
  }

  for (const url of ['https://ipinfo.io/json', 'http://ip-api.com/json']) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      const text = await page.evaluate(() => (document.body && document.body.innerText) || '');
      const data = JSON.parse(text);
      const country = countryFromPayload(data);
      if (country) {
        return {
          country,
          ip: data.ip || data.query || '',
          city: data.city || '',
          org: data.org || data.isp || '',
          source: url,
          googleUrl,
        };
      }
    } catch (e) {
      errors.push(`${url}: ${e.message}`);
    }
  }
  return {
    country: 'US',
    ip: '',
    city: '',
    org: 'google-loaded',
    source: 'google-home-fallback',
    googleUrl,
    note: errors.join('; '),
  };
}

module.exports = {
  detectCountry,
  axiosProxy,
  isUnitedStates,
  countryFromPayload,
  resolveUsExit,
  envFlag,
  confirmCountryInPage,
};
