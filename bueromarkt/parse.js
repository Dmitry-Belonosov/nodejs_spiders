/**
 * Parse bueromarkt-ag.de PDP HTML into product objects
 * matching the Scrapy RajaPack_Full-bueromarkt field shape.
 */
const cheerio = require('cheerio');

function cleanText(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function extractPrice(text) {
  if (text == null || text === '') return 0;
  const t = String(text).replace(/[^\d.,]/g, '').replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

function getSkuFromUrl(pageUrl) {
  const m = String(pageUrl || '').match(/p-([^/?#]+?)(?:\.html)?(?:[?#]|$)/i);
  return m ? m[1].replace(/\.html$/i, '') : '';
}

function getDiscount(price, oldPrice) {
  const p = Number(price) || 0;
  const o = Number(oldPrice) || 0;
  if (!p || !o || o <= p) return null;
  const discountDifference = +(o - p).toFixed(2);
  const discountPercent = Math.round(((o - p) / o) * 100);
  return {
    discount_difference: String(discountDifference),
    'discount_%': String(discountPercent),
    old_price: String(o),
  };
}

function applyShipping(product) {
  const price = Number(product.price) || 0;
  let shipping = 0;
  if (price < 29.99) shipping = 4.0;
  else if (price < 150) shipping = 3.49;
  product.shipping_cost = shipping;
  return product;
}

function parseProduct($, pageUrl, condition) {
  const name =
    cleanText($('meta[property="og:description"]').attr('content')) ||
    cleanText($('meta[property="og:title"]').attr('content')) ||
    cleanText($('h1').first().text());

  const priceRaw =
    $('span.product_price.mainPrice, span[class*="product_price"][class*="mainPrice"]')
      .first()
      .attr('data-price-net') ||
    $('span[class*="product_price mainPrice"]').first().attr('data-price-net') ||
    '';
  const price = extractPrice(priceRaw);

  if (!name || price <= 0) return null;

  const oldPriceRaw =
    $('span.product_price.price-st-exp').first().attr('data-price-net') || '';
  const oldPrice = extractPrice(oldPriceRaw);

  const stock = $('form[action="/api/cart/add"]').length ? 1 : 0;

  const category = $('nav#breadcrumb span[itemprop="name"]')
    .map((_, el) => cleanText($(el).text()))
    .get()
    .slice(1)
    .filter(Boolean);

  const brand =
    cleanText($('a[class*="brand"]').first().attr('title')) ||
    cleanText($('a.brand').first().attr('title')) ||
    '';

  const imageUrl = cleanText($('meta[property="og:image"]').attr('content')) || '';
  const sku = getSkuFromUrl(pageUrl);
  const identifier = sku;

  const leadTime = cleanText(
    $('div[class*="product-delivery-status"]').first().text()
  );
  let gtin = '';
  $('script').each((_, el) => {
    const txt = $(el).html() || '';
    const m = txt.match(/"gtin"\s*:\s*"([^"]+)"/);
    if (m) gtin = m[1];
  });

  const metadata = {
    lead_time: leadTime,
    gtin,
    Condition: condition || '',
  };
  const discount = getDiscount(price, oldPrice);
  if (discount) Object.assign(metadata, discount);

  return {
    identifier,
    url: pageUrl,
    name,
    sku,
    brand,
    price,
    category: category.join(' > '),
    image_url: imageUrl,
    stock,
    shipping_cost: '',
    metadata,
  };
}

/**
 * Extract product variation option URLs (Neuware / B-Ware).
 */
function extractOptionUrls($, pageUrl) {
  const options = [];
  $('div[class*="product-variations"] a').each((_, el) => {
    const $a = $(el);
    let href = $a.attr('href') || '';
    if (!href) return;
    if (href.startsWith('/')) href = 'https://www.bueromarkt-ag.de' + href;
    else if (!/^https?:/i.test(href)) {
      try {
        href = new URL(href, pageUrl).href;
      } catch (e) {
        return;
      }
    }
    const text = cleanText($a.find('span').first().text() || $a.text()).toLowerCase();
    let condition = '';
    if (text.includes('neuware')) condition = 'new';
    if (text.includes('b-ware')) condition = 'used';
    options.push({ url: href, condition, mode: 'pdp' });
  });
  return options;
}

function parseBueromarktHtml(html, pageUrl, condition) {
  const $ = cheerio.load(html || '');
  const product = parseProduct($, pageUrl, condition || '');
  const options = extractOptionUrls($, pageUrl);
  return {
    products: product ? [applyShipping(product)] : [],
    options,
  };
}

function looksLikeCf(html) {
  const s = html || '';
  if (/Sicherheitsfrage/i.test(s)) return true;
  if (/Captcha-Abfrage/i.test(s) && /Shop leiten/i.test(s)) return true;
  return (
    /Just a moment|cf-browser-verification|challenge-platform|Attention Required|_cf_chl_opt/i.test(
      s
    ) && s.length < 20000
  );
}

module.exports = {
  parseBueromarktHtml,
  applyShipping,
  extractPrice,
  getSkuFromUrl,
  looksLikeCf,
  extractOptionUrls,
};
