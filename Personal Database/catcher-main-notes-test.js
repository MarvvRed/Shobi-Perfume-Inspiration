/*
 * OFFICIAL CATCHER MAIN NOTES — 10 PERFUME SITE TEST
 * Temporary integration layer for validating Personal Database/fragrantica-main-notes.json
 * against the existing Shobi site without changing the canonical catalogue data.
 */
(function(){
  window.__applyCatcherNotesTest = function(){
    const originalLoadEnrichment = window.loadEnrichment;
    if (typeof originalLoadEnrichment !== 'function') {
      console.warn('CATCHER_NOTES_TEST: loadEnrichment not available');
      return;
    }

    function fragranticaIdFromUrl(url){
      const m = String(url || '').match(/-(\d+)\.html(?:[?#]|$)/i);
      return m ? m[1] : '';
    }

    window.loadEnrichment = async function(){
      if (window.enrich) return;
      try {
        const [baseRes, catcherRes] = await Promise.all([
          fetch('./site-enrichment-v2.json?v=6c3406544b1e1a71', {cache:'no-store'}),
          fetch('./fragrantica-main-notes.json?v=catcher-035-test1', {cache:'no-store'})
        ]);
        if (!baseRes.ok) throw Error('base enrichment ' + baseRes.status);

        window.enrich = (await baseRes.json()).e || {};

        let applied = 0;
        if (catcherRes.ok) {
          const catcher = await catcherRes.json();
          const byId = catcher.perfumes || {};
          for (const [code, row] of Object.entries(window.enrich)) {
            if (!Array.isArray(row)) continue;
            const fragId = fragranticaIdFromUrl(row[4]);
            const source = fragId && byId[fragId];
            if (!source || !Array.isArray(source.notes) || !source.notes.length) continue;
            row[2] = source.notes
              .slice()
              .sort((a,b)=>(Number(a.rank)||999)-(Number(b.rank)||999))
              .slice(0,5)
              .map(n=>String(n.note || '').trim())
              .filter(Boolean);
            applied++;
          }
        } else {
          console.warn('CATCHER_NOTES_TEST: catcher database unavailable', catcherRes.status);
        }

        console.log('CATCHER_NOTES_TEST_APPLIED', applied);
        window.buildFilters();
        window.render();
      } catch (e) {
        console.warn('CATCHER_NOTES_TEST failed, falling back to normal enrichment', e);
        window.enrich = null;
        return originalLoadEnrichment();
      }
    };
  };
})();
