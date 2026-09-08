/**
 * Queue server for Google Shopping cards (port 5057).
 *
 * GET  /get          -> next pending product/card task
 * POST /save         -> { ind, products: [...] }
 * GET  /status       -> { total, progress, products, pending }
 */
const http = require('http');
const fs = require('fs');
const url = require('url');
require('./env');

const PORT = parseInt(process.env.PORT || '5057', 10);
const DATA_DIR = 'data';
const PRODUCTS_DIR = 'data/products';

for (const d of [DATA_DIR, PRODUCTS_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

if (!fs.existsSync('urls.json')) {
  console.error('urls.json missing. Run: npm run seed');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync('urls.json', 'utf8'));
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

function countComplete() {
  return state.filter((s) => s.status === 'complete').length;
}

function countPending() {
  return state.filter((s) => s.status === 'pending').length;
}

http
  .createServer((request, response) => {
    const requestUrl = url.parse(request.url);
    const parts = requestUrl.pathname.split('/');

    if (parts[1] === 'get') {
      const now = Date.now();
      let found = -1;
      for (let i = baseIndex; i < state.length; i++) {
        if (state[i].status === 'pending' && found < 0) {
          /* keep scanning */
        }
        if (now - state[i].time <= 120000 || state[i].status !== 'pending') continue;
        if (fs.existsSync(`${PRODUCTS_DIR}/${i}.json`)) {
          state[i].status = 'complete';
          continue;
        }
        found = i;
        break;
      }
      if (found >= 0) {
        state[found].time = now;
        response.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        response.end(JSON.stringify({ ind: found, data: state[found].data }));
        return;
      }
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      response.end(JSON.stringify({}));
      return;
    }

    if (parts[1] === 'save') {
      if (request.method !== 'POST') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
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
          let products = Array.isArray(obj.products) ? obj.products : [];

          if (obj.html && state[ind]) {
            fs.writeFileSync(`${DATA_DIR}/${ind}.html`, obj.html);
          }
          if (obj.xhr && state[ind]) {
            fs.writeFileSync(`${DATA_DIR}/${ind}.xhr.json`, JSON.stringify(obj.xhr));
          }

          fs.writeFileSync(`${PRODUCTS_DIR}/${ind}.json`, JSON.stringify(products));
          if (state[ind]) {
            state[ind].status = 'complete';
            productCount += products.length;
          }

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
    console.log(`Google Shopping queue server on :${PORT}`);
  });
