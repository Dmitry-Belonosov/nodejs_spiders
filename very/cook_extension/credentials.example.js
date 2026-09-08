// Local-only credentials for this extension.
//
// Chrome extensions cannot read environment variables, so the proxy password
// lives here instead of in background.js. Fill it in before loading the
// extension via chrome://extensions, and keep this file out of version control.
var PROXY_PASSWORD = '';
