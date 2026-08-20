// Visual verification + real three-row note layout for Official Catcher Best Seller cards.
(function () {
  function escText(v) { return String(v || '').trim(); }

  function layoutNotes(card) {
    if (!card || card.dataset.noteRowsReady === '1') return;
    const buttons = Array.from(card.querySelectorAll('[data-card-filter="note"]'));
    if (buttons.length < 3 || buttons.length > 5) return;

    const host = buttons[0].parentElement;
    if (!host || !buttons.every(btn => btn.parentElement === host)) return;

    let groups;
    if (buttons.length === 5) groups = [[0,1],[2,3],[4]];
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
      ? 'Notes verified: card matches Official Catcher / Fragrantica'
      : (reason || 'Notes not verified with Official Catcher / Fragrantica');
    badge.setAttribute('aria-label', exactMatch
      ? 'Notes verified with Official Catcher'
      : 'Notes not verified with Official Catcher');
    badge.innerHTML = exactMatch
      ? '<i class="fa-solid fa-check"></i>'
      : '<i class="fa-solid fa-xmark"></i>';
    badge.style.cssText = [
      'position:absolute','right:10px','bottom:10px','width:28px','height:28px',
      'border-radius:9999px','display:flex','align-items:center','justify-content:center',
      `background:${exactMatch ? '#16a34a' : '#dc2626'}`,'color:white','border:2px solid white',
      'box-shadow:0 2px 8px rgba(0,0,0,.28)','font-size:14px','z-index:2'
    ].join(';');
    imageWrap.appendChild(badge);
  }

  function verifyCard(card) {
    if (!card) return;
    layoutNotes(card);
    if (card.dataset.catcherVisualChecked === '1') return;

    const details = card.querySelector('[data-action="show-details"][data-code]');
    const code = details && escText(details.dataset.code);
    if (!code) return;

    const expectedPairs = (window.SHOBI_CATCHER_NOTES_BY_CODE || {})[code];
    const hasRecord = Array.isArray(expectedPairs) && expectedPairs.length > 0;

    if (!hasRecord) {
      card.dataset.catcherVisualChecked = '1';
      card.dataset.catcherNotesMatch = 'false';
      card.dataset.catcherStatus = 'missing-record';
      addStatusBadge(card, false, 'Official Catcher record missing or unavailable');
      return;
    }

    const expected = expectedPairs.map(pair => escText(Array.isArray(pair) ? pair[0] : pair)).filter(Boolean);
    const actual = Array.from(card.querySelectorAll('[data-card-filter="note"]'))
      .map(el => escText(el.dataset.filterValue))
      .filter(Boolean);

    const exactMatch = expected.length === actual.length && expected.every((name, i) => name === actual[i]);
    card.dataset.catcherVisualChecked = '1';
    card.dataset.catcherNotesMatch = exactMatch ? 'true' : 'false';
    card.dataset.catcherStatus = exactMatch ? 'verified' : 'mismatch';
    addStatusBadge(card, exactMatch, exactMatch ? '' : 'Card notes differ from Official Catcher / Fragrantica');
  }

  function verifyAll() {
    document.querySelectorAll('.perfume-card-prototype').forEach(verifyCard);
  }

  const observer = new MutationObserver(verifyAll);
  document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('resultsContainer');
    if (container) observer.observe(container, { childList: true, subtree: true });
    verifyAll();
  });
})();
