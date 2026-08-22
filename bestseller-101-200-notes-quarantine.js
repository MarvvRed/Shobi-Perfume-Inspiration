// Safety guard: Best Seller 101-200 ranking is published, but its Fragrantica Main Notes
// must not override site data until the dedicated 101-200 social-card validation is complete.
(function () {
  const quarantined = new Set([
    '181-XER N','1156-HER M','955-VICT WP','919-TMU W','944-VER W','1185-JOO MP'
  ]);

  function purge() {
    const social = window.SHOBI_SOCIAL_CARD_NOTES_BY_CODE || {};
    const catcher = window.SHOBI_CATCHER_NOTES_BY_CODE || {};
    quarantined.forEach(code => {
      delete social[code];
      delete catcher[code];
    });
  }

  // Run now, and again after bestseller-catcher-notes' DOMContentLoaded bridge has populated its map.
  purge();
  document.addEventListener('DOMContentLoaded', purge);
})();
