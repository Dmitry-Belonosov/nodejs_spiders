/**
 * Parse ghedirect.co.uk (WooCommerce / Woodmart) — Kinsta Cloudflare.
 * Field shape matches Scrapy DiscountHydro_GHEDirect.
 */
const cheerio = require('cheerio');

const HOST = 'ghedirect.co.uk';

function cleanText(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function prepareUrl(pageUrl, href) {
  if (!href) return '';
  try {
    return new URL(href, pageUrl || `https://${HOST}/`).href;
  } catch (e) {
    return '';
  }
}

function looksLikeBlocked(html, pageUrl, status) {
  const body = String(html || '');
  const lower = body.toLowerCase();
  // Yoast XSL-rendered sitemaps in Chrome have /product/ hrefs, not raw <loc>.
  const hasSitemapContent =
    lower.includes('<loc>') || /href=["'][^"']*\/product\//i.test(body);
  if (status && [403, 407, 429, 500, 502, 503, 504].includes(status)) return true;
  if (!body.trim()) return true;
  if (lower.includes('checking your browser')) return true;
  if (lower.includes('just a moment')) return true;
  if (lower.includes('ki-cf-botcl')) return true;
  if (lower.includes('challenge-platform')) return true;
  if ((pageUrl || '').includes('ki-cf-botcl')) return true;
  if ((pageUrl || '').includes('sitemap') && !hasSitemapContent) return true;
  return false;
}

function pushSitemapUrl(links, seen, url) {
  url = cleanText(url);
  if (!url || seen.has(url)) return;
  seen.add(url);
  if (/product[^/]*\.xml$/i.test(url) || url.includes('wp-sitemap-posts-product')) {
    links.push({ url, mode: 'sitemap' });
  } else if (url.includes('/product/')) {
    links.push({ url, mode: 'pdp' });
  }
}

function extractSitemapLinks(html) {
  const links = [];
  const seen = new Set();
  const re = /<loc>(.*?)<\/loc>/gi;
  let m;
  while ((m = re.exec(html || '')) !== null) {
    pushSitemapUrl(links, seen, m[1]);
  }
  // Chrome applies Yoast XSL → HTML table with <a href="/product/...">
  const hrefRe = /href=["'](https?:\/\/[^"']*ghedirect\.co\.uk\/product\/[^"']+)["']/gi;
  while ((m = hrefRe.exec(html || '')) !== null) {
    pushSitemapUrl(links, seen, m[1]);
  }
  return links;
}

function extractHtmlLinks($, pageUrl) {
  const links = [];
  const seen = new Set();
  function push(href, mode) {
    const url = prepareUrl(pageUrl, href);
    if (!url || !url.includes(HOST) || seen.has(url)) return;
    seen.add(url);
    links.push({ url, mode });
  }
  $('a[href*="/product/"]').each((_, el) => {
    push($(el).attr('href') || '', 'pdp');
  });
  $('a[href*="product-sitemap"], a[href*="product-"][href$=".xml"]').each((_, el) => {
    push($(el).attr('href') || '', 'sitemap');
  });
  return links;
}

function getDiscount(price, oldPrice) {
  const p = parseFloat(price);
  const o = parseFloat(oldPrice);
  if (!p || !o || o <= p) return { discount_difference: '', 'discount_%': '' };
  const diff = o - p;
  const pct = Math.round((-diff / o) * 100);
  return { discount_difference: String(diff), 'discount_%': String(pct) };
}

function parsePdp($, pageUrl) {
  let name =
    cleanText($('h1 strong').first().text()) ||
    cleanText($('meta[property="og:title"]').attr('content') || '').split(' |')[0];
  name = name.replace(/ - The Greenhouse Effect/g, '').trim();

  const baseSku =
    $('input[name="product_id"]').attr('value') ||
    cleanText($('span.sku').first().text()) ||
    '';

  const category = $('nav[aria-label="Breadcrumb"] a')
    .map((_, el) => cleanText($(el).text()))
    .get()
    .slice(1);

  let brand =
    $('span.posted_in a[href*="/product-category/brands/"]').last().text() ||
    (name ? name.split(' ')[0] : '');
  brand = cleanText(brand);

  let takeOptions = false;
  $('script').each((_, el) => {
    const t = $(el).html() || '';
    if (!t.includes('productType')) return;
    const m = t.match(/\{[\s\S]*\}/);
    if (!m) return;
    try {
      const data1 = JSON.parse(m[0]);
      takeOptions = (data1.productIsVariable || 0) > 0;
    } catch (e) {}
  });

  const variationsRaw = $('[data-product_variations]').attr('data-product_variations');
  const products = [];

  if (variationsRaw && takeOptions) {
    let variants = [];
    try {
      variants = JSON.parse(variationsRaw);
    } catch (e) {
      variants = [];
    }
    for (const variant of variants) {
      const price = variant.display_price || variant.display_regular_price || 0;
      const shipping = price ? 7.99 : 0;
      const image = (variant.image && variant.image.src) || '';
      let varName = name;
      let sku = baseSku;
      if (variants.length > 1) {
        const attrs = Object.values((variant.attributes) || {}).join(' ');
        varName = cleanText(`${name} ${attrs}`);
        sku = cleanText(`${baseSku} ${variant.sku || ''}`);
      }
      const oldPrice = variant.display_regular_price || '';
      const disc = getDiscount(price, oldPrice);
      products.push({
        identifier: sku,
        sku,
        name: varName,
        price,
        stock: variant.is_in_stock === true ? null : 0,
        brand,
        category: category.join(' > '),
        shipping_cost: shipping,
        image_url: image,
        url: pageUrl,
        metadata: {
          old_price: oldPrice,
          discount_difference: disc.discount_difference,
          'discount_%': disc['discount_%'],
          promotional_text: cleanText($('span:contains("Discount")').first().text()),
          gtin: cleanText($('span.hwp-gtin span').first().text()),
        },
      });
    }
    return products;
  }

  let price =
    ($('input[name*="_product_data"]').attr('value') || '').match(/price":([\d.]+)/) ||
    null;
  price = price ? price[1] : cleanText($('.product-image-summary-wrap ins .woocommerce-Price-amount bdi').first().text()) || '0';
  price = parseFloat(String(price).replace(/[^\d.]/g, '')) || 0;
  const oldPriceRaw = cleanText(
    $('.product-image-summary-wrap .woocommerce-Price-amount bdi').first().text()
  );
  const oldPrice = parseFloat(String(oldPriceRaw).replace(/[^\d.]/g, '')) || 0;
  const stockText = cleanText($('p.stock.in-stock').first().text());
  const image = prepareUrl(
    pageUrl,
    $('.wd-carousel-wrap img').first().attr('src') || ''
  );
  const disc = oldPrice && oldPrice !== price ? getDiscount(price, oldPrice) : { discount_difference: '', 'discount_%': '' };
  products.push({
    identifier: baseSku,
    sku: baseSku,
    name,
    price,
    stock: stockText ? null : 0,
    brand,
    category: category.join(' > '),
    shipping_cost: price ? 7.99 : 0,
    image_url: image,
    url: pageUrl,
    metadata: {
      old_price: oldPrice || '',
      discount_difference: disc.discount_difference,
      'discount_%': disc['discount_%'],
      promotional_text: cleanText($('span:contains("Discount")').first().text()),
      gtin: cleanText($('span.hwp-gtin span').first().text()),
    },
  });
  return products;
}

function detectMode(pageUrl, modeHint) {
  if (modeHint) return modeHint;
  if ((pageUrl || '').includes('.xml') || (pageUrl || '').includes('sitemap')) return 'sitemap';
  if ((pageUrl || '').includes('/product/')) return 'pdp';
  return 'home';
}

function parseGheHtml(html, pageUrl, modeHint) {
  const mode = detectMode(pageUrl, modeHint);
  if (mode === 'sitemap' || (html || '').includes('<loc>')) {
    return { mode: 'sitemap', products: [], links: extractSitemapLinks(html) };
  }
  const $ = cheerio.load(html || '');
  if (mode === 'pdp' || (pageUrl || '').includes('/product/')) {
    return { mode: 'pdp', products: parsePdp($, pageUrl), links: [] };
  }
  return { mode: mode || 'home', products: [], links: extractHtmlLinks($, pageUrl) };
}

module.exports = {
  parseGheHtml,
  parseEvertonHtml: parseGheHtml, // alias so copied server.js keeps working if needed
  prepareUrl,
  looksLikeBlocked,
  HOST,
  cleanText,
};
