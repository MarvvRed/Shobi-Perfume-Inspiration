const BATCH = [
  { rank: 1, name: 'Vanilla 28', brand: 'Kayali Fragrances', url: 'https://www.fragrantica.com/perfume/Kayali-Fragrances/Vanilla-28-52616.html' },
  { rank: 2, name: "Angels' Share", brand: 'Kilian Paris', url: 'https://www.fragrantica.com/perfume/By-Kilian/Angels-Share-62615.html' },
  { rank: 3, name: 'Blanche', brand: 'Byredo', url: 'https://www.fragrantica.com/perfume/Byredo/Blanche-6686.html' },
  { rank: 4, name: 'Tobacco Vanille', brand: 'Tom Ford', url: 'https://www.fragrantica.com/perfume/Tom-Ford/Tobacco-Vanille-1825.html' },
  { rank: 5, name: 'The Muse', brand: 'ZARKOPERFUME', url: 'https://www.fragrantica.com/perfume/ZARKOPERFUME/The-Muse-60665.html' },
  { rank: 6, name: 'Baccarat Rouge 540', brand: 'Maison Francis Kurkdjian', url: 'https://www.fragrantica.com/perfume/Maison-Francis-Kurkdjian/Baccarat-Rouge-540-33519.html' },
  { rank: 7, name: 'Virgin Island Water', brand: 'Creed', url: 'https://www.fragrantica.com/perfume/Creed/Virgin-Island-Water-899.html' },
  { rank: 8, name: 'Lost Cherry', brand: 'Tom Ford', url: 'https://www.fragrantica.com/perfume/Tom-Ford/Lost-Cherry-51411.html' },
  { rank: 9, name: 'Devotion', brand: 'Dolce&Gabbana', url: 'https://www.fragrantica.com/perfume/Dolce-Gabbana/Devotion-84951.html' },
  { rank: 10, name: "Cheirosa '62", brand: 'Sol de Janeiro', url: 'https://www.fragrantica.com/perfume/Sol-de-Janeiro/Cheirosa-62-56062.html' }
];

const DEFAULT_STATE = { running: false, tabId: null, index: 0, results: {}, failures: [] };
async function getState() { const data = await browser.storage.local.get('collectorState'); return data.collectorState || { ...DEFAULT_STATE }; }
async function setState(state) { await browser.storage.local.set({ collectorState: state }); const count = Object.keys(state.results || {}).length; await browser.browserAction.setBadgeText({ text: state.running ? `${count}/10` : (count ? `${count}` : '') }); }
async function pingRunner() { try { const res = await fetch('http://127.0.0.1:8765/health', { cache: 'no-store' }); const ok = res.ok; await browser.storage.local.set({ bridgeStatus: { ok, at: new Date().toISOString(), status: res.status } }); await browser.browserAction.setBadgeText({ text: ok ? 'BR' : '!' }); console.log('SHOBI_BRIDGE_PING', ok ? 'OK' : 'FAIL', res.status); return ok; } catch (error) { await browser.storage.local.set({ bridgeStatus: { ok: false, at: new Date().toISOString(), error: String(error) } }); await browser.browserAction.setBadgeText({ text: '!' }); console.error('SHOBI_BRIDGE_PING_ERROR', error); return false; } }
async function sendToRunner(payload) {
  try {
    const res = await fetch('http://127.0.0.1:8765/capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const text = await res.text();
    let body = {};
    try { body = text ? JSON.parse(text) : {}; } catch {}
    console.log('SHOBI_CAPTURE_POST', res.status, body);
    if (!res.ok || body.ok === false) return { ok: false, error: body.error || `bridge HTTP ${res.status}` };
    return { ok: true, file: body.file || null, database: body.database || null };
  } catch (error) {
    console.error('SHOBI_CAPTURE_POST_ERROR', error);
    return { ok: false, error: String(error?.message || error) };
  }
}
function safeFilename(value) { return String(value || 'capture').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'capture'; }
async function downloadCapture(target, payload) {
  try {
    const record = { schema_version: 1, catcher: 'official-catcher-0.3.8', target: target || null, payload };
    const json = JSON.stringify(record, null, 2);
    const url = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
    const rank = target?.rank ? String(target.rank).padStart(2, '0') + '-' : '';
    const name = safeFilename(target?.name || payload?.perfume);
    await browser.downloads.download({ url, filename: `shobi-catcher/${rank}${name}.json`, saveAs: false, conflictAction: 'overwrite' });
    console.log('SHOBI_CAPTURE_DOWNLOADED', rank + name);
  } catch (error) { console.error('SHOBI_CAPTURE_DOWNLOAD_ERROR', error); }
}
async function startBatch() { const state = { ...DEFAULT_STATE, running: true, started_at: new Date().toISOString() }; const tab = await browser.tabs.create({ url: BATCH[0].url, active: true }); state.tabId = tab.id; await setState(state); }
async function advance(state) { state.index += 1; if (state.index >= BATCH.length) { state.running = false; await setState(state); return; } await setState(state); await new Promise(r => setTimeout(r, 1200)); await browser.tabs.update(state.tabId, { url: BATCH[state.index].url, active: true }); }
browser.browserAction.onClicked.addListener(async () => { const state = await getState(); if (!state.running) await startBatch(); });
browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message.type === 'diagnostic') { console.log('SHOBI_DIAG', message.stage, message.detail || '', message.url || ''); return; }
  if (message.type === 'page-error') { console.error('SHOBI_PAGE_ERROR', message.error, message.url || ''); return; }
  if (message.type === 'installed') { console.log('SHOBI_PAGE_CATCHER_INSTALLED', message.url || ''); await pingRunner(); return; }
  if (message.type !== 'capture') return;

  console.log('SHOBI_CAPTURE_RECEIVED', message.payload?.perfume || '', message.payload?.notes?.length || 0);
  const payload = message.payload;
  const state = await getState();
  const target = BATCH.find(x => x.url === payload.url) || BATCH[state.index];

  await downloadCapture(target, payload);
  const saved = await sendToRunner({ source: 'firefox-extension', batch: 'bestsellers-1-10', target, payload });
  if (!saved.ok) return { ok: false, error: saved.error || 'GitHub save failed' };

  if (state.running && sender.tab && sender.tab.id === state.tabId && target && !state.results[String(target.rank)]) {
    state.results[String(target.rank)] = { rank: target.rank, name: target.name, status: 'captured', captured_at: payload.captured_at };
    await advance(state);
  }

  return { ok: true, file: saved.file, database: saved.database };
});
pingRunner();
