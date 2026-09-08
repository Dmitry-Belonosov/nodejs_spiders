#!/usr/bin/env node
/**
 * Print the current exit country. Uses ProxyRack US when the system VPN is not US.
 */
require('../env');
const fs = require('fs');
const path = require('path');
const { resolveUsExit } = require('../locale');

console.log('check-locale starting', 'USE_PROXY=' + process.env.USE_PROXY, 'user=' + (process.env.PROXY_USER || ''));

resolveUsExit()
  .then((info) => {
    const via = info.useProxy ? 'proxy-us' : 'vpn/system';
    const line = `locale=${info.geo.country} via=${via} ip=${info.geo.ip} city=${info.geo.city} org=${info.geo.org} source=${info.geo.source}`;
    console.log(line);
    try {
      fs.writeFileSync(path.join(__dirname, '..', 'locale-check.txt'), line + '\n');
    } catch (e) {}
    if (info.geo.country !== 'US') process.exit(2);
  })
  .catch((e) => {
    console.error('FAIL:', e && e.stack ? e.stack : e);
    process.exit(1);
  });
