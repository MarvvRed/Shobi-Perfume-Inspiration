// Visual verification for Official Catcher notes on rendered Best Seller cards.
// A green check is shown only when the note names visible on the card exactly
// match the Catcher runtime notes, in the same order.
(function () {
  function escText(v) { return String(v || '').trim(); }

  function verifyCard(card) {
    if (!card || card.dataset.catcherVisualChecked === '1') return;

    const details = card.querySelector('[data-action="show-details"][data-code]');
    const code = details && escText(details.dataset.code);
    if (!code) return;

    const expectedPairs = (window.SHOBI_CATCHER_NOTES_BY_CODE || {})[code];
    if (!Array.isArray(expectedPairs) || !expectedPairs.length) return;

    const expected = expectedPairs.map(pair => escText(Array.isArray(pair) ? pair[0] : pair)).filter(Boolean);
    const actual = Array.from(card.querySelectorAll('[data-card-filter="note"]'))
      .map(el => escText(el.dataset.filterValue))
      .filter(Boolean);

    const exactMatch = expected.length === actual.length && expected.every((name, i) => name === actual[i]);
    card.dataset.catcherVisualChecked = '1';
    card.dataset.catcherNotesMatch = exactMatch ? 'true' : 'false';

    if (!exactMatch) return;

    const imageWrap = card.querySelector('.prototype-image-wrap');
    if (!imageWrap || imageWrap.querySelector('.catcher-verified-badge')) return;
    imageWrap.style.position = 'relative';

    const badge = document.createElement('span');
    badge.className = 'catcher-verified-badge';
    badge.title = 'Notes verified: card matches Official Catcher / Fragrantica';
    badge.setAttribute('aria-label', 'Notes verified with Official Catcher');
    badge.innerHTML = '<i class="fa-solid fa-check"></i>';
    badge.style.cssText = [
      'position:absolute',
      'right:10px',
      'bottom:10px',
      'width:28px',
      'height:28px',
      'border-radius:9999px',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'background:#16a34a',
      'color:white',
      'border:2px solid white',
      'box-shadow:0 2px 8px rgba(0,0,0,.28)',
      'font-size:14px',
      'z-index:2'
    ].join(';');
    imageWrap.appendChild(badge);
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
