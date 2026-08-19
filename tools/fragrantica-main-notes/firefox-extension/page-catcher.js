(() => {
  if (window.__shobiMainNotesPageCatcher) return;
  window.__shobiMainNotesPageCatcher = true;

  const emit = (type, detail = {}) => window.postMessage({ source: 'shobi-main-notes-page', type, ...detail }, '*');
  emit('diagnostic', { stage: 'page-catcher-boot', detail: `readyState=${document.readyState}` });

  const sent = new Set();
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const levelFromText = text => {
    const t = clean(text).toLowerCase();
    if (t.includes('top note')) return 'top';
    if (t.includes('middle note') || t.includes('heart note')) return 'middle';
    if (t.includes('base note')) return 'base';
    return null;
  };

  function nearestLevel(el) {
    let node = el;
    for (let i = 0; node && i < 8; i++, node = node.parentElement) {
      const direct = levelFromText(node.previousElementSibling?.textContent || '') || levelFromText(node.parentElement?.previousElementSibling?.textContent || '');
      if (direct) return direct;
      const txt = clean(node.textContent || '');
      if (txt.length < 120) {
        const own = levelFromText(txt);
        if (own) return own;
      }
    }
    return null;
  }

  function extractDomNotes() {
    const found = [];
    const seenNames = new Set();

    const candidates = [
      ...document.querySelectorAll('a[href*="/notes/"]'),
      ...document.querySelectorAll('img[alt]')
    ];

    for (const el of candidates) {
      const a = el.matches?.('a') ? el : el.closest?.('a');
      const href = a?.getAttribute?.('href') || '';
      const isNoteLink = href.includes('/notes/');
      const img = el.matches?.('img') ? el : el.querySelector?.('img[alt]');
      let name = clean(a?.textContent || '') || clean(img?.alt || '') || clean(el.getAttribute?.('title') || '');
      name = name.replace(/^(top|middle|heart|base) notes?\s*/i, '').trim();
      if (!name || name.length > 60) continue;
      if (!isNoteLink && !img) continue;
      if (/^(search|logo|facebook|instagram|youtube|pinterest)$/i.test(name)) continue;
      const key = name.toLowerCase();
      if (seenNames.has(key)) continue;
      seenNames.add(key);
      found.push({
        rank: found.length + 1,
        note: name,
        sastojak_id: null,
        weight: null,
        percentage: null,
        pyramid_level: nearestLevel(a || el)
      });
    }

    return found;
  }

  function emitDomCapture(notes, reason) {
    if (!Array.isArray(notes) || notes.length < 2) return false;
    const sig = notes.map(n => `${n.note}:${n.pyramid_level || ''}`).join('|');
    if (sent.has(sig)) return true;
    sent.add(sig);
    emit('diagnostic', { stage: 'dom-candidate', detail: `notes=${notes.length};reason=${reason};names=${notes.slice(0, 12).map(n => n.note).join(' | ')}` });
    emit('capture', {
      payload: {
        perfume: document.querySelector('h1')?.innerText?.trim() || document.title,
        url: location.href.split('#')[0],
        capture_method: 'dom-rendered-notes',
        weights_sum: null,
        captured_at: new Date().toISOString(),
        notes
      }
    });
    return true;
  }

  async function runDomCollector() {
    if (document.readyState === 'loading') await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    await sleep(1000);

    for (let attempt = 1; attempt <= 8; attempt++) {
      const notes = extractDomNotes();
      emit('diagnostic', { stage: 'dom-scan', detail: `attempt=${attempt};notes=${notes.length}` });
      if (emitDomCapture(notes, `attempt-${attempt}`)) return;

      const heading = [...document.querySelectorAll('h2,h3,h4,h5,strong,b,div,span')].find(el => {
        const t = clean(el.textContent).toLowerCase();
        return t && t.length < 80 && (t.includes('perfume pyramid') || t === 'notes' || t.includes('fragrance notes'));
      });
      try { heading?.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch {}
      await sleep(1200);
    }

    const h = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
    for (let y = 0; y < h; y += Math.max(500, Math.floor(window.innerHeight * 0.8))) {
      window.scrollTo(0, y);
      await sleep(500);
      const notes = extractDomNotes();
      if (emitDomCapture(notes, `scroll-${y}`)) return;
    }
    window.scrollTo(0, 0);
    emit('diagnostic', { stage: 'dom-finished', detail: 'no capture' });
  }

  runDomCollector().catch(error => emit('page-error', { error: `DOM collector: ${String(error)}` }));
  emit('installed');
})();
