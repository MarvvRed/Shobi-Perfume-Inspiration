// Visual verification + shared card cleanup for Official Catcher Best Seller cards.
(function () {
  function escText(v) { return String(v || '').trim(); }

  function ensureSeasonLabel(card) {
    const labels = { spring: 'Spring', summer: 'Summer', fall: 'Fall', autumn: 'Autumn', winter: 'Winter' };
    card.querySelectorAll('[data-card-filter="season"]').forEach(btn => {
      const key = escText(btn.dataset.filterValue).toLowerCase();
      const label = labels[key];
      if (!label || escText(btn.textContent).toLowerCase().includes(label.toLowerCase())) return;
      const span = document.createElement('span');
      span.className = 'catcher-season-label';
      span.textContent = label;
      span.style.fontSize = '16px';
      btn.appendChild(span);
    });
  }

  function prepareCard(card) {
    if (!card) return '';
    ensureSeasonLabel(card);
    const details = card.querySelector('[data-action="show-details"][data-code]');
    if (details && !card.dataset.catcherCode) card.dataset.catcherCode = escText(details.dataset.code);
    card.querySelectorAll('[data-action="show-details"][data-code]').forEach(el => el.remove());
    const firstNote = card.querySelector('[data-card-filter="note"]');
    const noteHost = firstNote && firstNote.parentElement;
    if (noteHost && !card.querySelector('.catcher-main-notes-label')) {
      const label = document.createElement('div');
      label.className = 'catcher-main-notes-label font-semibold text-primary text-left';
      label.textContent = 'Main Notes';
      label.style.cssText = 'font-size:14px;line-height:1.2;margin-bottom:-4px;';
      noteHost.parentElement.insertBefore(label, noteHost);
    }
    return card.dataset.catcherCode || '';
  }

  function noteNames(card) {
    return Array.from(card.querySelectorAll('[data-card-filter="note"]')).map(el => escText(el.dataset.filterValue)).filter(Boolean);
  }

  function sameNotes(expected, actual) {
    return expected.length === actual.length && expected.every((name, i) => name === actual[i]);
  }

  function rebuildNotesFromVerified(card, expectedPairs) {
    const existing = Array.from(card.querySelectorAll('[data-card-filter="note"]'));
    if (!existing.length) return false;
    const host = existing[0].parentElement;
    if (!host || !existing.every(btn => btn.parentElement === host)) return false;
    host.innerHTML = '';
    expectedPairs.forEach(pair => {
      const name = escText(Array.isArray(pair) ? pair[0] : pair);
      const id = escText(Array.isArray(pair) ? pair[1] : '');
      if (!name) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'prototype-meta-badge prototype-filter-badge' + ((window.state && state.selectedNote === name) ? ' is-active' : '');
      btn.dataset.cardFilter = 'note';
      btn.dataset.filterValue = name;
      btn.title = `Filter by ${name}`;
      if (id) {
        const img = document.createElement('img');
        img.src = `https://fimgs.net/mdimg/sastojci/t.${id}.jpg`;
        img.alt = '';
        img.width = 22;
        img.height = 22;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.style.cssText = 'width:22px;height:22px;object-fit:cover;border-radius:50%;flex:0 0 22px';
        btn.appendChild(img);
      } else {
        const visual = document.createElement('span');
        visual.setAttribute('aria-hidden', 'true');
        visual.style.cssText = 'width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px;background:var(--color-bg-surface);border:1px solid var(--color-border-light);font-size:10px';
        visual.innerHTML = '<i class="fa-solid fa-droplet"></i>';
        btn.appendChild(visual);
      }
      const text = document.createElement('span');
      text.textContent = name;
      btn.appendChild(text);
      host.appendChild(btn);
    });
    card.dataset.noteRowsReady = '0';
    card.dataset.catcherAutoHealed = 'true';
    return true;
  }

  function layoutNotes(card) {
    if (!card || card.dataset.noteRowsReady === '1') return;
    const buttons = Array.from(card.querySelectorAll('[data-card-filter="note"]'));
    if (buttons.length < 3 || buttons.length > 6) return;
    const host = buttons[0].parentElement;
    if (!host || !buttons.every(btn => btn.parentElement === host)) return;
    let groups;
    if (buttons.length === 6) groups = [[0,1],[2,3],[4,5]];
    else if (buttons.length === 5) groups = [[0,1],[2,3],[4]];
    else if (buttons.length === 4) groups = [[0,1],[2],[3]];
    else groups = [[0],[1],[2]];
    const rows = document.createElement('div');
    rows.className = 'catcher-note-rows';
    groups.forEach(indexes => {
      const row = document.createElement('div');
      row.className = 'catcher-note-row';
      indexes.forEach(index => row.appendChild(buttons[index]));
      rows.appendChild(row);
    });
    host.innerHTML = '';
    host.className = 'catcher-note-rows';
    while (rows.firstChild) host.appendChild(rows.firstChild);
    card.dataset.noteRowsReady = '1';
  }

  function addStatusBadge(card, exactMatch, reason) {
    const imageWrap = card.querySelector('.prototype-image-wrap');
    if (!imageWrap || imageWrap.querySelector('.catcher-status-badge')) return;
    imageWrap.style.position = 'relative';
    const badge = document.createElement('span');
    badge.className = `catcher-status-badge ${exactMatch ? 'catcher-verified-badge' : 'catcher-error-badge'}`;
    badge.title = exactMatch
      ? (card.dataset.catcherAutoHealed === 'true' ? 'Notes auto-corrected and verified with Fragrantica social card' : 'Notes verified: card matches Fragrantica social card')
      : (reason || 'Notes not verified with Fragrantica social card');
    badge.setAttribute('aria-label', exactMatch ? 'Notes verified with Fragrantica social card' : 'Notes not verified with Fragrantica social card');
    badge.innerHTML = exactMatch ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-xmark"></i>';
    badge.style.cssText = ['position:absolute','right:10px','bottom:10px','width:28px','height:28px','border-radius:9999px','display:flex','align-items:center','justify-content:center',`background:${exactMatch ? '#16a34a' : '#dc2626'}`,'color:white','border:2px solid white','box-shadow:0 2px 8px rgba(0,0,0,.28)','font-size:14px','z-index:2'].join(';');
    imageWrap.appendChild(badge);
  }

  function verifyCard(card) {
    if (!card) return;
    const code = prepareCard(card);
    if (card.dataset.catcherVisualChecked === '1' || !code) return;
    const expectedPairs = (window.SHOBI_CATCHER_NOTES_BY_CODE || {})[code];
    const hasRecord = Array.isArray(expectedPairs) && expectedPairs.length > 0;
    if (!hasRecord) {
      layoutNotes(card);
      card.dataset.catcherVisualChecked = '1';
      card.dataset.catcherNotesMatch = 'false';
      card.dataset.catcherStatus = 'missing-record';
      addStatusBadge(card, false, 'Social-card record missing or unavailable');
      return;
    }
    const expected = expectedPairs.map(pair => escText(Array.isArray(pair) ? pair[0] : pair)).filter(Boolean);
    let actual = noteNames(card);
    let exactMatch = sameNotes(expected, actual);
    if (!exactMatch && rebuildNotesFromVerified(card, expectedPairs)) {
      actual = noteNames(card);
      exactMatch = sameNotes(expected, actual);
    }
    layoutNotes(card);
    card.dataset.catcherVisualChecked = '1';
    card.dataset.catcherNotesMatch = exactMatch ? 'true' : 'false';
    card.dataset.catcherStatus = exactMatch ? (card.dataset.catcherAutoHealed === 'true' ? 'auto-healed' : 'verified') : 'mismatch-after-autoheal';
    addStatusBadge(card, exactMatch, exactMatch ? '' : 'Card notes still differ after automatic repair');
  }

  function verifyAll() { document.querySelectorAll('.perfume-card-prototype').forEach(verifyCard); }
  const observer = new MutationObserver(verifyAll);
  document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('resultsContainer');
    if (container) observer.observe(container, { childList: true, subtree: true });
    verifyAll();
  });
})();
