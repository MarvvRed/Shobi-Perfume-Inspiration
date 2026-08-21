// Runtime bridge for Best Seller #1-#20.
// Reads the Official Catcher database directly from the deployed site and
// blocks initial rendering until the Catcher data is ready.
(function () {
  window.SHOBI_CATCHER_NOTES_BY_FID = {};

  async function loadOfficialCatcherNotes() {
    try {
      const response = await fetch('Personal Database/fragrantica-main-notes.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const perfumes = payload && payload.perfumes && typeof payload.perfumes === 'object' ? payload.perfumes : {};
      const byFid = {};
      for (const [key, perfume] of Object.entries(perfumes)) {
        if (!perfume || !Array.isArray(perfume.notes) || !perfume.notes.length) continue;
        const fid = String(perfume.fragrantica_id || key || '').trim();
        if (!fid) continue;
        byFid[fid] = perfume.notes
          .slice()
          .sort((a, b) => (Number(a.rank) || 999) - (Number(b.rank) || 999))
          .slice(0, 5)
          .map(note => [String(note.note || '').trim(), String(note.sastojak_id || '').trim()])
          .filter(pair => pair[0]);
      }
      window.SHOBI_CATCHER_NOTES_BY_FID = byFid;
      console.log(`Official Catcher browser bridge loaded: ${Object.keys(byFid).length} fragrances.`);
      return byFid;
    } catch (error) {
      console.error('Official Catcher browser bridge unavailable; static card fallbacks will be used.', error);
      window.SHOBI_CATCHER_NOTES_BY_FID = {};
      return {};
    }
  }

  window.SHOBI_CATCHER_NOTES_READY = loadOfficialCatcherNotes();

  if (typeof init === 'function') {
    const baseInit = init;
    init = async function () {
      await window.SHOBI_CATCHER_NOTES_READY;
      return baseInit();
    };
  }

  // Structural/order mismatches confirmed against the public Fragrantica social cards.
  // Naming-only aliases are intentionally not rewritten.
  const socialCardCorrections = {
    '371-TMFO EL': ['Coconut','Tuberose','Ylang-Ylang','Jasmine','Pistachio'],
    '449-BYR WP': ['Vetiver','Violet','Cyclamen','Bergamot','African Marigold'],
    '204-CRD EL': ['Pineapple','Birch','Bergamot','Musk','Black Currant'],
    '765-KIL WP': ['Sugar','Vanilla','Caramel','Orange Blossom','Neroli'],
    '994-ZAD WP': ['Cream','Vanilla','Chestnut','Sandalwood','Cashmir wood'],
    '2371-MATIE EL': ['Vanilla','Coconut Powder','Musk','Palo Santo','Coconut'],
    '2206-GIA LUX': ['Vanilla','Caramel','Coumarin','Honey','Musk'],
    '179-XER N': ['Honey','Tobacco','Lavender','Vanilla','Tonka Bean'],
    '2162-BRB WP': ['Vanilla','Lavender','Vanilla Caviar','Cacao Pod','Ginger'],
    '2398-FRE LUX': ['Aldehydes','Peach','Orange Blossom','Musk','Violet'],
    '401-ARIA WP': ['Cream','Coconut','Praline','Musk','Lavender'],
    '1499-BYR EL': ['Sapodilla','Magnolia','Violet','Ambrette (Musk Mallow)','Sandalwood'],
    '485-CAR WP': ['Tonka Bean','Cacao Pod','Vanilla','Tuberose','Almond'],
    '1520-YZLO W': ['Vanilla','Lavender','Tonka Bean','Orange Blossom','Jasmine'],
    '152-PARF N': ['Rose','Litchi','Vanilla','Pear','Amber'],
    '1735-XER N': ['Almond','Toffee','Milk','Vanilla','Saffron'],
    '1498-BYR EL': ['Juniper','Vanilla','Sandalwood','Lemon','Pine Tree'],
    '132-LTN N': ['Agarwood (Oud)','Rose','Incense','Raspberry','Saffron'],
    '1919-PRA WP': ['Orange Blossom','Neroli','Jasmine','Vanilla','Pear'],
    '1764-GUR W': ['Hazelnut','Amberwood','Rum','Yuzu','Leather'],
    '848-NRO WP': ['Musk','Cashmeran','Jasmine','Ylang-Ylang','Orange Blossom'],
    '2348-AMG': ['Sandalwood','Hazelnut','Pear','Vanilla','Akigalawood'],
    '2155-KAY EL': ['Pistachio','Cream','Ice Cream','Marshmallow','Cotton Candy'],
    '750-KEN W': ['Raspberry','Praline','Powdery Notes','Vanilla','Rose'],
    '1553-MNT N': ['Tonka Bean','Sugar','Agarwood (Oud)','Saffron','Rose'],
    '937-VAL WP': ['Vanilla','Black Currant','Jasmine','Cashmeran','Jasmine Tea'],
    '2235-PRA WP': ['White Tobacco','Tobacco','Rose','Osmanthus','Vanilla']
  };

  window.SHOBI_SOCIAL_CARD_NOTES_BY_CODE = socialCardCorrections;
  document.addEventListener('DOMContentLoaded', function () {
    window.SHOBI_CATCHER_NOTES_BY_CODE = window.SHOBI_CATCHER_NOTES_BY_CODE || {};
    Object.entries(socialCardCorrections).forEach(([code, notes]) => {
      window.SHOBI_CATCHER_NOTES_BY_CODE[code] = notes.slice();
    });
    console.log(`Social-card authority applied: ${Object.keys(socialCardCorrections).length} structural note corrections.`);
  });
})();
