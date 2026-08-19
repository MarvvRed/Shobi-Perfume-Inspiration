(() => {
  if (window.__shobiMainNotesPageCatcher) return;
  window.__shobiMainNotesPageCatcher = true;

  const emit = (type, detail = {}) => window.postMessage({ source: 'shobi-main-notes-page', type, ...detail }, '*');
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const sent = new Set();

  emit('diagnostic', { stage: 'page-catcher-boot', detail: `readyState=${document.readyState}` });

  function noteName(link) {
    const img = link.querySelector('img[alt]');
    let name = clean(link.textContent) || clean(img?.alt) || clean(link.getAttribute('title'));
    return name.replace(/^(top|middle|heart|base) notes?\s*/i, '').trim();
  }

  function noteId(link) {
    const href = link.getAttribute('href') || '';
    const m = href.match(/\/notes\/[^/]*?(\d+)(?:\.html)?(?:[?#]|$)/i) || href.match(/(?:id=)(\d+)/i);
    return m ? Number(m[1]) : null;
  }

  function headingLevel(el) {
    const t = clean(el?.textContent).toLowerCase();
    if (/^top notes?$/.test(t)) return 'top';
    if (/^(middle|heart) notes?$/.test(t)) return 'middle';
    if (/^base notes?$/.test(t)) return 'base';
    return null;
  }

  function findPyramidRoot() {
    const headings = [...document.querySelectorAll('h2,h3,h4,h5,h6,strong,b,div,span')];
    const pyramidHeading = headings.find(el => {
      const t = clean(el.textContent).toLowerCase();
      return t === 'perfume pyramid' || t === 'fragrance notes';
    });
    if (!pyramidHeading) return null;

    let node = pyramidHeading;
    for (let i = 0; node && i < 8; i++, node = node.parentElement) {
      const links = node.querySelectorAll?.('a[href*="/notes/"]') || [];
      const text = clean(node.textContent).toLowerCase();
      const hasLevels = /top notes?|middle notes?|heart notes?|base notes?/.test(text);
      if (links.length >= 2 && hasLevels) return node;
    }
    return pyramidHeading.parentElement;
  }

  function levelForLink(link, root) {
    let node = link;
    for (let depth = 0; node && node !== root && depth < 10; depth++, node = node.parentElement) {
      let prev = node.previousElementSibling;
      for (let i = 0; prev && i < 6; i++, prev = prev.previousElementSibling) {
        const direct = headingLevel(prev);
        if (direct) return direct;
        const nestedHeading = [...prev.querySelectorAll?.('h2,h3,h4,h5,h6,strong,b,div,span') || []].reverse().find(headingLevel);
        if (nestedHeading) return headingLevel(nestedHeading);
      }
    }

    const all = [...root.querySelectorAll('*')];
    const idx = all.indexOf(link);
    for (let i = idx - 1; i >= 0 && i > idx - 80; i--) {
      const level = headingLevel(all[i]);
      if (level) return level;
    }
    return null;
  }

  function extractPyramidNotes() {
    const root = findPyramidRoot();
    if (!root) return { root: null, notes: [] };

    const links = [...root.querySelectorAll('a[href*="/notes/"]')];
    const notes = [];
    const seen = new Set();

    for (const link of links) {
      const name = noteName(link);
      if (!name || name.length > 60 || /^notes?$/i.test(name)) continue;
      const level = levelForLink(link, root);
      if (!level) continue;
      const key = `${name.toLowerCase()}|${level}`;
      if (seen.has(key)) continue;
      seen.add(key);
      notes.push({
        rank: notes.length + 1,
        note: name,
        sastojak_id: noteId(link),
        weight: null,
        percentage: null,
        pyramid_level: level
      });
    }
    return { root, notes };
  }

  function capture(notes, reason) {
    if (notes.length < 2) return false;
    const sig = notes.map(n => `${n.note}:${n.pyramid_level}`).join('|');
    if (sent.has(sig)) return true;
    sent.add(sig);
    emit('diagnostic', { stage: 'pyramid-candidate', detail: `notes=${notes.length};reason=${reason};names=${notes.map(n => `${n.note}[${n.pyramid_level}]`).join(' | ')}` });
    emit('capture', { payload: {
      perfume: document.querySelector('h1')?.innerText?.trim() || document.title,
      url: location.href.split('#')[0],
      capture_method: 'dom-perfume-pyramid',
      weights_sum: null,
      captured_at: new Date().toISOString(),
      notes
    }});
    return true;
  }

  async function run() {
    if (document.readyState === 'loading') await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    for (let attempt = 1; attempt <= 10; attempt++) {
      await sleep(attempt === 1 ? 1000 : 700);
      const { root, notes } = extractPyramidNotes();
      emit('diagnostic', { stage: 'pyramid-scan', detail: `attempt=${attempt};root=${!!root};notes=${notes.length}` });
      if (capture(notes, `attempt-${attempt}`)) return;
      try { root?.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch {}
    }
    emit('diagnostic', { stage: 'pyramid-finished', detail: 'no capture' });
  }

  run().catch(error => emit('page-error', { error: `Pyramid collector: ${String(error)}` }));
  emit('installed');
})();
