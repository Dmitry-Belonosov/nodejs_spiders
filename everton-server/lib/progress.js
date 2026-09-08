/**
 * Poll queue /status and write human-readable progress lines.
 */
const axios = require('axios');

async function fetchStatus(serverBase) {
  const res = await axios.get(`${serverBase}/status`, { timeout: 15000 });
  return res.data;
}

function formatStatus(st) {
  if (!st || st.total == null) return 'status unavailable';
  const pct = st.total ? Math.round((st.progress / st.total) * 100) : 0;
  return (
    `progress ${st.progress}/${st.total} (${pct}%) | pending ${st.pending} | ` +
    `products ${st.products}`
  );
}

function isComplete(st, minUrls) {
  if (!st || !st.total) return false;
  if (st.pending !== 0) return false;
  if (st.progress < st.total) return false;
  if (minUrls && st.total < minUrls) return false;
  return true;
}

module.exports = { fetchStatus, formatStatus, isComplete };
