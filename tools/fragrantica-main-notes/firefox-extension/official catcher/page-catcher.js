(() => {
  if (window.__shobiMainNotesPageCatcher) return;
  window.__shobiMainNotesPageCatcher = true;

  const emit = (type, detail = {}) => window.postMessage({ source: 'shobi-main-notes-page', type, ...detail }, '*');
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  emit('diagnostic', { stage: 'page-catcher-boot', detail: `readyState=${document.readyState}` });

  function findVoteToggle() {
    return [...document.querySelectorAll('button,a,[role="button"],span,div')].filter(el => {
      const t = clean(el.textContent);
      const a = clean(el.getAttribute?.('aria-label'));
      const title = clean(el.getAttribute?.('title'));
      return /^(show|hide)\s+votes$/i.test(t) || /(show|hide)\s+votes/i.test(a) || /(show|hide)\s+votes/i.test(title);
    });
  }

  function findNotesRoot(btn) {
    const candidates = [];
    let n = btn;
    for (let i = 0; n && i < 12; i++, n = n.parentElement) {
      const links = [...(n.querySelectorAll?.('a[href*="/notes/"]') || [])];
      if (!links.length) continue;
      const txt = clean(n.textContent).toLowerCase();
      const score = (txt.includes('fragrance notes') ? 0 : 10) + (txt.includes('perfume pyramid') ? 0 : 5) + links.length;
      candidates.push({ node: n, links: links.length, score });
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.score - b.score || a.links - b.links);
    return candidates[0].node;
  }

  function noteId(link) {
    const href = link.getAttribute('href') || '';
    const m = href.match(/\/notes\/[^/]*?(\d+)(?:\.html)?(?:[?#]|$)/i) || href.match(/(?:id=)(\d+)/i);
    return m ? Number(m[1]) : null;
  }

  function levelFromHeading(el) {
    const t = clean(el?.textContent).toLowerCase();
    if (/^top notes?$/.test(t)) return 'top';
    if (/^(middle|heart) notes?$/.test(t)) return 'middle';
    if (/^base notes?$/.test(t)) return 'base';
    return null;
  }

  function levelForLink(link, root) {
    const all = [...root.querySelectorAll('*')];
    const idx = all.indexOf(link);
    for (let i = idx - 1; i >= 0 && i > idx - 100; i--) {
      const level = levelFromHeading(all[i]);
      if (level) return level;
    }
    return null;
  }

  function plainNoteName(link) {
    let raw = clean(link.textContent) || clean(link.querySelector('img[alt]')?.alt) || clean(link.getAttribute('title'));
    if (!raw) return '';
    raw = raw.replace(/^\s*[0-9][0-9.,\s]*\s*(?=[^0-9])/, '');
    return clean(raw);
  }

  function parsePlainNotes(root) {
    const best = new Map();
    for (const link of root?.querySelectorAll?.('a[href*="/notes/"]') || []) {
      const name = plainNoteName(link);
      if (!name || name.length > 80 || /^notes?$/i.test(name)) continue;
      const id = noteId(link);
      const key = id != null ? `id:${id}` : `name:${name.toLowerCase()}`;
      if (best.has(key)) continue;
      best.set(key, { note: name, sastojak_id: id, votes: null, weight: null, percentage: null, pyramid_level: levelForLink(link, root) });
    }
    return [...best.values()].map((n, i) => ({ ...n, rank: i + 1 }));
  }

  function parseVotedNotes(root) {
    const best = new Map();
    for (const link of root?.querySelectorAll?.('a[href*="/notes/"]') || []) {
      const raw = clean(link.textContent) || clean(link.querySelector('img[alt]')?.alt) || clean(link.getAttribute('title'));
      if (!raw) continue;
      const m = raw.match(/^\s*([0-9][0-9.,\s]*)\s*([^0-9].*?)\s*$/);
      if (!m) continue;
      const votes = Number(m[1].replace(/[^0-9]/g, ''));
      const name = clean(m[2]);
      if (!Number.isFinite(votes) || votes <= 0 || !name || name.length > 80) continue;
      const id = noteId(link);
      const level = levelForLink(link, root);
      const key = id != null ? `id:${id}` : `name:${name.toLowerCase()}`;
      const candidate = { note: name, sastojak_id: id, votes, pyramid_level: level };
      const previous = best.get(key);
      if (!previous || candidate.votes > previous.votes) best.set(key, candidate);
    }
    return [...best.values()].sort((a, b) => b.votes - a.votes || a.note.localeCompare(b.note)).map((n, i) => ({ rank: i + 1, note: n.note, sastojak_id: n.sastojak_id, votes: n.votes, weight: null, percentage: null, pyramid_level: n.pyramid_level }));
  }

  function sendCapture(notes, method, totalVotedNotes = null) {
    emit('capture', { payload: { perfume: document.querySelector('h1')?.innerText?.trim() || document.title, url: location.href.split('#')[0], capture_method: method, captured_at: new Date().toISOString(), total_voted_notes: totalVotedNotes, saved_note_count: notes.length, weights_sum: null, notes } });
  }

  async function run() {
    if (document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
    await sleep(1200);
    const buttons = findVoteToggle();
    emit('diagnostic', { stage: 'vote-toggle-found', detail: `count=${buttons.length}; states=${buttons.slice(0,4).map(b => clean(b.textContent)).join(' | ')}` });
    if (!buttons.length) { emit('diagnostic', { stage: 'vote-toggle-missing', detail: 'No Show votes / Hide votes control found' }); return; }
    const btn = buttons[0];
    const root = findNotesRoot(btn);
    if (!root) { emit('diagnostic', { stage: 'notes-root-missing', detail: 'Fragrance notes block not found' }); return; }
    const plainNotes = parsePlainNotes(root);
    emit('diagnostic', { stage: 'plain-notes-scan', detail: `found=${plainNotes.length}; ${plainNotes.map(n => n.note).join(' | ')}` });
    if (plainNotes.length >= 1 && plainNotes.length <= 5) {
      emit('diagnostic', { stage: 'under5-ready', detail: `available=${plainNotes.length};saved=${plainNotes.length}; ${plainNotes.map(n => `#${n.rank} ${n.note}`).join(' | ')}` });
      sendCapture(plainNotes, 'all-notes-when-five-or-fewer', null); return;
    }
    const stateText = clean(btn.textContent).toLowerCase();
    if (/^hide\s+votes$/.test(stateText)) emit('diagnostic', { stage: 'votes-already-visible', detail: 'Hide votes detected; parsing without clicking' });
    else {
      try { btn.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch {}
      await sleep(250);
      try { btn.click(); } catch (e) { emit('page-error', { error: `Show votes click: ${String(e)}` }); return; }
      emit('diagnostic', { stage: 'show-votes-clicked' });
    }
    let ranked = [];
    for (let attempt = 1; attempt <= 8; attempt++) {
      await sleep(attempt === 1 ? 700 : 350);
      ranked = parseVotedNotes(root);
      emit('diagnostic', { stage: 'votes-scan', detail: `attempt=${attempt};found=${ranked.length}; ${ranked.slice(0, 8).map(n => `${n.note}=${n.votes}`).join(' | ')}` });
      if (ranked.length >= 1) break;
    }
    if (!ranked.length) { emit('diagnostic', { stage: 'votes-finished', detail: 'No voted notes parsed' }); return; }
    const top5 = ranked.slice(0, 5).map((n, i) => ({ ...n, rank: i + 1 }));
    emit('diagnostic', { stage: 'top5-ready', detail: `available=${ranked.length};saved=${top5.length}; ` + top5.map(n => `#${n.rank} ${n.note}=${n.votes}`).join(' | ') });
    sendCapture(top5, 'show-votes-top5', ranked.length);
  }

  run().catch(e => emit('page-error', { error: `Show votes top5 collector: ${String(e)}` }));
  emit('installed');
})();
