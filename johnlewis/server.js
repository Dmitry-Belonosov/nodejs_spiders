/**
 * Queue server for johnlewis.com (port 5056).
 *
 * GET  /get          -> next pending URL task
 * POST /save         -> { ind, products: [...], links?: [...] }
 * GET  /status       -> { total, progress, products, pending }
 *
 * Discovers brand → listing → pagination → product links automatically.
 */
const http = require('http');
const fs = require('fs');
const url = require('url');
const { parseJohnLewisHtml, prepareUrl, productIdFromUrl } = require('./parse');

const PORT = parseInt(process.env.PORT || '5056', 10);
const DATA_DIR = 'data';
const PRODUCTS_DIR = 'data/products';

for (const d of [DATA_DIR, PRODUCTS_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

if (!fs.existsSync('urls.json')) {
  console.error('urls.json missing. Run: npm run seed-sample');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync('urls.json', 'utf8'));
const seenUrls = new Set(data.map((item) => normalizeSeen(item.url)));
const state = data.map((item, i) => {
  const done = fs.existsSync(`${PRODUCTS_DIR}/${i}.json`);
  return { time: 0, status: done ? 'complete' : 'pending', data: item };
});

let baseIndex = 0;
let productCount = 0;
const startedAt = Date.now();
let productsAtStart = 0;
for (let i = 0; i < state.length; i++) {
  if (state[i].status !== 'complete') continue;
  try {
    const arr = JSON.parse(fs.readFileSync(`${PRODUCTS_DIR}/${i}.json`, 'utf8'));
    if (Array.isArray(arr)) productCount += arr.length;
  } catch (e) {}
}

productsAtStart = productCount;
console.log(
  `state: ${state.length} (already complete: ${state.filter((s) => s.status === 'complete').length})`
);

function normalizeSeen(u) {
  try {
    const prepared = prepareUrl(u, u) || u;
    const x = new URL(prepared);
    x.hash = '';
    if (productIdFromUrl(x.pathname)) {
      x.search = '';
    }
    return x.toString();
  } catch (e) {
    return String(u || '');
  }
}

function countComplete() {
  return state.filter((s) => s.status === 'complete').length;
}

function countPending() {
  return state.filter((s) => s.status === 'pending').length;
}

function persistUrls() {
  const urls = state.map((s) => s.data);
  fs.writeFileSync('urls.json', JSON.stringify(urls, null, 2));
}

function enqueueLinks(links) {
  let added = 0;
  for (const link of links || []) {
    if (!link || !link.url) continue;
    const prepared = prepareUrl(link.url, link.url);
    const key = normalizeSeen(prepared);
    if (!key || seenUrls.has(key)) continue;
    seenUrls.add(key);
    const mode =
      link.mode ||
      (productIdFromUrl(prepared)
        ? 'pdp'
        : prepared.includes('/brands')
          ? 'brands'
          : prepared.includes('/brand/')
            ? 'listing'
            : 'home');
    state.push({
      time: 0,
      status: 'pending',
      data: { url: prepared, mode },
    });
    added += 1;
  }
  if (added) persistUrls();
  return added;
}

http
  .createServer((request, response) => {
    const requestUrl = url.parse(request.url);
    const parts = requestUrl.pathname.split('/');

    if (parts[1] === 'get') {
      // Product pages first so MAX_PRODUCTS is not stuck behind 2000 brand listings.
      const now = Date.now();
      function isPdpTask(item) {
        const mode = (item.data && item.data.mode) || '';
        const href = (item.data && item.data.url) || '';
        return mode === 'pdp' || !!productIdFromUrl(href);
      }
      function pickPending(pdpOnly) {
        let noPending = true;
        for (let i = baseIndex; i < state.length; i++) {
          if (state[i].status === 'pending') noPending = false;
          if (noPending) baseIndex = i;
          if (now - state[i].time <= 45000 || state[i].status !== 'pending') continue;
          if (fs.existsSync(`${PRODUCTS_DIR}/${i}.json`)) {
            state[i].status = 'complete';
            continue;
          }
          if (pdpOnly && !isPdpTask(state[i])) continue;
          return i;
        }
        return -1;
      }
      let found = pickPending(true);
      if (found < 0) found = pickPending(false);
      if (found >= 0) {
        state[found].time = now;
        response.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        response.end(JSON.stringify({ ind: found, data: state[found].data }));
        return;
      }
      if (found < 0) {
        response.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        response.end(JSON.stringify({}));
      }
      return;
    }

    if (parts[1] === 'save') {
      if (request.method !== 'POST') {
        response.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        response.end(JSON.stringify({ success: true }));
        return;
      }
      let body = '';
      request.on('data', (chunk) => {
        body += chunk;
      });
      request.on('end', () => {
        try {
          const obj = JSON.parse(body);
          const ind = obj.ind;
          let products = Array.isArray(obj.products) ? obj.products : null;
          let links = Array.isArray(obj.links) ? obj.links : [];

          if (obj.html) {
            fs.writeFileSync(`${DATA_DIR}/${ind}.html`, obj.html);
            if (state[ind]) {
              const pageUrl = (state[ind].data && state[ind].data.url) || '';
              const mode = (state[ind].data && state[ind].data.mode) || '';
              const parsed = parseJohnLewisHtml(obj.html, pageUrl, mode);
              if (!products) products = parsed.products || [];
              if (!links.length) links = parsed.links || [];
            }
          }

          if (Array.isArray(products)) {
            fs.writeFileSync(`${PRODUCTS_DIR}/${ind}.json`, JSON.stringify(products));
            if (state[ind]) {
              state[ind].status = 'complete';
              productCount += products.length;
            }
          }

          const added = enqueueLinks(links);
          if (added) console.log(`enqueued ${added} link(s) (queue=${state.length})`);

          response.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          response.end('ok');
        } catch (e) {
          response.writeHead(400, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ error: String(e.message || e) }));
        }
      });
      return;
    }

    if (parts[1] === 'status') {
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      const elapsedMin = (Date.now() - startedAt) / 60000;
      const gained = productCount - productsAtStart;
      const productsPerMin = elapsedMin >= 0.05 ? Math.round(gained / elapsedMin) : 0;
      response.end(
        JSON.stringify({
          total: state.length,
          progress: countComplete(),
          pending: countPending(),
          products: productCount,
          productsPerMin,
        })
      );
      return;
    }

    response.writeHead(404);
    response.end('not found');
  })
  .listen(PORT, () => {
    console.log(`John Lewis queue server on :${PORT}`);
  });
