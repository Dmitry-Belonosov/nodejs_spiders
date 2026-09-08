const state = {
  parsers: [],
  runs: [],
  parsersRoot: '',
  logRunId: null,
  logSource: null,
};

const $ = (id) => document.getElementById(id);

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) throw new Error((body && body.error) || `request failed (${res.status})`);
  return body;
}

function toast(message, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), kind === 'error' ? 8000 : 4000);
}

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function fmtDuration(ms) {
  if (!ms && ms !== 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const STATUS_LABELS = { upload_failed: 'upload failed' };

function statusBadge(status) {
  const pulse = status === 'running' ? ' pulse' : '';
  const label = STATUS_LABELS[status] || status || 'idle';
  return `<span class="badge ${esc(status || 'idle')}"><span class="dot${pulse}"></span>${esc(label)}</span>`;
}

function parserSettings(parser) {
  return parser.settings || { network: 'vpn', tabs: 10, windows: 2 };
}

function renderCards() {
  $('empty').hidden = state.parsers.length > 0;
  $('cards').innerHTML = state.parsers.map((p) => {
    const s = parserSettings(p);
    const running = p.running;
    const last = p.lastRun
      ? statusBadge(p.lastRun.status)
      : statusBadge('idle');
    return `<article class="card${running ? ' running' : ''}" data-parser="${esc(p.id)}">
      <div class="card-top">
        <div>
          <h2>${esc(p.name)}</h2>
          <div class="path">${esc(p.dir)}</div>
        </div>
        ${running ? statusBadge('running') : last}
      </div>
      <div class="field">
        <label>Network</label>
        <div class="seg">
          <button type="button" class="${s.network !== 'proxyrack' ? 'active vpn' : ''}" data-network="vpn">VPN</button>
          <button type="button" class="${s.network === 'proxyrack' ? 'active proxy' : ''}" data-network="proxyrack">ProxyRack</button>
        </div>
      </div>
      <div class="nums">
        <div class="field">
          <label>Tabs / window</label>
          <input type="number" min="1" max="30" value="${esc(s.tabs)}" data-field="tabs" />
        </div>
        <div class="field">
          <label>Chrome windows</label>
          <input type="number" min="1" max="8" value="${esc(s.windows)}" data-field="windows" />
        </div>
      </div>
      <div class="card-actions">
        ${running
          ? `<button class="danger" data-stop="${esc(p.lastRun && p.lastRun.id || '')}">Stop</button>`
          : `<button class="primary" data-run="${esc(p.id)}">Start</button>`}
        <button class="small" data-logs="${esc(p.id)}" ${p.lastRun ? '' : 'disabled'}>Logs</button>
      </div>
    </article>`;
  }).join('');
}

function renderRuns() {
  const rows = $('runRows');
  $('runEmpty').hidden = state.runs.length > 0;
  rows.innerHTML = state.runs.map((r) => {
    const files = (r.artifacts || []).length;
    const uploaded = (r.artifacts || []).filter((a) => a.uploaded).length;
    const layout = r.windows && r.tabs ? `${r.windows}×${r.tabs}` : '—';
    return `<tr>
      <td class="nowrap">${esc(fmtDateTime(r.startedAt || r.createdAt))}</td>
      <td>${esc(r.parserName || r.parserSlug)}</td>
      <td>${esc(r.network === 'proxyrack' ? 'ProxyRack' : 'VPN')}</td>
      <td class="mono">${esc(layout)}</td>
      <td>${statusBadge(r.status)}${r.error ? `<div class="muted">${esc(r.error.slice(0, 80))}</div>` : ''}</td>
      <td class="nowrap">${esc(fmtDuration(r.durationMs))}</td>
      <td>${files ? `${files}${uploaded ? ` <span class="muted">(${uploaded} sent)</span>` : ''}` : '<span class="muted">—</span>'}</td>
      <td><button class="small" data-log-run="${esc(r.id)}">Open</button></td>
    </tr>`;
  }).join('');
}

function readCardSettings(card) {
  return {
    network: card.querySelector('[data-network].active') ? card.querySelector('[data-network].active').dataset.network : 'vpn',
    tabs: parseInt(card.querySelector('[data-field="tabs"]').value, 10) || 10,
    windows: parseInt(card.querySelector('[data-field="windows"]').value, 10) || 2,
  };
}

async function saveCard(parserId, patch) {
  await api(`/api/parsers/${encodeURIComponent(parserId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

async function refresh() {
  const data = await api('/api/state');
  state.parsers = data.parsers || [];
  state.runs = data.runs || [];
  state.parsersRoot = data.parsersRoot || '';
  const running = state.parsers.filter((p) => p.running).length;
  $('topMeta').textContent = `${state.parsers.length} parser${state.parsers.length === 1 ? '' : 's'} in ${state.parsersRoot}${running ? ` · ${running} running` : ''}`;
  const editing = document.activeElement && document.activeElement.matches('[data-field]');
  if (!editing) renderCards();
  renderRuns();
}

function stopLogStream() {
  if (state.logSource) {
    state.logSource.close();
    state.logSource = null;
  }
  state.logRunId = null;
}

function openLog(run) {
  stopLogStream();
  state.logRunId = run.id;
  $('logTitle').textContent = run.parserName || run.parserSlug || 'Log';
  $('logSub').textContent = `${run.network === 'proxyrack' ? 'ProxyRack' : 'VPN'} · ${run.windows || '?'}×${run.tabs || '?'} · ${run.status}`;
  $('logBody').textContent = '';
  $('btnRetryUpload').hidden = run.status !== 'upload_failed';
  $('logModal').hidden = false;

  const source = new EventSource(`/api/runs/${run.id}/stream`);
  state.logSource = source;
  source.addEventListener('log', (ev) => {
    try {
      const chunk = JSON.parse(ev.data);
      $('logBody').textContent += chunk;
      $('logBody').scrollTop = $('logBody').scrollHeight;
    } catch (e) { /* ignore */ }
  });
  source.addEventListener('status', (ev) => {
    try {
      const fresh = JSON.parse(ev.data);
      $('logSub').textContent = `${fresh.network === 'proxyrack' ? 'ProxyRack' : 'VPN'} · ${fresh.windows || '?'}×${fresh.tabs || '?'} · ${fresh.status}`;
      $('btnRetryUpload').hidden = fresh.status !== 'upload_failed';
      refresh().catch(() => {});
    } catch (e) { /* ignore */ }
  });
}

document.body.addEventListener('click', async (ev) => {
  const close = ev.target.closest('[data-close]');
  if (close) {
    $(close.dataset.close).hidden = true;
    if (close.dataset.close === 'logModal') stopLogStream();
    return;
  }

  const netBtn = ev.target.closest('[data-network]');
  if (netBtn) {
    const card = netBtn.closest('[data-parser]');
    card.querySelectorAll('[data-network]').forEach((b) => b.classList.remove('active', 'vpn', 'proxy'));
    netBtn.classList.add('active', netBtn.dataset.network === 'proxyrack' ? 'proxy' : 'vpn');
    saveCard(card.dataset.parser, readCardSettings(card)).catch((e) => toast(e.message, 'error'));
    return;
  }

  const runBtn = ev.target.closest('[data-run]');
  if (runBtn) {
    const card = runBtn.closest('[data-parser]');
    const settings = readCardSettings(card);
    runBtn.disabled = true;
    try {
      await saveCard(card.dataset.parser, settings);
      const { run } = await api(`/api/parsers/${encodeURIComponent(card.dataset.parser)}/run`, {
        method: 'POST',
        body: JSON.stringify(settings),
      });
      await refresh();
      openLog(run);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      runBtn.disabled = false;
    }
    return;
  }

  const stopBtn = ev.target.closest('[data-stop]');
  if (stopBtn && stopBtn.dataset.stop) {
    try {
      await api(`/api/runs/${encodeURIComponent(stopBtn.dataset.stop)}/cancel`, { method: 'POST' });
      await refresh();
    } catch (e) {
      toast(e.message, 'error');
    }
    return;
  }

  const logsBtn = ev.target.closest('[data-logs]');
  if (logsBtn) {
    const parser = state.parsers.find((p) => p.id === logsBtn.dataset.logs);
    const run = parser && parser.lastRun && state.runs.find((r) => r.id === parser.lastRun.id);
    if (run) openLog(run);
    return;
  }

  const logRunBtn = ev.target.closest('[data-log-run]');
  if (logRunBtn) {
    const run = state.runs.find((r) => r.id === logRunBtn.dataset.logRun);
    if (run) openLog(run);
  }
});

document.body.addEventListener('change', (ev) => {
  const field = ev.target.closest('[data-field]');
  if (!field) return;
  const card = field.closest('[data-parser]');
  saveCard(card.dataset.parser, readCardSettings(card)).catch((e) => toast(e.message, 'error'));
});

$('btnRefresh').addEventListener('click', () => {
  refresh().catch((e) => toast(e.message, 'error'));
});

$('btnSftp').addEventListener('click', async () => {
  try {
    const result = await api('/api/sftp/test', { method: 'POST' });
    toast(`SFTP ok — ${result.remoteDir} (${result.entries} entries)`, 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
});

$('btnRetryUpload').addEventListener('click', async () => {
  if (!state.logRunId) return;
  try {
    await api(`/api/runs/${encodeURIComponent(state.logRunId)}/reupload`, { method: 'POST' });
    toast('CSV uploaded', 'success');
    await refresh();
  } catch (e) {
    toast(e.message, 'error');
  }
});

refresh()
  .then(() => setInterval(() => refresh().catch(() => {}), 4000))
  .catch((e) => toast(e.message, 'error'));
