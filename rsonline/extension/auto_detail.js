/**
 * Navigation-based scraper for uk.rs-online.com.
 * Background drives the queue; this script saves HTML after each product page loads.
 */
(function () {
  var SAVE_DELAY_MS = 8000;

  function looksLikeProduct(html) {
    return (
      html.length > 20000 &&
      (html.indexOf("application/ld+json") !== -1 ||
        html.indexOf("product_page_price") !== -1 ||
        html.indexOf('"@type":"Product"') !== -1 ||
        html.indexOf('"@type": "Product"') !== -1)
    );
  }

  function looksBlocked(html) {
    return (
      html.length < 20000 &&
      (/Access Denied/i.test(html) ||
        /Permission to access/i.test(html) ||
        /_abck/i.test(html) && html.length < 5000)
    );
  }

  function trySave() {
    chrome.storage.local.get(["rs_current"], function (res) {
      var cur = res.rs_current;
      if (!cur || cur.ind === undefined) return;

      var html = document.documentElement
        ? document.documentElement.outerHTML
        : document.body
        ? document.body.innerHTML
        : "";

      if (looksLikeProduct(html)) {
        chrome.runtime.sendMessage(
          { type: "queue_save", ind: cur.ind, html: html },
          function () {}
        );
      } else if (looksBlocked(html)) {
        chrome.runtime.sendMessage({ type: "reset" }, function () {});
      } else {
        // soft retry once
        setTimeout(function () {
          html = document.documentElement.outerHTML;
          if (looksLikeProduct(html)) {
            chrome.runtime.sendMessage(
              { type: "queue_save", ind: cur.ind, html: html },
              function () {}
            );
          } else {
            chrome.runtime.sendMessage({ type: "reset" }, function () {});
          }
        }, 5000);
      }
    });
  }

  // Only act on product URLs
  if (location.href.indexOf("/web/p/") !== -1) {
    setTimeout(trySave, SAVE_DELAY_MS);
  }
})();
