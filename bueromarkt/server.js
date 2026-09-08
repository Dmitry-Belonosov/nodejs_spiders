/**
 * Queue server for Bueromarkt (port 5053).
 *
 * GET  /get          -> next pending URL task
 * POST /save         -> { ind, products: [...], options?: [...] }
 *                   or { ind, html }
 * GET  /status       -> { total, progress, products }
 *
 * When options (Neuware / B-Ware variants) are posted, new URLs are appended
 * to the queue if not already present.
 */
const http = require('http');
const fs = require('fs');
const url = require('url');
const { parseBueromarktHtml } = require('./parse');

const PORT = parseInt(process.env.PORT || '5053', 10);
const DATA_DIR = 'data';
const PRODUCTS_DIR = 'data/products';

for (const d of [DATA_DIR, PRODUCTS_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

if (!fs.existsSync('urls.json')) {
  console.error('urls.json missing. Run: npm run seed-sample  OR  npm run seed-sitemap');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync('urls.json', 'utf8'));
const seenUrls = new Set(data.map((item) => item.url));
const state = data.map((item, i) => {
  const done = fs.existsSync(`${PRODUCTS_DIR}/${i}.json`);
  return { time: 0, status: done ? 'complete' : 'pending', data: item };
});

let baseIndex = 0;
let productCount = 0;
for (let i = 0; i < state.length; i++) {
  if (state[i].status !== 'complete') continue;
  try {
    const arr = JSON.parse(fs.readFileSync(`${PRODUCTS_DIR}/${i}.json`, 'utf8'));
    if (Array.isArray(arr)) productCount += arr.length;
  } catch (e) {}
}

console.log(
  `state: ${state.length} (already complete: ${state.filter((s) => s.status === 'complete').length})`
);

function countComplete() {
  return state.filter((s) => s.status === 'complete').length;
}

function persistUrls() {
  const urls = state.map((s) => s.data);
  fs.writeFileSync('urls.json', JSON.stringify(urls, null, 2));
}

function enqueueOptions(options) {
  let added = 0;
  for (const opt of options || []) {
    if (!opt || !opt.url || seenUrls.has(opt.url)) continue;
    seenUrls.add(opt.url);
    state.push({
      time: 0,
      status: 'pending',
      data: {
        url: opt.url,
        mode: 'pdp',
        condition: opt.condition || '',
      },
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
      const now = Date.now();
      let found = false;
      let noPending = true;
      for (let i = baseIndex; i < state.length; i++) {
        if (state[i].status === 'pending') noPending = false;
        if (noPending) baseIndex = i;

        if (now - state[i].time > 30000 && state[i].status === 'pending') {
          if (fs.existsSync(`${PRODUCTS_DIR}/${i}.json`)) {
            state[i].status = 'complete';
            continue;
          }
          state[i].time = now;
          found = true;
          response.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          response.end(JSON.stringify({ ind: i, data: state[i].data }));
          break;
        }
      }
      if (!found) {
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
          let options = Array.isArray(obj.options) ? obj.options : [];

          if (obj.html) {
            fs.writeFileSync(`${DATA_DIR}/${ind}.html`, obj.html);
            if ((!products || !products.length) && state[ind]) {
              const pageUrl = (state[ind].data && state[ind].data.url) || '';
              const condition = (state[ind].data && state[ind].data.condition) || '';
              const parsed = parseBueromarktHtml(obj.html, pageUrl, condition);
              products = parsed.products || [];
              if (!options.length) options = parsed.options || [];
            }
          }

          if (Array.isArray(products)) {
            fs.writeFileSync(`${PRODUCTS_DIR}/${ind}.json`, JSON.stringify(products));
            if (state[ind]) {
              state[ind].status = 'complete';
              productCount += products.length;
            }
          }

          const added = enqueueOptions(options);
          if (added) console.log(`enqueued ${added} option URL(s)`);

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
      response.end(
        JSON.stringify({
          total: state.length,
          progress: countComplete(),
          products: productCount,
        })
      );
      return;
    }

    response.writeHead(404);
    response.end('not found');
  })
  .listen(PORT, () => {
    console.log(`Bueromarkt queue server on :${PORT}`);
  });
