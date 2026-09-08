const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

const SERVER_HOST = '127.0.0.1';
const SERVER_PORT = 5050;
const SERVER_BASE = `http://${SERVER_HOST}:${SERVER_PORT}`;
const THREADS = 10;
const PROXY_COUNT = 200;
const PROXY_USER = process.env.PROXY_USER || 'competitormonitor';
const PROXY_PASS = process.env.PROXY_PASS || '';
// Without this the crawl would silently fail to authenticate with the proxy.
if (!PROXY_PASS) {
  console.error('PROXY_PASS is not set — add it to .env');
  process.exit(1);
}
const PROXY_HOST = process.env.PROXY_HOST || 'private.residential.proxyrack.net';

const agents = [];
for (let i = 0; i < PROXY_COUNT; i += 1) {
    agents.push(
        new HttpsProxyAgent(
            `http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${10000 + i}`
        )
    );
}

let proxyIndex = 0;
function nextAgent() {
    const agent = agents[proxyIndex % agents.length];
    proxyIndex += 1;
    return agent;
}

function getHeader() {
    return {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'cache-control': 'max-age=0',
        'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'accept-encoding': 'gzip, deflate, br',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
    };
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function thread(index) {
    let currentTask = null;
    let retries = 0;

    async function getData() {
        try {
            const response = await axios.get(`${SERVER_BASE}/get`, { timeout: 10000 });
            const data = response.data;
            if (data && data.ind !== undefined) {
                currentTask = data;
                await scrap();
            } else {
                await delay(5000);
                return getData();
            }
        } catch (error) {
            console.error(`thread ${index} get_data error:`, error.message || error);
            await delay(5000);
            return getData();
        }
    }

    async function save() {
        try {
            const payload = { ind: currentTask.ind, html: currentTask.html };
            await axios.post(`${SERVER_BASE}/save/`, payload, { timeout: 10000 });
            console.log(`thread ${index} saved ind=${currentTask.ind}`);
            retries = 0;
            await delay(Math.floor(Math.random() * 4000) + 4000);
            return getData();
        } catch (error) {
            console.error(`thread ${index} save error ind=${currentTask?.ind}:`, error.message || error);
            await delay(5000);
            return getData();
        }
    }

    async function scrap() {
        if (!currentTask?.data?.url) {
            console.error(`thread ${index} invalid task`, currentTask);
            return getData();
        }

        const targetUrl = `https://www.very.co.uk${currentTask.data.url}`;
        const agent = nextAgent();

        try {
            console.log(`thread ${index} scraping ind=${currentTask.ind} via proxy`);
            const response = await axios.get(targetUrl, {
                headers: getHeader(),
                httpsAgent: agent,
                proxy: false,
                responseType: 'text',
                timeout: 20000,
                signal: AbortSignal.timeout(25000),
                validateStatus: (status) => status < 500
            });

            if (response.status === 404) {
                currentTask.html = '';
                return save();
            }

            if (response.status === 403 || response.status === 429) {
                console.error(`thread ${index} scrape blocked ind=${currentTask.ind} status=${response.status} rotating proxy`);
                await delay(3000);
                retries += 1;
                if (retries > 8) {
                    retries = 0;
                    await delay(30000);
                    return getData();
                }
                return scrap();
            }

            if (typeof response.data === 'string' && response.data.length > 15000) {
                currentTask.html = response.data;
                return save();
            }

            console.error(`thread ${index} short/empty response ind=${currentTask.ind} status=${response.status} len=${response.data?.length || 0}`);
            await delay(3000);
            retries += 1;
            if (retries > 8) {
                retries = 0;
                return getData();
            }
            return scrap();
        } catch (error) {
            const status = error.response?.status;
            console.error(`thread ${index} scrape error ind=${currentTask.ind} status=${status || error.code || 'unknown'}`);

            if (status === 429 || status === 403) {
                await delay(5000);
                retries += 1;
                if (retries > 8) {
                    retries = 0;
                    await delay(30000);
                    return getData();
                }
                return scrap();
            }

            if (status === 404) {
                currentTask.html = '';
                return save();
            }

            retries += 1;
            if (retries > 5) {
                retries = 0;
                await delay(10000);
                return getData();
            }
            await delay(5000);
            return scrap();
        }
    }

    getData();
}

console.log(`worker starting threads=${THREADS} proxies=${agents.length} user=${PROXY_USER}`);
for (let i = 1; i <= THREADS; i += 1) {
    thread(i);
}
