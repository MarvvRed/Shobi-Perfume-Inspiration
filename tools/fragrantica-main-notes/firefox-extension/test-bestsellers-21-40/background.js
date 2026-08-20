const BATCH = [
  { rank: 21, name: 'Essenza di Colonia', brand: 'Acqua di Parma', url: 'https://www.fragrantica.com/perfume/Acqua-di-Parma/Essenza-di-Colonia-9829.html' },
  { rank: 22, name: 'Neroli Portofino Forte', brand: 'Tom Ford', url: 'https://www.fragrantica.com/perfume/Tom-Ford/Neroli-Portofino-Forte-35575.html' },
  { rank: 23, name: 'Light Blue pour Homme Italian Love', brand: 'Dolce&Gabbana', url: 'https://www.fragrantica.com/perfume/Dolce-Gabbana/Light-Blue-pour-Homme-Italian-Love-72622.html' },
  { rank: 24, name: 'Rive Gauche pour Homme', brand: 'Yves Saint Laurent', url: 'https://www.fragrantica.com/perfume/Yves-Saint-Laurent/Rive-Gauche-pour-Homme-1032.html' },
  { rank: 25, name: 'French Riviera', brand: 'Mancera', url: 'https://www.fragrantica.com/perfume/Mancera/French-Riviera-74636.html' },
  { rank: 26, name: 'Beach Hut Man', brand: 'Amouage', url: 'https://www.fragrantica.com/perfume/Amouage/Beach-Hut-Man-46336.html' },
  { rank: 27, name: 'Narcotic Venus', brand: 'Nasomatto', url: 'https://www.fragrantica.com/perfume/Nasomatto/Narcotic-Venus-4292.html' },
  { rank: 28, name: 'Percival', brand: 'Parfums de Marly', url: 'https://www.fragrantica.com/perfume/Parfums-de-Marly/Percival-51037.html' },
  { rank: 29, name: 'Erba Pura', brand: 'Sospiro Perfumes', url: 'https://www.fragrantica.com/perfume/Sospiro-Perfumes/Erba-Pura-18652.html' },
  { rank: 30, name: "Bois d'Encens", brand: 'Giorgio Armani', url: 'https://www.fragrantica.com/perfume/Giorgio-Armani/Bois-d-Encens-406.html' },
  { rank: 31, name: 'Coco Noir', brand: 'Chanel', url: 'https://www.fragrantica.com/perfume/Chanel/Coco-Noir-15963.html' },
  { rank: 32, name: 'Gaiac 10 Tokyo', brand: 'Le Labo', url: 'https://www.fragrantica.com/perfume/Le-Labo/Gaiac-10-Tokyo-6335.html' },
  { rank: 33, name: 'Scandal By Night', brand: 'Jean Paul Gaultier', url: 'https://www.fragrantica.com/perfume/Jean-Paul-Gaultier/Scandal-By-Night-50715.html' },
  { rank: 34, name: 'Light Blue Eau Intense Pour Homme', brand: 'Dolce&Gabbana', url: 'https://www.fragrantica.com/perfume/Dolce-Gabbana/Light-Blue-Eau-Intense-Pour-Homme-44035.html' },
  { rank: 35, name: 'Illusione for Her', brand: 'Bottega Veneta', url: 'https://www.fragrantica.com/perfume/Bottega-Veneta/Illusione-for-Her-55300.html' },
  { rank: 36, name: 'Diaghilev', brand: 'Roja Dove', url: 'https://www.fragrantica.com/perfume/Roja-Dove/Diaghilev-10109.html' },
  { rank: 37, name: 'Boss Bottled Pacific', brand: 'Hugo Boss', url: 'https://www.fragrantica.com/perfume/Hugo-Boss/Boss-Bottled-Pacific-79762.html' },
  { rank: 38, name: 'Symphonium', brand: 'Xerjoff', url: 'https://www.fragrantica.com/perfume/Xerjoff/Symphonium-59707.html' },
  { rank: 39, name: 'Boss Alive Eau de Parfum', brand: 'Hugo Boss', url: 'https://www.fragrantica.com/perfume/Hugo-Boss/Boss-Alive-Eau-de-Parfum-59228.html' },
  { rank: 40, name: 'Tuberose Angelica', brand: 'Jo Malone London', url: 'https://www.fragrantica.com/perfume/Jo-Malone-London/Tuberose-Angelica-25069.html' }
];

const DEFAULT_STATE = { running: false, tabId: null, index: 0, results: {}, failures: [] };
async function getState() { const data = await browser.storage.local.get('collectorState'); return data.collectorState || { ...DEFAULT_STATE }; }
async function setState(state) { await browser.storage.local.set({ collectorState: state }); const count = Object.keys(state.results || {}).length; await browser.browserAction.setBadgeText({ text: state.running ? `${count}/20` : (count ? `${count}` : '') }); }
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
    const record = { schema_version: 1, catcher: 'test-catcher-0.3.10-bestsellers-21-40', target: target || null, payload };
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
  const saved = await sendToRunner({ source: 'firefox-extension', batch: 'bestsellers-21-40', target, payload });
  if (!saved.ok) return { ok: false, error: saved.error || 'GitHub save failed' };

  if (state.running && sender.tab && sender.tab.id === state.tabId && target && !state.results[String(target.rank)]) {
    state.results[String(target.rank)] = { rank: target.rank, name: target.name, status: 'captured', captured_at: payload.captured_at };
    await advance(state);
  }

  return { ok: true, file: saved.file, database: saved.database };
});
pingRunner();
