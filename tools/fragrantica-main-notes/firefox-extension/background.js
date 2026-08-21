const DEFAULT_STATE = { running: false, tabId: null, index: 0, results: {}, failures: [], batch: null, targets: [] };

async function getState() {
  const data = await browser.storage.local.get('collectorState');
  return data.collectorState || { ...DEFAULT_STATE };
}

async function setState(state) {
  await browser.storage.local.set({ collectorState: state });
  const count = Object.keys(state.results || {}).length;
  const total = (state.targets || []).length;
  await browser.browserAction.setBadgeText({ text: state.running ? `${count}/${total}` : (count ? `${count}` : '') });
}

async function bridgeJson(path, options = {}) {
  const res = await fetch(`http://127.0.0.1:8765${path}`, { cache: 'no-store', ...options });
  const text = await res.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch {}
  if (!res.ok || body.ok === false) throw new Error(body.error || `bridge HTTP ${res.status}`);
  return body;
}

async function pingRunner() {
  try {
    const body = await bridgeJson('/health');
    await browser.storage.local.set({ bridgeStatus: { ok: true, at: new Date().toISOString() } });
    console.log('SHOBI_BRIDGE_PING OK', body);
    return true;
  } catch (error) {
    await browser.storage.local.set({ bridgeStatus: { ok: false, at: new Date().toISOString(), error: String(error) } });
    console.error('SHOBI_BRIDGE_PING_ERROR', error);
    return false;
  }
}

async function fetchQueue() {
  const body = await bridgeJson('/targets');
  const targets = Array.isArray(body.targets) ? body.targets.filter(x => x && x.url) : [];
  return { batch: body.batch || 'dynamic', autoStart: body.auto_start !== false, targets };
}

async function sendToRunner(payload) {
  try {
    return await bridgeJson('/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('SHOBI_CAPTURE_POST_ERROR', error);
    return { ok: false, error: String(error?.message || error) };
  }
}

async function startBatch(force = false) {
  const queue = await fetchQueue();
  if (!queue.targets.length) {
    console.log('SHOBI_QUEUE_EMPTY');
    return false;
  }

  let state = await getState();
  if (state.running && !force) return true;

  const sameBatch = state.batch === queue.batch;
  const results = sameBatch ? (state.results || {}) : {};
  let index = 0;
  while (index < queue.targets.length && results[String(queue.targets[index].rank)]) index++;
  if (index >= queue.targets.length) {
    await setState({ ...DEFAULT_STATE, batch: queue.batch, targets: queue.targets, results, running: false });
    console.log('SHOBI_QUEUE_ALREADY_COMPLETE', queue.batch);
    return true;
  }

  const tab = await browser.tabs.create({ url: queue.targets[index].url, active: true });
  state = { ...DEFAULT_STATE, running: true, tabId: tab.id, index, results, batch: queue.batch, targets: queue.targets, started_at: new Date().toISOString() };
  await setState(state);
  console.log('SHOBI_QUEUE_STARTED', queue.batch, index + 1, '/', queue.targets.length);
  return true;
}

async function advance(state) {
  state.index += 1;
  while (state.index < state.targets.length && state.results[String(state.targets[state.index].rank)]) state.index += 1;
  if (state.index >= state.targets.length) {
    state.running = false;
    state.completed_at = new Date().toISOString();
    await setState(state);
    console.log('SHOBI_QUEUE_COMPLETE', state.batch);
    return;
  }
  await setState(state);
  await new Promise(r => setTimeout(r, 1500));
  await browser.tabs.update(state.tabId, { url: state.targets[state.index].url, active: true });
}

browser.browserAction.onClicked.addListener(async () => {
  try { await startBatch(true); } catch (e) { console.error('SHOBI_START_ERROR', e); }
});

browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message.type === 'diagnostic') {
    console.log('SHOBI_DIAG', message.stage, message.detail || '', message.url || '');
    return;
  }
  if (message.type === 'page-error') {
    console.error('SHOBI_PAGE_ERROR', message.error, message.url || '');
    const state = await getState();
    if (state.running && state.targets[state.index]) {
      state.failures.push({ rank: state.targets[state.index].rank, url: state.targets[state.index].url, error: message.error, at: new Date().toISOString() });
      await setState(state);
    }
    return;
  }
  if (message.type === 'installed') {
    console.log('SHOBI_PAGE_CATCHER_INSTALLED', message.url || '');
    return;
  }
  if (message.type !== 'capture') return;

  const payload = message.payload;
  const state = await getState();
  const target = (state.targets || []).find(x => x.url === payload.url) || state.targets?.[state.index];
  if (!target) return { ok: false, error: 'No dynamic target matched capture' };

  const saved = await sendToRunner({ source: 'firefox-extension', batch: state.batch || 'dynamic', target, payload });
  if (!saved.ok) return saved;

  if (state.running && sender.tab && sender.tab.id === state.tabId && !state.results[String(target.rank)]) {
    state.results[String(target.rank)] = { rank: target.rank, name: target.name, status: 'captured', captured_at: payload.captured_at };
    await advance(state);
  }
  return { ok: true, file: saved.file, database: saved.database };
});

async function autoStartLoop() {
  for (;;) {
    try {
      const ok = await pingRunner();
      if (ok) {
        const q = await fetchQueue();
        const state = await getState();
        if (q.autoStart && q.targets.length && !state.running) await startBatch(false);
      }
    } catch (e) {
      console.error('SHOBI_AUTOSTART_ERROR', e);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
}

autoStartLoop();
