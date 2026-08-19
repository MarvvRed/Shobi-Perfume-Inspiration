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

async function getState() {
  const data = await browser.storage.local.get('collectorState');
  return data.collectorState || { ...DEFAULT_STATE };
}

async function setState(state) {
  await browser.storage.local.set({ collectorState: state });
  const count = Object.keys(state.results || {}).length;
  await browser.browserAction.setBadgeText({ text: state.running ? `${count}/10` : (count ? `${count}` : '') });
}

async function sendToRunner(payload) {
  try {
    const res = await fetch('http://127.0.0.1:8765/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function startBatch() {
  const state = { ...DEFAULT_STATE, running: true, started_at: new Date().toISOString() };
  const tab = await browser.tabs.create({ url: BATCH[0].url, active: true });
  state.tabId = tab.id;
  await setState(state);
}

async function advance(state) {
  state.index += 1;
  if (state.index >= BATCH.length) {
    state.running = false;
    await setState(state);
    return;
  }
  await setState(state);
  await new Promise(r => setTimeout(r, 1200));
  await browser.tabs.update(state.tabId, { url: BATCH[state.index].url, active: true });
}

browser.browserAction.onClicked.addListener(async () => {
  const state = await getState();
  if (!state.running) await startBatch();
});

browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message.type !== 'capture') return;

  const payload = message.payload;
  const state = await getState();
  const target = BATCH.find(x => x.url === payload.url) || BATCH[state.index];

  await sendToRunner({
    source: 'firefox-extension',
    batch: 'bestsellers-1-10',
    target,
    payload
  });

  if (!state.running || !sender.tab || sender.tab.id !== state.tabId || !target) return;
  if (state.results[String(target.rank)]) return;

  state.results[String(target.rank)] = { rank: target.rank, name: target.name, status: 'captured', captured_at: payload.captured_at };
  await advance(state);
});
