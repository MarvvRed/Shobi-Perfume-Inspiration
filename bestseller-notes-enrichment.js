// Read-only enrichment for Best Seller #21-#100.
// Source: Personal Database/perfume-details.json.
// Only note pyramids explicitly marked verified are propagated to the live in-memory records.
(function () {
    const normalizeCode = value => String(value || '').trim().toLowerCase();
    const rankedCodes = () => (window.SHOBI_BESTSELLER_CODES || []).slice(20, 100).map(String);

    function hasVerifiedNotes(details) {
        if (!details || typeof details !== 'object') return false;
        if (details.notes_verified === true) return true;
        const status = String(details.notes_status || '').toLowerCase();
        return status.includes('verified') && !status.includes('pending') && !status.includes('unverified');
    }

    function unique(values) {
        return [...new Set((values || []).map(v => String(v || '').trim()).filter(Boolean))];
    }

    function mergeVerifiedNotes(perfume, details) {
        const top = unique(details.top_notes);
        const heart = unique(details.heart_notes);
        const base = unique(details.base_notes);
        if (!top.length && !heart.length && !base.length) return false;

        perfume.notes = { top, heart, base };
        perfume.notesProvenance = {
            verified: true,
            source: details.notes_source || '',
            sourceUrl: details.notes_source_url || '',
            status: details.notes_status || '',
            validationVersion: details.notes_validation_version || null
        };
        return true;
    }

    async function enrichBestSellerNotes() {
        const codes = rankedCodes();
        if (!codes.length || !Array.isArray(window.allPerfumes || allPerfumes)) return;

        let detailsDb;
        try {
            const response = await fetch('Personal%20Database/perfume-details.json', { cache: 'no-cache' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            detailsDb = await response.json();
        } catch (error) {
            console.warn('Best Seller note enrichment unavailable:', error);
            return;
        }

        const byCode = new Map(allPerfumes.map(p => [String(p.code || ''), p]));
        const unresolved = [];
        let enriched = 0;

        codes.forEach(code => {
            const perfume = byCode.get(code);
            const details = detailsDb[normalizeCode(code)];
            if (!perfume || !hasVerifiedNotes(details) || !mergeVerifiedNotes(perfume, details)) {
                unresolved.push(code);
                return;
            }
            enriched += 1;
        });

        window.SHOBI_BESTSELLER_NOTES_AUDIT = {
            scope: '21-100',
            total: codes.length,
            enriched,
            unresolved
        };
        console.log(`Verified note enrichment #21-#100: ${enriched}/${codes.length}.`);
        if (unresolved.length) console.info('Best Seller note records still requiring verification:', unresolved);
    }

    if (typeof init === 'function') {
        const baseInit = init;
        init = async function () {
            await baseInit();
            await enrichBestSellerNotes();
            if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender();
        };
    }
})();
