// Legacy social-card repair/checker.
// CANONICAL-TOP100-v1 cards are explicitly out of scope and must never be mutated here.
(function () {
  const text = v => String(v || '').trim();
  const key = v => text(v).toLowerCase().replace(/[^a-z0-9]+/g, '');

  function isCanonicalTop100(card) {
    return !!(card && (card.dataset.canonicalTop100 === 'v1' || card.dataset.canonicalFragranticaId));
  }

  function rankOf(card) {
    const m = text(card.textContent).match(/Best Seller\s*#\s*(\d+)/i);
    return m ? Number(m[1]) : null;
  }

  function codeOf(card) {
    if (card.dataset.catcherCode) return card.dataset.catcherCode;
    const details = card.querySelector('[data-action="show-details"][data-code]');
    if (details) card.dataset.catcherCode = text(details.dataset.code);
    return card.dataset.catcherCode || '';
  }

  function expectedNotes(card) {
    const social = window.SHOBI_SOCIAL_CARD_NOTES_BY_CODE || {};
    const code = codeOf(card);
    if (Array.isArray(social[code]) && social[code].length) return social[code].slice(0, 6);
    const rank = rankOf(card);
    const row = (window.SHOBI_BESTSELLER_RANKING || []).find(x => Number(x.rank) === rank);
    const canonical = row && text(row.code);
    return canonical && Array.isArray(social[canonical]) ? social[canonical].slice(0, 6) : null;
  }

  function iconId(name) {
    const ids = window.FRAGRANTICA_NOTE_ICON_IDS || {};
    if (ids[name]) return ids[name];
    const wanted = key(name);
    for (const [label, id] of Object.entries(ids)) if (key(label) === wanted) return id;
    return '';
  }

  function noteButton(name, saved) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'prototype-meta-badge prototype-filter-badge' + ((window.state && state.selectedNote === name) ? ' is-active' : '');
    btn.dataset.cardFilter = 'note';
    btn.dataset.filterValue = name;
    btn.title = `Filter by ${name}`;

    const old = saved.get(key(name));
    const id = iconId(name);
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
    } else if (old) {
      btn.appendChild(old.cloneNode(true));
    } else {
      const visual = document.createElement('span');
      visual.setAttribute('aria-hidden', 'true');
      visual.style.cssText = 'width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px;background:var(--color-bg-surface);border:1px solid var(--color-border-light);font-size:10px';
      visual.innerHTML = '<i class="fa-solid fa-droplet"></i>';
      btn.appendChild(visual);
    }
    const label = document.createElement('span');
    label.textContent = name;
    btn.appendChild(label);
    return btn;
  }

  function status(card, ok, reason) {
    const wrap = card.querySelector('.prototype-image-wrap');
    if (!wrap) return;
    wrap.querySelector('.catcher-status-badge')?.remove();
    wrap.style.position = 'relative';
    const badge = document.createElement('span');
    badge.className = `catcher-status-badge ${ok ? 'catcher-verified-badge' : 'catcher-error-badge'}`;
    badge.title = ok ? 'Main Notes match Fragrantica social card' : reason;
    badge.innerHTML = ok ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-xmark"></i>';
    badge.style.cssText = ['position:absolute','right:10px','bottom:10px','width:28px','height:28px','border-radius:9999px','display:flex','align-items:center','justify-content:center',`background:${ok ? '#16a34a' : '#dc2626'}`,'color:white','border:2px solid white','box-shadow:0 2px 8px rgba(0,0,0,.28)','font-size:14px','z-index:2'].join(';');
    wrap.appendChild(badge);
  }

  function repair(card) {
    // Hard isolation boundary: frozen canonical Top100 cards are owned entirely by
    // bestseller-001-100-canonical-cards.js and CANONICAL-TOP100-v1.
    if (isCanonicalTop100(card)) {
      card.querySelector('.catcher-status-badge')?.remove();
      card.dataset.legacyCatcherExcluded = 'true';
      return;
    }

    if (!card || card.dataset.socialCardApplied === '1') return;
    const expected = expectedNotes(card);
    const current = Array.from(card.querySelectorAll('[data-card-filter="note"]'));
    if (!expected || !expected.length) {
      card.dataset.socialCardApplied = '1';
      status(card, false, 'Fragrantica social-card record missing');
      return;
    }
    if (!current.length) return;

    const saved = new Map();
    current.forEach(btn => {
      const visual = btn.querySelector('img, span[aria-hidden="true"]');
      if (visual) saved.set(key(btn.dataset.filterValue), visual);
    });

    let host = current[0].parentElement;
    if (!current.every(btn => btn.parentElement === host)) {
      const rowHost = current[0].closest('.catcher-note-rows');
      if (rowHost) host = rowHost;
    }
    if (!host) return;

    host.innerHTML = '';
    host.className = 'catcher-note-rows';
    const groups = expected.length === 6 ? [[0,1],[2,3],[4,5]] : expected.length === 5 ? [[0,1],[2,3],[4]] : expected.length === 4 ? [[0,1],[2],[3]] : expected.length === 3 ? [[0],[1],[2]] : [expected.map((_,i)=>i)];
    groups.forEach(indexes => {
      const row = document.createElement('div');
      row.className = 'catcher-note-row';
      indexes.forEach(i => row.appendChild(noteButton(expected[i], saved)));
      host.appendChild(row);
    });

    if (!card.querySelector('.catcher-main-notes-label')) {
      const label = document.createElement('div');
      label.className = 'catcher-main-notes-label font-semibold text-primary text-left';
      label.textContent = 'Main Notes';
      label.style.cssText = 'font-size:14px;line-height:1.2;margin-bottom:-4px;';
      host.parentElement.insertBefore(label, host);
    }

    card.querySelectorAll('[data-action="show-details"][data-code]').forEach(el => el.remove());
    const labels = { spring:'Spring', summer:'Summer', fall:'Fall', autumn:'Autumn', winter:'Winter' };
    card.querySelectorAll('[data-card-filter="season"]').forEach(btn => {
      const label = labels[text(btn.dataset.filterValue).toLowerCase()];
      if (label && !text(btn.textContent).toLowerCase().includes(label.toLowerCase())) {
        const span = document.createElement('span');
        span.textContent = label;
        span.style.fontSize = '16px';
        btn.appendChild(span);
      }
    });

    const actual = Array.from(card.querySelectorAll('[data-card-filter="note"]')).map(x => text(x.dataset.filterValue));
    const ok = actual.length === expected.length && actual.every((n,i) => key(n) === key(expected[i]));
    card.dataset.socialCardApplied = '1';
    card.dataset.catcherNotesMatch = ok ? 'true' : 'false';
    status(card, ok, ok ? '' : 'Card could not be rebuilt from Fragrantica social-card notes');
  }

  function repairAll() {
    document.querySelectorAll('.perfume-card-prototype').forEach(repair);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('resultsContainer');
    if (container) new MutationObserver(repairAll).observe(container, { childList:true, subtree:true });
    repairAll();
  });
})();
