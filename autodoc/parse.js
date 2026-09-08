/**
 * Parse Autodoc HTML (PLP listing or PDP) into product objects
 * matching the Scrapy AutodocSpider field shape.
 */
const cheerio = require('cheerio');

function cleanText(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function extractPrice(text) {
  if (text == null || text === '') return 0;
  const t = String(text).replace(/[^\d.,]/g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

function getUrlIdentifier(pageUrl) {
  const u = String(pageUrl || '').split('?')[0].replace(/\/$/, '');
  return u.split('/').pop();
}

function parseListing($, pageUrl) {
  const products = [];
  const category = $('li.breadcrumbs__item')
    .map((_, el) => cleanText($(el).text()))
    .get()
    .filter(Boolean);

  $('div.listing-list[data-listing-products] > div').each((_, el) => {
    const $p = $(el);
    const name = cleanText($p.find('.listing-item__name').first().text());
    if (!name) return;

    let link =
      $p.find('span[data-link]').attr('data-link') ||
      $p.find('a[href]').attr('href') ||
      '';
    if (link && link.startsWith('/')) link = 'https://www.autodoc.co.uk' + link;

    let identifier =
      ($p.find('span[data-link]').attr('data-link') || '').match(/\/(\d+)$/)?.[1] ||
      $p.attr('data-article-id') ||
      getUrlIdentifier(link);

    const mpnLabel = $p
      .find('span')
      .filter((_, s) => /MPN:/i.test($(s).text()))
      .first();
    const mpn = cleanText(mpnLabel.next('span').text());

    let sku =
      cleanText(
        ($p.find('span.listing-item__article-item').text() || '').replace(
          /^(?:Article number|Número de artículo|Réf\.|Numer artykułu):*\s*/i,
          ''
        )
      ) || mpn;

    let brand = cleanText(
      $p
        .find('span')
        .filter((_, s) => /Manufacturer:/i.test($(s).text()))
        .first()
        .next('span')
        .text()
    );
    if (!brand && link) {
      const parts = link.split('/');
      const slug = parts[parts.length - 2] || '';
      brand = slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }

    const price = extractPrice($p.attr('data-price')) || 0;
    const stock = $p.find('div.listing-item__available--not').length ? 0 : null;

    const oldPrice = extractPrice($p.find('div.old_price > span').first().text());
    const discount = ($p.find('div.discount').text().match(/\d+/) || [])[0] || '';
    let condition = cleanText(
      $p
        .find('span')
        .filter((_, s) => /Condition|Estado|L'état|Warunki/i.test($(s).text()))
        .first()
        .next('span')
        .text()
    );
    const ean = cleanText(
      $p
        .find('span')
        .filter((_, s) => /EAN/i.test($(s).text()))
        .first()
        .next('span')
        .text()
    );
    const headline = extractPrice(
      $p.find('.product-block__price-old-amount, .product-card-grid__product-old-price').first().text()
    );

    if (!identifier) return;

    products.push({
      identifier: String(identifier),
      url: link || pageUrl,
      name,
      sku,
      brand,
      price,
      category: category.join(' > '),
      image_url: `https://cdn.autodoc.de/thumb?id=${identifier}`,
      stock,
      shipping_cost: '',
      metadata: {
        headline_price: headline || oldPrice || price,
        Condition: condition,
        'Discount_%': discount,
        EAN: ean,
        MPN: mpn,
      },
    });
  });

  return products;
}

function parsePdp($, pageUrl) {
  let data = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html() || '';
    if (!/availability|Product/i.test(raw)) return;
    try {
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : parsed['@graph'] || [parsed];
      for (const n of nodes) {
        const t = n && n['@type'];
        const types = Array.isArray(t) ? t : [t];
        if (types.includes('Product')) {
          data = n;
          break;
        }
      }
    } catch (e) {}
  });
  if (!data) return [];

  const crumbs = $('li.breadcrumbs__item > a')
    .map((_, el) => cleanText($(el).text()))
    .get();
  const category = crumbs.slice(2).join(' > ');
  const identifier = getUrlIdentifier(pageUrl);
  const brand =
    (data.brand && (typeof data.brand === 'string' ? data.brand : data.brand.name)) || '';
  const offers = data.offers || {};
  const price = extractPrice(offers.price);
  const avail = String(offers.availability || '');
  const stock = avail.includes('InStock') ? null : 0;

  const oldPrice = extractPrice($('div.product-old-price span').first().text());
  const discount = ($('div.discount').text().match(/\d+/) || [])[0] || '';
  const condition = cleanText(
    $('span')
      .filter((_, s) => /Condition|Estado|L'état/i.test($(s).text()))
      .first()
      .next('span')
      .text()
  );
  const ean = cleanText(
    $('span')
      .filter((_, s) => /EAN/i.test($(s).text()))
      .first()
      .next('span')
      .text()
  );
  const mpn = cleanText(
    $('span')
      .filter((_, s) => /Manufacturer part number|Número de referencia|Numéro de pièce/i.test($(s).text()))
      .first()
      .next('span')
      .text()
  );
  const coreChargeRaw = ($('div.product-block__eco').text().match(/([\d,]+)/) || [])[1];
  const core_charge = coreChargeRaw ? String(extractPrice(coreChargeRaw)) : '';
  const image_count = new Set($('li.product-gallery__image-list-item').toArray().map((x) => $(x).html())).size;
  const picture_count = $('li[data-gallery-small-image]').length;
  const headline = extractPrice(
    $('.product-block__price-old-amount, .product-card-grid__product-old-price').first().text()
  );

  return [
    {
      identifier,
      url: pageUrl,
      name: data.name || '',
      sku: data.sku || '',
      brand,
      price,
      category,
      image_url: `https://cdn.autodoc.de/thumb?id=${identifier}`,
      stock,
      shipping_cost: '',
      metadata: {
        headline_price: headline || oldPrice || price,
        Condition: condition,
        'Discount_%': discount,
        EAN: ean,
        MPN: mpn,
        core_charge,
        image_available: picture_count || image_count ? 'Yes' : 'No',
        image_count: image_count || (data.image ? 1 : 0),
        picture_count,
      },
    },
  ];
}

function parseAutodocHtml(html, pageUrl, modeHint) {
  const $ = cheerio.load(html || '');
  if (modeHint === 'plp' || $('div.listing-list[data-listing-products]').length) {
    const listing = parseListing($, pageUrl);
    if (listing.length) return { mode: 'plp', products: listing };
  }
  const pdp = parsePdp($, pageUrl);
  return { mode: 'pdp', products: pdp };
}

function applyShipping(product) {
  if (product.shipping_cost) return product;
  const price = Number(product.price) || 0;
  const cats = String(product.category || '').split(/\s+/);
  if (cats.includes('Battery') || price < 150) {
    product.shipping_cost = '8.45';
  }
  return product;
}

module.exports = {
  parseAutodocHtml,
  applyShipping,
  extractPrice,
  getUrlIdentifier,
};
