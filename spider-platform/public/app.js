/* Spider Platform UI */

const state = {
  spiders: [],
  runs: [],
  settings: {},
  editingSpiderId: null,
  logRunId: null,
  logSource: null,
  runFilter: '',
};

/* ------------------------------------------------------------------ utils */

const $ = (id) => document.getElementById(id);

async function api(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('not authenticated');
  }
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

/**
 * Always render in the platform timezone. Showing the viewer's local time would
 * mean a schedule entered as 03:00 UK appears as a different hour elsewhere.
 */
function fmtDateTime(iso) {
  if (!iso) return '—';
  const options = {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
  };
  if (state.settings.timezone) options.timeZone = state.settings.timezone;
  try {
    return new Date(iso).toLocaleString(undefined, options);
  } catch (e) {
    delete options.timeZone;
    return new Date(iso).toLocaleString(undefined, options);
  }
}

function fmtRelative(iso) {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const units = [
    ['day', 86400000], ['hour', 3600000], ['minute', 60000], ['second', 1000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === 'second') {
      const value = Math.round(diff / ms);
      return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(value, unit);
    }
  }
  return '';
}

function fmtDuration(ms) {
  if (!ms && ms !== 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i += 1; }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

// "upload_failed" means the crawl worked and only SFTP delivery failed, so it
// reads differently from a run that broke.
const STATUS_LABELS = { upload_failed: 'upload failed' };

function statusBadge(status, extraClass = '') {
  const pulse = status === 'running' ? '<span class="dot pulse"></span>' : '<span class="dot"></span>';
  const label = STATUS_LABELS[status] || status;
  return `<span class="badge ${status} ${extraClass}">${pulse}${esc(label)}</span>`;
}

function linesToList(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

function envToText(env) {
  return Object.entries(env || {}).map(([k, v]) => `${k}=${v}`).join('\n');
}

function textToEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function openModal(id) { $(id).hidden = false; }
function closeModal(id) {
  $(id).hidden = true;
  if (id === 'logModal') stopLogStream();
}

/* ---------------------------------------------------------------- rendering */

function renderSpiders() {
  const tbody = $('spiderRows');
  $('spiderEmpty').hidden = state.spiders.length > 0;
  $('spiderCount').textContent = state.spiders.length
    ? `${state.spiders.length} spider(s), ${state.spiders.filter((s) => s.running).length} running`
    : '';

  tbody.innerHTML = state.spiders.map((s) => {
    const schedule = s.schedule || {};
    const scheduleText = schedule.enabled
      ? `${esc(s.scheduleText)}<br><span class="muted">${esc(schedule.timezone || '')}</span>`
      : '<span class="muted">manual only</span>';
    const status = s.running ? statusBadge('running') : (s.enabled
      ? '<span class="badge idle"><span class="dot"></span>idle</span>'
      : '<span class="badge off"><span class="dot"></span>disabled</span>');
    const last = s.lastRun
      ? `${statusBadge(s.lastRun.status)}<br><span class="muted">${esc(fmtRelative(s.lastRun.startedAt))}</span>`
      : '<span class="muted">never</span>';
    const sftpText = s.sftp && s.sftp.enabled
      ? `<span class="mono">${esc(s.sftp.remoteDir || '—')}</span>`
      : '<span class="muted">off</span>';

    return `<tr>
      <td class="name-cell">
        <strong>${esc(s.name)}</strong>
        <span class="mono">${esc(s.slug)}${s.source === 'link' ? ' · linked' : ''}</span>
      </td>
      <td>${status}</td>
      <td>${scheduleText}</td>
      <td class="nowrap">${s.nextRun ? `${esc(fmtDateTime(s.nextRun))}<br><span class="muted">${esc(fmtRelative(s.nextRun))}</span>` : '<span class="muted">—</span>'}</td>
      <td>${last}</td>
      <td>${sftpText}</td>
      <td>
        <div class="actions">
          <button class="small primary" data-run="${s.id}" ${s.running ? 'disabled' : ''}>Run now</button>
          <button class="small" data-logs="${s.id}">Logs</button>
          <button class="small" data-edit="${s.id}">Edit</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderRuns() {
  const tbody = $('runRows');
  const runs = state.runs;
  $('runEmpty').hidden = runs.length > 0;

  tbody.innerHTML = runs.map((r) => {
    const files = (r.artifacts || []).length;
    const uploaded = (r.artifacts || []).filter((a) => a.uploaded).length;
    return `<tr>
      <td class="nowrap">${esc(fmtDateTime(r.startedAt || r.createdAt))}</td>
      <td>${esc(r.spiderName || r.spiderSlug)}</td>
      <td><span class="muted">${esc(r.trigger)}</span></td>
      <td>${statusBadge(r.status)}${r.error ? `<br><span class="muted">${esc(r.error.slice(0, 60))}</span>` : ''}</td>
      <td class="nowrap">${esc(fmtDuration(r.durationMs))}</td>
      <td class="mono">${r.exitCode === null || r.exitCode === undefined ? '<span class="muted">—</span>' : esc(String(r.exitCode))}</td>
      <td>${files ? `${files}${uploaded ? ` <span class="muted">(${uploaded} sent)</span>` : ''}` : '<span class="muted">—</span>'}</td>
      <td><div class="actions"><button class="small" data-log-run="${r.id}">Open</button></div></td>
    </tr>`;
  }).join('');

  const filter = $('runFilter');
  const current = filter.value;
  filter.innerHTML = '<option value="">All spiders</option>' +
    state.spiders.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
  filter.value = current;
}

async function refresh() {
  try {
    const data = await api('/api/state');
    state.spiders = data.spiders;
    state.settings = data.settings;
    state.chrome = data.chrome;
    renderSpiders();

    const query = state.runFilter ? `?spiderId=${encodeURIComponent(state.runFilter)}&limit=40` : '?limit=40';
    const runData = await api(`/api/runs${query}`);
    state.runs = runData.runs;
    renderRuns();

    const active = data.activeRuns.length;
    const queued = data.queuedRuns.length;
    $('topMeta').textContent = `${active} running${queued ? `, ${queued} queued` : ''}`;
  } catch (e) {
    if (e.message !== 'not authenticated') toast(e.message, 'error');
  }
}

/* ------------------------------------------------------------ spider editor */

function openSpiderEditor(spiderId) {
  const spider = state.spiders.find((s) => s.id === spiderId);
  if (!spider) return;
  state.editingSpiderId = spiderId;

  $('spiderModalTitle').textContent = spider.name;
  $('spName').value = spider.name || '';
  $('spCommand').value = spider.command || 'npm start';
  $('spTimeout').value = spider.timeoutMinutes || '';
  $('spOutputs').value = (spider.outputPatterns || []).join('\n');
  $('spEnabled').checked = !!spider.enabled;
  $('spDir').textContent = spider.dir;

  const schedule = spider.schedule || {};
  $('spSchedEnabled').checked = !!schedule.enabled;
  $('spRepeat').value = schedule.repeat || 'daily';
  setDays(schedule.days && schedule.days.length ? schedule.days : [1, 2, 3, 4, 5]);
  $('spDate').value = schedule.date || '';
  $('spTime').value = schedule.time || '03:00';
  updateScheduleSummary();

  $('spEnv').value = envToText(spider.env);

  const sftp = spider.sftp || {};
  $('spSftpEnabled').checked = !!sftp.enabled;
  $('spRemoteDir').value = sftp.remoteDir || '';
  $('sftpResult').textContent = '';
  $('replaceResult').textContent = '';
  $('spArchive').value = '';
  $('spFolder').value = '';
  $('spPicked').textContent = 'Nothing chosen yet.';

  switchTab('general');
  openModal('spiderModal');
}

function dayBoxes() {
  return Array.from($('spDays').querySelectorAll('input[data-day]'));
}

function setDays(days) {
  const wanted = new Set((days || []).map(Number));
  for (const box of dayBoxes()) box.checked = wanted.has(Number(box.dataset.day));
}

function currentScheduleInput() {
  return {
    enabled: $('spSchedEnabled').checked,
    repeat: $('spRepeat').value,
    days: dayBoxes().filter((b) => b.checked).map((b) => Number(b.dataset.day)),
    date: $('spDate').value,
    time: $('spTime').value,
  };
}

async function updateScheduleSummary() {
  const summary = $('scheduleSummary');
  const schedule = currentScheduleInput();

  // Weekly picks its own days; a date is only meaningful for a monthly repeat
  // or a single run.
  $('spDaysField').hidden = schedule.repeat !== 'weekly';
  $('spDateField').hidden = schedule.repeat !== 'monthly' && schedule.repeat !== 'once';
  $('spDateHint').textContent =
    schedule.repeat === 'once'
      ? 'The single day this spider runs.'
      : 'The day of the month this repeats on.';

  if (!schedule.enabled) {
    summary.textContent = 'This spider runs only when you press "Run now".';
    return;
  }
  try {
    const result = await api('/api/validate-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedule),
    });
    summary.innerHTML = result.valid
      ? `<span style="color:var(--green)">${esc(result.description)} — next run ${esc(fmtDateTime(result.nextRun))}` +
        ` (${esc(state.settings.timezone || '')})</span>`
      : `<span style="color:var(--red)">${esc(result.error)}</span>`;
  } catch (e) {
    summary.innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`;
  }
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach((p) => { p.hidden = p.dataset.panel !== name; });
}

async function saveSpider() {
  const id = state.editingSpiderId;
  if (!id) return;
  const payload = {
    name: $('spName').value,
    command: $('spCommand').value,
    enabled: $('spEnabled').checked,
    timeoutMinutes: $('spTimeout').value ? parseInt($('spTimeout').value, 10) : null,
    outputPatterns: linesToList($('spOutputs').value),
    env: textToEnv($('spEnv').value),
    schedule: currentScheduleInput(),
    sftp: {
      enabled: $('spSftpEnabled').checked,
      remoteDir: $('spRemoteDir').value.trim(),
    },
  };
  try {
    await api(`/api/spiders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    toast('Spider saved', 'success');
    closeModal('spiderModal');
    refresh();
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* --------------------------------------------------------------- log viewer */

function stopLogStream() {
  if (state.logSource) {
    state.logSource.close();
    state.logSource = null;
  }
}

function appendLog(text) {
  const view = $('logView');
  const follow = $('logFollow').checked;
  view.textContent += text;
  if (follow) view.scrollTop = view.scrollHeight;
}

function renderRunStatus(run) {
  const exit =
    run.exitCode === null || run.exitCode === undefined
      ? ''
      : ` &nbsp; exit code <span class="mono">${esc(String(run.exitCode))}</span>`;
  // A failed delivery is amber, not red: the data is there and can be resent.
  const errorColor = run.status === 'upload_failed' ? 'var(--amber)' : 'var(--red)';
  $('logStatus').innerHTML =
    `${statusBadge(run.status)} &nbsp; started ${esc(fmtDateTime(run.startedAt))} &nbsp;` +
    `duration ${esc(fmtDuration(run.durationMs))}${exit}` +
    (run.error ? ` &nbsp; <span style="color:${errorColor}">${esc(run.error)}</span>` : '');

  $('btnCancelRun').disabled = !['running', 'queued'].includes(run.status);
  $('btnReupload').disabled = !(run.artifacts || []).length;

  $('logArtifacts').innerHTML = (run.artifacts || []).length
    ? `<strong style="font-size:12px;color:var(--muted)">FILES</strong>` +
      run.artifacts.map((a) => `<div class="file-row">
        <a href="/api/runs/${esc(run.id)}/artifacts/${encodeURIComponent(a.storedName)}">${esc(a.name)}</a>
        <span class="muted">${esc(fmtBytes(a.size))}</span>
        ${a.uploaded ? `<span class="badge success"><span class="dot"></span>sent</span><span class="muted mono">${esc(a.remote || '')}</span>` : ''}
      </div>`).join('')
    : '<span class="muted">No output files were collected.</span>';
}

async function openRunLog(runId) {
  state.logRunId = runId;
  $('logView').textContent = '';
  openModal('logModal');

  try {
    const run = await api(`/api/runs/${runId}`);
    $('logTitle').textContent = `${run.spiderName || run.spiderSlug} — ${run.id}`;
    renderRunStatus(run);
  } catch (e) {
    toast(e.message, 'error');
    return;
  }

  stopLogStream();
  const source = new EventSource(`/api/runs/${runId}/stream`);
  state.logSource = source;
  source.addEventListener('log', (e) => appendLog(JSON.parse(e.data)));
  source.addEventListener('status', (e) => {
    const run = JSON.parse(e.data);
    renderRunStatus(run);
    refresh();
  });
  source.onerror = () => { /* browser retries automatically */ };
}

async function openLatestLogFor(spiderId) {
  try {
    const data = await api(`/api/runs?spiderId=${encodeURIComponent(spiderId)}&limit=1`);
    if (!data.runs.length) return toast('This spider has not run yet', 'error');
    openRunLog(data.runs[0].id);
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ------------------------------------------------------------------ actions */

async function runSpider(spiderId) {
  try {
    const run = await api(`/api/spiders/${spiderId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    toast('Run queued', 'success');
    refresh();
    openRunLog(run.id);
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ------------------------------------------------------------ adding spiders */

// Reinstalled or regenerated on the platform; a spider's data/ alone can hold
// hundreds of thousands of checkpoint files.
const SKIP_UPLOAD = /(^|\/)(node_modules|\.git|\.cache|data|logs|archive|chrome_profile|dist|coverage|\.DS_Store)(\/|$)|\.log$/;

// Past this, the browser struggles and the folder is almost certainly not just code.
const MAX_UPLOAD_FILES = 3000;

function fmtBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** What the user picked: a folder, a ZIP, or nothing. */
function codeSelection(zipId, folderId) {
  const zip = $(zipId).files[0];
  if (zip) return { kind: 'zip', zip, bytes: zip.size, rootName: zip.name.replace(/\.zip$/i, '') };

  const all = Array.from($(folderId).files || []);
  const files = all.filter((f) => !SKIP_UPLOAD.test(f.webkitRelativePath || f.name));
  if (!files.length) return { kind: 'none' };
  const rootName = (files[0].webkitRelativePath || '').split('/')[0] || '';
  return {
    kind: 'folder',
    files,
    bytes: files.reduce((total, f) => total + f.size, 0),
    skipped: all.length - files.length,
    rootName,
  };
}

function uploadLimitBytes() {
  return (state.settings.maxUploadMb || 300) * 1024 * 1024;
}

function describeSelection(zipId, folderId, labelId) {
  const selection = codeSelection(zipId, folderId);
  const el = $(labelId);
  el.style.color = '';
  if (selection.kind === 'none') {
    el.textContent = 'Nothing chosen yet.';
  } else if (selection.kind === 'zip') {
    el.textContent = `${selection.zip.name} (${fmtBytes(selection.bytes)})`;
    if (selection.bytes > uploadLimitBytes()) {
      el.style.color = 'var(--red)';
      el.textContent += ` — over the ${state.settings.maxUploadMb || 300} MB limit. A ZIP this big normally`
        + ' contains data/ and node_modules; use "Choose folder…" instead, which sends only the code.';
    }
  } else {
    const skipped = selection.skipped
      ? `, ${selection.skipped} skipped (node_modules, data, logs)`
      : '';
    el.textContent = `${selection.rootName}/ — ${selection.files.length} files, ${fmtBytes(selection.bytes)}${skipped}`;
    if (selection.files.length > MAX_UPLOAD_FILES) {
      el.style.color = 'var(--red)';
      el.textContent += ` — too many files. Zip the code instead, or use the folder path option below.`;
    }
  }
  return selection;
}

/** POST a FormData with upload progress; fetch() cannot report it. */
function postForm(url, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    });
    xhr.addEventListener('load', () => {
      if (xhr.status === 401) {
        window.location.href = '/login';
        return reject(new Error('not authenticated'));
      }
      let body = {};
      try { body = JSON.parse(xhr.responseText); } catch (e) { /* non-JSON error page */ }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body);
      reject(new Error(body.error || `request failed (${xhr.status})`));
    });
    xhr.addEventListener('error', () => reject(new Error('connection lost during upload')));
    xhr.addEventListener('abort', () => reject(new Error('upload cancelled')));
    xhr.send(form);
  });
}

/** Text fields must be appended before the files so the server sees them first. */
function buildCodeForm(selection, extra = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(extra)) form.append(key, value);
  if (selection.kind === 'zip') {
    form.append('archive', selection.zip);
    return form;
  }
  form.append('relativePaths', JSON.stringify(selection.files.map((f) => f.webkitRelativePath || f.name)));
  for (const file of selection.files) form.append('files', file, file.name);
  return form;
}

function installSummary(result) {
  const warnings = (result.warnings || []).map((w) => `• ${esc(w)}`).join('<br>');
  const failed = result.install && result.install.ok === false;
  return (warnings ? `${warnings}<br>` : '') +
    (failed ? '<span style="color:var(--red)">npm install failed — open the spider and check the Code tab</span>' : '');
}

/** Reassure the user while the server unpacks and runs npm install. */
function installTicker(labelId) {
  const started = Date.now();
  const tick = () => {
    const seconds = Math.round((Date.now() - started) / 1000);
    $(labelId).textContent = `Installing dependencies… ${seconds}s (this can take a couple of minutes)`;
  };
  tick();
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
}

/** Refuse hopeless uploads locally instead of sending gigabytes to be rejected. */
function rejectedLocally(selection) {
  if (selection.kind === 'folder' && selection.files.length > MAX_UPLOAD_FILES) {
    toast(`${selection.files.length} files is too many — zip the code, or add the folder by path`, 'error');
    return true;
  }
  if (selection.bytes > uploadLimitBytes()) {
    toast(`${fmtBytes(selection.bytes)} is over the ${state.settings.maxUploadMb || 300} MB limit — use "Choose folder…", which skips data/ and node_modules`, 'error');
    return true;
  }
  return false;
}

async function uploadSpider() {
  const selection = codeSelection('upFile', 'upFolder');
  if (selection.kind === 'none') return toast('Choose the spider folder or a ZIP first', 'error');
  if (rejectedLocally(selection)) return;

  $('btnDoUpload').disabled = true;
  let stopTicker = () => {};
  try {
    const form = buildCodeForm(selection, { name: $('upName').value.trim() });
    const result = await postForm('/api/spiders', form, (ratio) => {
      if (ratio < 1) {
        $('upResult').textContent = `Uploading… ${Math.round(ratio * 100)}%`;
      } else {
        stopTicker();
        stopTicker = installTicker('upResult');
      }
    });
    $('upResult').innerHTML = `<span style="color:var(--green)">Added ${esc(result.spider.name)}.</span><br>` +
      installSummary(result);
    toast('Spider added', 'success');
    refresh();
  } catch (e) {
    $('upResult').innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`;
  } finally {
    stopTicker();
    $('btnDoUpload').disabled = false;
  }
}

async function linkFolder() {
  const dir = $('linkDir').value.trim();
  if (!dir) return toast('Enter the folder path', 'error');
  try {
    const result = await api('/api/spiders/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir, name: $('upName').value.trim() }),
    });
    const warnings = (result.warnings || []).map((w) => `• ${w}`).join('<br>');
    $('upResult').innerHTML = `<span style="color:var(--green)">Added ${esc(result.spider.name)}.</span>` +
      (warnings ? `<br>${warnings}` : '');
    toast('Spider added', 'success');
    refresh();
  } catch (e) {
    $('upResult').innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`;
  }
}

async function replaceCode() {
  const selection = codeSelection('spArchive', 'spFolder');
  if (selection.kind === 'none') return toast('Choose the spider folder or a ZIP first', 'error');
  if (rejectedLocally(selection)) return;

  $('btnReplaceCode').disabled = true;
  let stopTicker = () => {};
  try {
    const form = buildCodeForm(selection);
    const result = await postForm(`/api/spiders/${state.editingSpiderId}/archive`, form, (ratio) => {
      if (ratio < 1) {
        $('replaceResult').textContent = `Uploading… ${Math.round(ratio * 100)}%`;
      } else {
        stopTicker();
        stopTicker = installTicker('replaceResult');
      }
    });
    $('replaceResult').innerHTML = '<span style="color:var(--green)">Updated.</span>' +
      (result.restored && result.restored.length ? ` Kept: ${esc(result.restored.join(', '))}` : '');
    refresh();
  } catch (e) {
    $('replaceResult').innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`;
  } finally {
    stopTicker();
    $('btnReplaceCode').disabled = false;
  }
}

async function deleteSpider() {
  const spider = state.spiders.find((s) => s.id === state.editingSpiderId);
  if (!spider) return;
  const withFiles = spider.source !== 'link';
  const message = withFiles
    ? `Delete "${spider.name}" and its files? Archived results and logs are kept.`
    : `Unregister "${spider.name}"? The linked folder stays untouched.`;
  if (!window.confirm(message)) return;
  try {
    await api(`/api/spiders/${spider.id}?deleteFiles=${withFiles ? '1' : '0'}`, { method: 'DELETE' });
    toast('Spider removed', 'success');
    closeModal('spiderModal');
    refresh();
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* -------------------------------------------------------------------- wiring */

document.addEventListener('click', (e) => {
  const target = e.target.closest('button, [data-close]');
  if (!target) return;

  if (target.dataset.close) return closeModal(target.dataset.close);
  if (target.dataset.run) return runSpider(target.dataset.run);
  if (target.dataset.edit) return openSpiderEditor(target.dataset.edit);
  if (target.dataset.logs) return openLatestLogFor(target.dataset.logs);
  if (target.dataset.logRun) return openRunLog(target.dataset.logRun);
  if (target.dataset.tab) return switchTab(target.dataset.tab);
});

document.querySelectorAll('.overlay').forEach((overlay) => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

$('btnAddSpider').addEventListener('click', () => {
  $('upResult').textContent = '';
  $('upName').value = '';
  $('upFile').value = '';
  $('upFolder').value = '';
  $('linkDir').value = '';
  $('upPicked').textContent = 'Nothing chosen yet.';
  openModal('uploadModal');
});

// The file inputs are hidden so the two ways of choosing code look the same.
$('btnPickFolder').addEventListener('click', () => { $('upFile').value = ''; $('upFolder').click(); });
$('btnPickZip').addEventListener('click', () => { $('upFolder').value = ''; $('upFile').click(); });
for (const id of ['upFolder', 'upFile']) {
  $(id).addEventListener('change', () => {
    const selection = describeSelection('upFile', 'upFolder', 'upPicked');
    if (!$('upName').value.trim() && selection.rootName) $('upName').value = selection.rootName;
  });
}

$('btnPickCodeFolder').addEventListener('click', () => { $('spArchive').value = ''; $('spFolder').click(); });
$('btnPickCodeZip').addEventListener('click', () => { $('spFolder').value = ''; $('spArchive').click(); });
for (const id of ['spFolder', 'spArchive']) {
  $(id).addEventListener('change', () => describeSelection('spArchive', 'spFolder', 'spPicked'));
}

$('btnDoUpload').addEventListener('click', uploadSpider);
$('btnDoLink').addEventListener('click', linkFolder);
$('btnSaveSpider').addEventListener('click', saveSpider);
$('btnReplaceCode').addEventListener('click', replaceCode);
$('btnDeleteSpider').addEventListener('click', deleteSpider);

for (const id of ['spSchedEnabled', 'spRepeat', 'spDate', 'spTime']) {
  $(id).addEventListener('change', updateScheduleSummary);
}
$('spDays').addEventListener('change', updateScheduleSummary);

for (const [id, days] of [
  ['spDaysWeekdays', [1, 2, 3, 4, 5]],
  ['spDaysAll', [0, 1, 2, 3, 4, 5, 6]],
  ['spDaysNone', []],
]) {
  $(id).addEventListener('click', () => {
    setDays(days);
    updateScheduleSummary();
  });
}

$('btnTestSftp').addEventListener('click', async () => {
  $('sftpResult').textContent = 'Connecting…';
  try {
    await saveSftpSettings();
    const result = await api(`/api/spiders/${state.editingSpiderId}/test-sftp`, { method: 'POST' });
    $('sftpResult').innerHTML = `<span style="color:var(--green)">OK — ${esc(result.remoteDir)} (${result.entries} entries)</span>`;
  } catch (e) {
    $('sftpResult').innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`;
  }
});

