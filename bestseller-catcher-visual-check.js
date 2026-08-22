// Shared Best Seller social-card verifier/repair.
(function () {
  const text = v => String(v || '').trim();
  const key = v => text(v).toLowerCase().replace(/[^a-z0-9]+/g, '');

  // Known Fragrantica ingredient image ids used only when a badge has to be newly created.
  const noteImageIds = {
    'Vetiver':'2','Musk':'4','Osmanthus':'10','Jasmine':'14','Orange Blossom':'16','Neroli':'17','Ylang-Ylang':'24','Tuberose':'25','Birch':'31','Sandalwood':'33','Patchouli':'34','Cedar':'41','Rose':'105','Violet':'116','Black Currant':'132','Cacao Pod':'135','Coconut':'138','Coffee':'139','Hazelnut':'141','Juniper':'142','Magnolia':'147','Leather':'156','Mint':'160','Aldehydes':'165','Cyclamen':'166','Blackberry':'169','Pineapple':'170','Raspberry':'174','Sour Cherry':'176','Honey':'181','Pear':'182','Caramel':'183','Litchi':'194','Praline':'198','Milk':'199','Sugar':'200','Rum':'201','Pine Tree':'204','Incense':'68','Grapefruit':'76','Lemon':'77','Lime':'78','Orange':'80','Mandarin Orange':'82','Tonka Bean':'73','Vanilla':'74','Bergamot':'75','Saffron':'55','Amber':'54','Cardamom':'63','Cinnamon':'65','Sage':'52','Seaweed':'409','Pistachio':'221','Fig':'247','Fig Leaf':'150','Green Notes':'318','Cashmeran':'348','Marshmallow':'236','Cotton Candy':'237','Iso E Super':'422','Toffee':'434','Whipped Cream':'454','Ambergris':'524','Chestnut':'578','Akigalawood':'697','Oolong Tea':'713','Oolong tea':'713','Agarwood (Oud)':'114','Ambrette (Musk Mallow)':'107','Powdery Notes':'123','Woody Notes':'220','Tea':'106','Lavender':'1','Patchouli':'34'
  };

  function ensureSeasonLabel(card) {
    const labels = { spring:'Spring', summer:'Summer', fall:'Fall', autumn:'Autumn', winter:'Winter' };
    card.querySelectorAll('[data-card-filter="season"]').forEach(btn => {
      const label = labels[text(btn.dataset.filterValue).toLowerCase()];
      if (!label || text(btn.textContent).toLowerCase().includes(label.toLowerCase())) return;
      const span = document.createElement('span');
      span.className = 'catcher-season-label';
      span.textContent = label;
      span.style.fontSize = '16px';
      btn.appendChild(span);
    });
  }

  function prepareCard(card) {
    ensureSeasonLabel(card);
    const details = card.querySelector('[data-action="show-details"][data-code]');
    if (details && !card.dataset.catcherCode) card.dataset.catcherCode = text(details.dataset.code);
    card.querySelectorAll('[data-action="show-details"][data-code]').forEach(el => el.remove());
    const firstNote = card.querySelector('[data-card-filter="note"]');
    const host = firstNote && firstNote.parentElement;
    if (host && !card.querySelector('.catcher-main-notes-label')) {
      const label = document.createElement('div');
      label.className = 'catcher-main-notes-label font-semibold text-primary text-left';
      label.textContent = 'Main Notes';
      label.style.cssText = 'font-size:14px;line-height:1.2;margin-bottom:-4px;';
      host.parentElement.insertBefore(label, host);
    }
    return card.dataset.catcherCode || '';
  }

  function cardRank(card) {
    const m = text(card.textContent).match(/Best Seller\s*#\s*(\d+)/i);
    return m ? Number(m[1]) : null;
  }

  function expectedForCard(card, code) {
    const map = window.SHOBI_CATCHER_NOTES_BY_CODE || {};
    if (Array.isArray(map[code]) && map[code].length) return map[code];
    const rank = cardRank(card);
    if (!Number.isFinite(rank)) return null;
    const row = (window.SHOBI_BESTSELLER_RANKING || []).find(x => Number(x.rank) === rank);
    const canonicalCode = row && text(row.code);
    return canonicalCode && Array.isArray(map[canonicalCode]) && map[canonicalCode].length ? map[canonicalCode] : null;
  }

  function noteNames(card) {
    return Array.from(card.querySelectorAll('[data-card-filter="note"]')).map(el => text(el.dataset.filterValue)).filter(Boolean);
  }

  function sameNotes(a, b) {
    return a.length === b.length && a.every((name, i) => key(name) === key(b[i]));
  }

  function makeVisual(name, id, savedVisuals) {
    const saved = savedVisuals.get(key(name));
    if (saved) return saved.cloneNode(true);
    const resolvedId = text(id) || noteImageIds[name] || '';
    if (resolvedId) {
      const img = document.createElement('img');
      img.src = `https://fimgs.net/mdimg/sastojci/t.${resolvedId}.jpg`;
      img.alt = '';
      img.width = 22;
      img.height = 22;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.style.cssText = 'width:22px;height:22px;object-fit:cover;border-radius:50%;flex:0 0 22px';
      return img;
    }
    const span = document.createElement('span');
    span.setAttribute('aria-hidden','true');
    span.style.cssText = 'width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px;background:var(--color-bg-surface);border:1px solid var(--color-border-light);font-size:10px';
    span.innerHTML = '<i class="fa-solid fa-droplet"></i>';
    return span;
  }

  function rebuildNotes(card, expectedPairs) {
    const existing = Array.from(card.querySelectorAll('[data-card-filter="note"]'));
    if (!existing.length) return false;
    const host = existing[0].parentElement;
    if (!host || !existing.every(btn => btn.parentElement === host)) return false;

    const savedVisuals = new Map();
    existing.forEach(btn => {
      const visual = btn.querySelector('img, span[aria-hidden="true"]');
      if (visual) savedVisuals.set(key(btn.dataset.filterValue), visual);
    });

    host.innerHTML = '';
    expectedPairs.forEach(pair => {
      const name = text(Array.isArray(pair) ? pair[0] : pair);
      const id = text(Array.isArray(pair) ? pair[1] : '');
      if (!name) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'prototype-meta-badge prototype-filter-badge' + ((window.state && state.selectedNote === name) ? ' is-active' : '');
      btn.dataset.cardFilter = 'note';
      btn.dataset.filterValue = name;
      btn.title = `Filter by ${name}`;
      btn.appendChild(makeVisual(name, id, savedVisuals));
      const label = document.createElement('span');
      label.textContent = name;
      btn.appendChild(label);
      host.appendChild(btn);
    });
    card.dataset.noteRowsReady = '0';
    card.dataset.catcherAutoHealed = 'true';
    return true;
  }

  function layoutNotes(card) {
    if (card.dataset.noteRowsReady === '1') return;
    const buttons = Array.from(card.querySelectorAll('[data-card-filter="note"]'));
    if (buttons.length < 3 || buttons.length > 6) return;
    const host = buttons[0].parentElement;
    if (!host || !buttons.every(btn => btn.parentElement === host)) return;
    const groups = buttons.length === 6 ? [[0,1],[2,3],[4,5]] : buttons.length === 5 ? [[0,1],[2,3],[4]] : buttons.length === 4 ? [[0,1],[2],[3]] : [[0],[1],[2]];
    const rows = document.createElement('div');
    rows.className = 'catcher-note-rows';
    groups.forEach(indexes => {
      const row = document.createElement('div');
      row.className = 'catcher-note-row';
      indexes.forEach(i => row.appendChild(buttons[i]));
      rows.appendChild(row);
    });
    host.innerHTML = '';
    host.className = 'catcher-note-rows';
    while (rows.firstChild) host.appendChild(rows.firstChild);
    card.dataset.noteRowsReady = '1';
  }

  function addStatus(card, ok, reason) {
    const wrap = card.querySelector('.prototype-image-wrap');
    if (!wrap) return;
    wrap.querySelector('.catcher-status-badge')?.remove();
    wrap.style.position = 'relative';
    const badge = document.createElement('span');
    badge.className = `catcher-status-badge ${ok ? 'catcher-verified-badge' : 'catcher-error-badge'}`;
    badge.title = ok ? 'Notes verified with Fragrantica social card' : (reason || 'Notes not verified with Fragrantica social card');
    badge.innerHTML = ok ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-xmark"></i>';
    badge.style.cssText = ['position:absolute','right:10px','bottom:10px','width:28px','height:28px','border-radius:9999px','display:flex','align-items:center','justify-content:center',`background:${ok ? '#16a34a' : '#dc2626'}`,'color:white','border:2px solid white','box-shadow:0 2px 8px rgba(0,0,0,.28)','font-size:14px','z-index:2'].join(';');
    wrap.appendChild(badge);
  }

  function verifyCard(card) {
    const code = prepareCard(card);
    if (card.dataset.catcherVisualChecked === '1') return;
    const expectedPairs = expectedForCard(card, code);
    if (!expectedPairs) {
      layoutNotes(card);
      card.dataset.catcherVisualChecked = '1';
      addStatus(card, false, 'Social-card record missing');
      return;
    }
    const expected = expectedPairs.map(pair => text(Array.isArray(pair) ? pair[0] : pair)).filter(Boolean);
    let actual = noteNames(card);
    if (!sameNotes(expected, actual)) {
      rebuildNotes(card, expectedPairs);
      actual = noteNames(card);
    }
    const ok = sameNotes(expected, actual);
    layoutNotes(card);
    card.dataset.catcherVisualChecked = '1';
    card.dataset.catcherNotesMatch = ok ? 'true' : 'false';
    addStatus(card, ok, ok ? '' : 'Card notes still differ after repair');
  }

  function verifyAll() {
    document.querySelectorAll('.perfume-card-prototype').forEach(verifyCard);
  }

  const observer = new MutationObserver(verifyAll);
  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('resultsContainer');
    if (container) observer.observe(container, { childList:true, subtree:true });
    verifyAll();
  });
})();
