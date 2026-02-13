const OPENBOOK_TRACE_ID = `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
let openbookActionSeq = 0;

function nextActionId(action = 'ui') {
  openbookActionSeq += 1;
  return `${action}-${openbookActionSeq}`;
}

async function obFetch(url, options = {}, meta = {}) {
  const action = meta.action || 'api';
  const actionId = meta.actionId || nextActionId(action);
  const headers = {
    ...(options.headers || {}),
    'x-openbook-trace-id': OPENBOOK_TRACE_ID,
    'x-openbook-action-id': actionId
  };

  return fetch(url, { ...options, headers });
}

async function obGetJson(url, meta = {}) {
  const res = await obFetch(url, { method: 'GET' }, meta);
  return res.json();
}

async function obGetText(url, meta = {}) {
  const res = await obFetch(url, { method: 'GET' }, meta);
  return res.text();
}

function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function copyNoteMD(title, link, time, desc) {
  const md = `### ${title}\n- Time: ${time}\n${link ? `- Link: ${link}\n` : ''}\n${desc}`;
  navigator.clipboard.writeText(md).then(() => showToast('Copied MD'));
}

function openInReader(link) {
  if (!link) return;
  switchToReaderView();
  location.hash = 'open=' + encodeURIComponent(link);
}

async function apiPost(url, body, meta = {}) {
  return obFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }, { action: meta.action || 'post', ...meta }).then(r => r.json());
}

function sanitizeHtml(html) {
  return DOMPurify.sanitize(html, { FORBID_TAGS: ['script', 'iframe'], FORBID_ATTR: ['onerror', 'onclick'] });
}

function summarizeActivity(it) {
  const p = it.payload || {};
  if (it.type === 'state') {
    return p.isFavorite ? 'Added to favorites' : '';
  }
  if (it.type === 'note') {
    let content = p.content || p.title || 'Note saved';
    if (window.innerWidth <= 768 && content.length > 200) {
      content = content.substring(0, 197) + '...';
    }
    return content;
  }
  return '';
}

function openNoteEditor() {
  document.getElementById('noteEditor').classList.add('active');
}

function closeNoteEditor() {
  document.getElementById('noteEditor').classList.remove('active');
  document.getElementById('noteTextarea').value = '';
}

function toggleActivityPanel(force) {
  const p = document.getElementById('activityPanel');
  const show = typeof force === 'boolean' ? force : p.style.display !== 'flex';
  p.style.display = show ? 'flex' : 'none';
  if (show) refreshActivityLog();
}

async function refreshActivityLog() {
  const res = await obGetJson('/api/activity?limit=20', { action: 'activity-panel' });
  const list = document.getElementById('activityPanelList');
  list.innerHTML = '';
  (res.items || []).forEach(it => {
    const title = it.article?.title || it.payload?.title || 'Activity';
    const desc = summarizeActivity(it);
    const li = document.createElement('li');
    li.className = 'activity-panel-item';
    li.innerHTML = `<b>${it.type.toUpperCase()}</b>: ${title}<br/><small style="color:var(--text-muted)"></small>`;
    li.querySelector('small').textContent = desc;
    list.appendChild(li);
  });
}

async function copyWeekly() {
  const md = await obGetText('/api/export/markdown?days=7', { action: 'notes-copy-weekly' });
  navigator.clipboard.writeText(md).then(() => showToast('Copied Weekly'));
}

function exportWeekly() {
  window.open('/api/export/markdown?days=7', '_blank');
}