/** The connection test runs server-side, so the folder must be saved first. */
async function saveSftpSettings() {
  await api(`/api/spiders/${state.editingSpiderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sftp: {
        enabled: $('spSftpEnabled').checked,
        remoteDir: $('spRemoteDir').value.trim(),
      },
    }),
  });
}

$('btnCancelRun').addEventListener('click', async () => {
  try {
    await api(`/api/runs/${state.logRunId}/cancel`, { method: 'POST' });
    toast('Cancellation requested');
  } catch (e) {
    toast(e.message, 'error');
  }
});

$('btnReupload').addEventListener('click', async () => {
  try {
    await api(`/api/runs/${state.logRunId}/reupload`, { method: 'POST' });
    toast('Upload finished', 'success');
    const run = await api(`/api/runs/${state.logRunId}`);
    renderRunStatus(run);
  } catch (e) {
    toast(e.message, 'error');
  }
});

$('btnSettings').addEventListener('click', () => {
  $('setConcurrency').value = state.settings.maxConcurrentRuns;
  $('setTimezone').value = state.settings.timezone;
  $('setChrome').textContent = `Chrome: ${state.chrome || 'not found — set CHROME in .env'}`;
  openModal('settingsModal');
});

$('btnSaveSettings').addEventListener('click', async () => {
  try {
    await api('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        maxConcurrentRuns: $('setConcurrency').value,
        timezone: $('setTimezone').value,
      }),
    });
    toast('Settings saved', 'success');
    closeModal('settingsModal');
    refresh();
  } catch (e) {
    toast(e.message, 'error');
  }
});

$('btnLogout').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
});

$('runFilter').addEventListener('change', (e) => {
  state.runFilter = e.target.value;
  refresh();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.overlay:not([hidden])').forEach((o) => closeModal(o.id));
});

refresh();
setInterval(refresh, 10000);
