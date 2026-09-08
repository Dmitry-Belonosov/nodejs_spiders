/**
 * Browser fallback content script — navigation scrape for Autodoc when axios is blocked.
 * Queue server: :5052
 * Polls until Cloudflare challenge clears or timeout.
 */
(function () {
  var MAX_WAIT_MS = 45000;
  var INTERVAL_MS = 2500;
  var started = Date.now();

  function looksOk(html) {
    return (
      html.length > 15000 &&
      (html.indexOf('listing-list') !== -1 ||
        html.indexOf('application/ld+json') !== -1 ||
        html.indexOf('listing-item__name') !== -1 ||
        html.indexOf('product-card') !== -1 ||
        html.indexOf('product__title') !== -1)
    );
  }

  function looksBlocked(html) {
    if (/Access Denied/i.test(html) && html.length < 20000) return true;
    if (/Just a moment|cf-browser-verification|challenge-platform/i.test(html) && html.length < 20000)
      return true;
    return false;
  }

  function tick() {
    chrome.storage.local.get(['ad_current'], function (res) {
      var cur = res.ad_current;
      if (!cur || cur.ind === undefined) return;
      var html = document.documentElement ? document.documentElement.outerHTML : '';
      if (looksOk(html)) {
        chrome.runtime.sendMessage({
          type: 'queue_save_html',
          ind: cur.ind,
          html: html,
          url: location.href,
        });
        return;
      }
      if (Date.now() - started > MAX_WAIT_MS) {
        if (looksBlocked(html) || html.length < 15000) {
          chrome.runtime.sendMessage({ type: 'reset' });
        }
        return;
      }
      // Still on challenge / loading — keep waiting
      setTimeout(tick, INTERVAL_MS);
    });
  }

  setTimeout(tick, 4000);
})();
