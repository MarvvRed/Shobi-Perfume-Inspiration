// Live counter for verification badges on the currently rendered page.
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

  function updateCounter() {
    const el = ensureCounter();
    if (!el) return;
    const cards = Array.from(document.querySelectorAll('#resultsContainer .perfume-card-prototype'));
    let green = 0, red = 0;
    cards.forEach(card => {
      const badge = card.querySelector('.catcher-status-badge');
      if (!badge) return;
      if (badge.classList.contains('catcher-verified-badge')) green++;
      else if (badge.classList.contains('catcher-error-badge')) red++;
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
    if (container) new MutationObserver(updateCounter).observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    updateCounter();
  });
})();
