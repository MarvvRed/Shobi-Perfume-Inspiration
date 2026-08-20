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
})();
