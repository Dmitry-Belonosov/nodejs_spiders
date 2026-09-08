/**
 * Queue server for RS Online.
 *
 * GET  /get     -> next pending URL task, or {} when the queue is drained
 * POST /save    -> { ind, products: [...] } or { ind, html }
 * GET  /status  -> { total, progress, products }
 *
 * Workers post raw HTML and the parsing happens here, so a parser fix can be
 * applied to already-crawled pages without re-fetching them — which matters on
 * a site behind Akamai, where fetching is the expensive part.
 */
const http = require('http');
const fs = require('fs');
const { parseRsonlineHtml } = require('./parse');

const PORT = parseInt(process.env.PORT || '5051', 10);
const DATA_DIR = 'data';
const PRODUCTS_DIR = 'data/products';
// Pages are kept only when asked for: a full crawl is ~250 KB per product.
const KEEP_HTML = process.env.KEEP_HTML === '1';
// A task is handed out again if the worker that took it went quiet.
const LEASE_MS = parseInt(process.env.LEASE_MS || '30000', 10);

for (const dir of [DATA_DIR, PRODUCTS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

if (!fs.existsSync('urls.json')) {
  console.error('urls.json missing. Run: npm run seed-sample  OR  npm run seed-sitemap');
  process.exit(1);
}

const seeds = JSON.parse(fs.readFileSync('urls.json', 'utf8'));
const state = seeds.map((item, i) => ({
  time: 0,
  status: fs.existsSync(`${PRODUCTS_DIR}/${i}.json`) ? 'complete' : 'pending',
  data: item,
}));

let productCount = 0;
for (let i = 0; i < state.length; i += 1) {
  if (state[i].status !== 'complete') continue;
  try {
    const saved = JSON.parse(fs.readFileSync(`${PRODUCTS_DIR}/${i}.json`, 'utf8'));
    if (Array.isArray(saved)) productCount += saved.length;
  } catch (e) {
    /* unreadable checkpoint is treated as empty */
  }
}

console.log(
  `state: ${state.length} (already complete: ${state.filter((s) => s.status === 'complete').length})`
);

let baseIndex = 0;

function countComplete() {
  return state.filter((s) => s.status === 'complete').length;
}

function sendJson(response, body, code = 200) {
  response.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  response.end(JSON.stringify(body));
}

function nextTask(response) {
  const now = Date.now();
  let noPending = true;

  for (let i = baseIndex; i < state.length; i += 1) {
    if (state[i].status === 'pending') noPending = false;
    // Everything before the first pending task is finished for good, so later
    // scans can start here instead of walking the whole list again.
    if (noPending) baseIndex = i;

    if (state[i].status !== 'pending' || now - state[i].time <= LEASE_MS) continue;

    // A checkpoint on disk means another worker finished it since the restart.
    if (fs.existsSync(`${PRODUCTS_DIR}/${i}.json`)) {
      state[i].status = 'complete';
      continue;
    }
    state[i].time = now;
    sendJson(response, { ind: i, data: state[i].data });
    return;
  }
  sendJson(response, {});
}

function saveResult(body, response) {
  let payload;
  try {
    payload = JSON.parse(body);
  } catch (e) {
    return sendJson(response, { error: 'invalid JSON body' }, 400);
  }

  const ind = payload.ind;
  if (!Number.isInteger(ind) || ind < 0 || ind >= state.length) {
    return sendJson(response, { error: `index out of range: ${ind}` }, 400);
  }

  let products = Array.isArray(payload.products) ? payload.products : null;

  if (payload.html) {
    if (KEEP_HTML) fs.writeFileSync(`${DATA_DIR}/${ind}.html`, payload.html);
    if (!products || !products.length) {
      const pageUrl = (state[ind].data && state[ind].data.url) || '';
      products = parseRsonlineHtml(payload.html, pageUrl).products;
    }
  }

  if (Array.isArray(products)) {
    fs.writeFileSync(`${PRODUCTS_DIR}/${ind}.json`, JSON.stringify(products));
    if (state[ind].status !== 'complete') {
      state[ind].status = 'complete';
      productCount += products.length;
    }
  }

  sendJson(response, { success: true });
}

http
  .createServer((request, response) => {
    const route = new URL(request.url, 'http://localhost').pathname.split('/')[1];

    if (route === 'get') return nextTask(response);

    if (route === 'save') {
      if (request.method !== 'POST') return sendJson(response, { success: true });
      let body = '';
      request.on('data', (chunk) => {
        body += chunk;
      });
      request.on('end', () => saveResult(body, response));
      return;
    }

    if (route === 'status') {
      return sendJson(response, {
        total: state.length,
        progress: countComplete(),
        products: productCount,
      });
    }

    response.writeHead(404);
    response.end('not found');
  })
  .listen(PORT, () => {
    console.log(`RS Online queue server on :${PORT}`);
  });
