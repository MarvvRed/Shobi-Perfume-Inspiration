(() => {
  if (window.__shobiMainNotesPageCatcher) return;
  window.__shobiMainNotesPageCatcher = true;

  const VERSION = '0.3.8';
  const emit = (type, detail = {}) => window.postMessage({ source: 'shobi-main-notes-page', type, ...detail }, '*');
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function ensureStatusBadge() {
    let el = document.getElementById('__shobi-catcher-status');
    if (el) return el;
    el = document.createElement('div');
    el.id = '__shobi-catcher-status';
    Object.assign(el.style, {
      position: 'fixed', right: '16px', bottom: '16px', zIndex: '2147483647',
      padding: '10px 14px', borderRadius: '10px', font: '600 13px/1.35 Arial, sans-serif',
      color: '#111827', background: '#fde68a', border: '1px solid rgba(0,0,0,.18)',
      boxShadow: '0 4px 14px rgba(0,0,0,.22)', maxWidth: '360px'
    });
    (document.body || document.documentElement).appendChild(el);
    return el;
  }

  function setStatus(kind, text) {
    const el = ensureStatusBadge();
    el.style.background = kind === 'ok' ? '#bbf7d0' : kind === 'error' ? '#fecaca' : '#fde68a';
    el.textContent = text;
  }

  window.addEventListener('message', event => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.source !== 'shobi-main-notes-extension' || msg.type !== 'save-result') return;
    if (msg.ok) setStatus('ok', `🟢 Catcher ${VERSION}: Saved to GitHub — ${msg.notes || 0} note${msg.notes === 1 ? '' : 's'}`);
    else setStatus('error', `🔴 Catcher ${VERSION}: GitHub save failed — ${msg.error || 'bridge unavailable'}`);
  });

  emit('diagnostic', { stage: 'page-catcher-boot', detail: `readyState=${document.readyState}` });

  function findVoteToggle() {
    return [...document.querySelectorAll('button,a,[role="button"],span,div')].filter(el => {
      const t = clean(el.textContent), a = clean(el.getAttribute?.('aria-label')), title = clean(el.getAttribute?.('title'));
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
    const all = [...root.querySelectorAll('*')], idx = all.indexOf(link);
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
      const id = noteId(link), key = id != null ? `id:${id}` : `name:${name.toLowerCase()}`;
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
      const votes = Number(m[1].replace(/[^0-9]/g, '')), name = clean(m[2]);
      if (!Number.isFinite(votes) || votes <= 0 || !name || name.length > 80) continue;
      const id = noteId(link), level = levelForLink(link, root), key = id != null ? `id:${id}` : `name:${name.toLowerCase()}`;
      const candidate = { note: name, sastojak_id: id, votes, pyramid_level: level }, previous = best.get(key);
      if (!previous || candidate.votes > previous.votes) best.set(key, candidate);
    }
    return [...best.values()].sort((a, b) => b.votes - a.votes || a.note.localeCompare(b.note)).map((n, i) => ({ rank: i + 1, note: n.note, sastojak_id: n.sastojak_id, votes: n.votes, weight: null, percentage: null, pyramid_level: n.pyramid_level }));
  }

  function sendCapture(notes, method, totalVotedNotes = null) {
    setStatus('working', `🟡 Catcher ${VERSION}: Saving to GitHub…`);
    emit('capture', { payload: { perfume: document.querySelector('h1')?.innerText?.trim() || document.title, url: location.href.split('#')[0], capture_method: method, captured_at: new Date().toISOString(), total_voted_notes: totalVotedNotes, saved_note_count: notes.length, weights_sum: null, notes } });
  }

  async function run() {
    if (document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
    setStatus('working', `🟡 Catcher ${VERSION}: Capturing…`);
    await sleep(1200);
    const buttons = findVoteToggle();
    emit('diagnostic', { stage: 'vote-toggle-found', detail: `count=${buttons.length}; states=${buttons.slice(0,4).map(b => clean(b.textContent)).join(' | ')}` });
    if (!buttons.length) { setStatus('error', `🔴 Catcher ${VERSION}: Error — vote control not found`); emit('diagnostic', { stage: 'vote-toggle-missing', detail: 'No Show votes / Hide votes control found' }); return; }
    const btn = buttons[0], root = findNotesRoot(btn);
    if (!root) { setStatus('error', `🔴 Catcher ${VERSION}: Error — notes block not found`); emit('diagnostic', { stage: 'notes-root-missing', detail: 'Fragrance notes block not found' }); return; }
    const plainNotes = parsePlainNotes(root);
    emit('diagnostic', { stage: 'plain-notes-scan', detail: `found=${plainNotes.length}; ${plainNotes.map(n => n.note).join(' | ')}` });
    const stateText = clean(btn.textContent).toLowerCase();
    if (/^hide\s+votes$/.test(stateText)) emit('diagnostic', { stage: 'votes-already-visible', detail: 'Hide votes detected; parsing without clicking' });
    else {
      try { btn.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch {}
      await sleep(250);
      try { btn.click(); } catch (e) { setStatus('error', `🔴 Catcher ${VERSION}: Error — Show votes failed`); emit('page-error', { error: `Show votes click: ${String(e)}` }); return; }
      emit('diagnostic', { stage: 'show-votes-clicked' });
    }
    let ranked = [];
    for (let attempt = 1; attempt <= 8; attempt++) {
      await sleep(attempt === 1 ? 700 : 350);
      ranked = parseVotedNotes(root);
      emit('diagnostic', { stage: 'votes-scan', detail: `attempt=${attempt};found=${ranked.length}; ${ranked.slice(0, 8).map(n => `${n.note}=${n.votes}`).join(' | ')}` });
      const enoughForSmallSet = plainNotes.length >= 1 && plainNotes.length <= 5 && ranked.length >= plainNotes.length;
      if (enoughForSmallSet || ranked.length >= 5) break;
    }
    if (ranked.length) {
      const saved = ranked.slice(0, 5).map((n, i) => ({ ...n, rank: i + 1 }));
      const method = plainNotes.length >= 1 && plainNotes.length <= 5 ? 'votes-all-notes-when-five-or-fewer' : 'show-votes-top5';
      emit('diagnostic', { stage: 'top5-ready', detail: `available=${ranked.length};saved=${saved.length}; ` + saved.map(n => `#${n.rank} ${n.note}=${n.votes}`).join(' | ') });
      sendCapture(saved, method, ranked.length); return;
    }
    if (plainNotes.length >= 1 && plainNotes.length <= 5) {
      emit('diagnostic', { stage: 'under5-fallback', detail: `votes unavailable; available=${plainNotes.length};saved=${plainNotes.length}; ${plainNotes.map(n => `#${n.rank} ${n.note}`).join(' | ')}` });
      sendCapture(plainNotes, 'all-notes-when-five-or-fewer-no-votes-fallback', null); return;
    }
    setStatus('error', `🔴 Catcher ${VERSION}: Error — no voted notes parsed`);
    emit('diagnostic', { stage: 'votes-finished', detail: 'No voted notes parsed' });
  }

  run().catch(e => { setStatus('error', `🔴 Catcher ${VERSION}: Error`); emit('page-error', { error: `Show votes top5 collector: ${String(e)}` }); });
  emit('installed');
})();
