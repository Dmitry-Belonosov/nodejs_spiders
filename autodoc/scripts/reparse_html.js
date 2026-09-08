const fs = require('fs');
const path = require('path');
const { parseAutodocHtml, applyShipping } = require('../parse');
const urls = fs.existsSync('urls.json') ? JSON.parse(fs.readFileSync('urls.json','utf8')) : [];
const dataDir = 'data';
const outDir = 'data/products';
let n = 0;
for (const f of fs.readdirSync(dataDir)) {
  if (!f.endsWith('.html')) continue;
  const ind = parseInt(f.replace('.html',''), 10);
  const html = fs.readFileSync(path.join(dataDir, f), 'utf8');
  const pageUrl = (urls[ind] && urls[ind].url) || '';
  const mode = (urls[ind] && urls[ind].mode) || 'pdp';
  const parsed = parseAutodocHtml(html, pageUrl, mode);
  const products = (parsed.products || []).map(applyShipping);
  fs.writeFileSync(path.join(outDir, ind + '.json'), JSON.stringify(products));
  n += products.length;
  console.log(ind, products.length);
}
console.log('products', n);
