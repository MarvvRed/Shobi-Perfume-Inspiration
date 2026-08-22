// Live counter for verification badges on the currently rendered page.
// Green/red describe validation status, not data-source type.
(function () {
  function ensureCounter() {
    let el = document.getElementById('bestseller-status-counter');
    if (el) return el;
    const navRight = document.querySelector('nav .flex.items-center.space-x-4');
    if (!navRight) return null;
    el = document.createElement('div');
    el.id = 'bestseller-status-counter';
    el.className = 'hidden sm:flex items-center gap-2 text-sm font-semibold';
    el.innerHTML = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-700"><i class="fa-solid fa-check"></i><span data-status-green>0</span></span><span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-700"><i class="fa-solid fa-xmark"></i><span data-status-red>0</span></span>';
    navRight.insertBefore(el, navRight.firstChild);
    return el;
  }

  function cardStatus(card) {
    // Canonical status has priority when present.
    if (card.querySelector('.canonical-top100-error-badge,[data-validation-status="error"]')) return 'red';
    if (card.querySelector('.canonical-top100-verified-badge,[data-validation-status="verified"]')) return 'green';

    // Legacy/non-canonical cards remain supported.
    if (card.querySelector('.catcher-error-badge')) return 'red';
    if (card.querySelector('.catcher-verified-badge')) return 'green';
    return null;
  }

  function updateCounter() {
    const el = ensureCounter();
    if (!el) return;
    const cards = Array.from(document.querySelectorAll('#resultsContainer .perfume-card-prototype'));
    let green = 0, red = 0;
    cards.forEach(card => {
      const status = cardStatus(card);
      if (status === 'green') green++;
      else if (status === 'red') red++;
    });
    const g = el.querySelector('[data-status-green]');
    const r = el.querySelector('[data-status-red]');
    if (g) g.textContent = String(green);
    if (r) r.textContent = String(red);
    el.title = `Current page: ${green} verified, ${red} errors`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureCounter();
    const container = document.getElementById('resultsContainer');
    if (container) new MutationObserver(updateCounter).observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class','data-validation-status']
    });
    updateCounter();
  });
})();
