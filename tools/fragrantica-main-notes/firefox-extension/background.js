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

const DEFAULT_STATE = {
  running: false,
  tabId: null,
  index: 0,
  started_at: null,
  results: {},
  failures: []
};

async function getState() {
  const data = await browser.storage.local.get('collectorState');
  return data.collectorState || { ...DEFAULT_STATE };
}

async function setState(state) {
  await browser.storage.local.set({ collectorState: state });
  await updateBadge(state);
}

async function updateBadge(state) {
  const count = Object.keys(state.results || {}).length;
  await browser.browserAction.setBadgeText({ text: state.running ? `${count}/10` : (count ? `${count}` : '') });
}

async function startBatch() {
  let state = { ...DEFAULT_STATE, running: true, started_at: new Date().toISOString() };
  const tab = await browser.tabs.create({ url: BATCH[0].url, active: true });
  state.tabId = tab.id;
  await setState(state);
}

async function advance(state) {
  state.index += 1;
  if (state.index >= BATCH.length) {
    state.running = false;
    await setState(state);
    await exportResults(state);
    return;
  }

  await setState(state);
  await new Promise(resolve => setTimeout(resolve, 1600));
  await browser.tabs.update(state.tabId, { url: BATCH[state.index].url, active: true });
}

async function exportResults(state) {
  const ordered = BATCH.map(target => {
    const hit = Object.values(state.results).find(r => r.rank === target.rank);
    return hit || { ...target, status: 'failed' };
  });

  const output = {
    batch: 'bestsellers-1-10',
    generated_at: new Date().toISOString(),
    captured: ordered.filter(x => x.status === 'captured').length,
    failed: ordered.filter(x => x.status !== 'captured').length,
    results: ordered,
    failures: state.failures || []
  };

  const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  await browser.downloads.download({
    url,
    filename: 'shobi-fragrantica-bestsellers-1-10.json',
    saveAs: false
  });
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

browser.browserAction.onClicked.addListener(async () => {
  const state = await getState();
  if (state.running) return;
  await startBatch();
});

browser.runtime.onMessage.addListener(async (message, sender) => {
  const state = await getState();
  if (!state.running) return;
  if (!sender.tab || sender.tab.id !== state.tabId) return;

  const target = BATCH[state.index];
  if (!target) return;

  if (message.type === 'capture') {
    const payload = message.payload;
    const existing = state.results[String(target.rank)];
    if (existing) return;

    state.results[String(target.rank)] = {
      rank: target.rank,
      name: target.name,
      brand: target.brand,
      fragrantica_url: target.url,
      status: 'captured',
      perfume: payload.perfume,
      url: payload.url,
      weights_sum: payload.weights_sum,
      captured_at: payload.captured_at,
      notes: payload.notes
    };

    await advance(state);
  }

  if (message.type === 'page-error') {
    state.failures.push({
      rank: target.rank,
      name: target.name,
      error: message.error,
      at: new Date().toISOString()
    });
    await setState(state);
  }
});

browser.tabs.onRemoved.addListener(async tabId => {
  const state = await getState();
  if (state.running && state.tabId === tabId) {
    state.running = false;
    state.failures.push({ error: 'Collector tab was closed by the user', at: new Date().toISOString() });
    await setState(state);
  }
});

updateBadge(DEFAULT_STATE);
