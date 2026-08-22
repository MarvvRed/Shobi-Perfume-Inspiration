// Verified note enrichment for Best Sellers.
// Fragrantica social cards are authoritative for Best Seller Main Notes.
// This module only enriches the underlying #21-#100 perfume objects; it must never
// overwrite SHOBI_CATCHER_NOTES_BY_CODE, which is owned by bestseller-catcher-notes.js.
(function () {
    function unique(values) {
        return [...new Set((values || []).map(v => String(v || '').trim()).filter(Boolean))];
    }

    const rankedCodes = () => (window.SHOBI_BESTSELLER_CODES || []).slice(20, 100).map(String);

    function clearUnverifiedNotes(perfume) {
        if (!perfume) return;
        perfume.notes = { top: [], heart: [], base: [] };
        perfume.notesProvenance = { verified: false };
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

        let payload;
        try {
            const response = await fetch('bestseller-notes-verified.json', { cache: 'no-cache' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            payload = await response.json();
        } catch (error) {
            console.warn('Verified Best Seller note payload unavailable:', error);
            return;
        }

        const verifiedDb = payload && payload.perfumes && typeof payload.perfumes === 'object'
            ? payload.perfumes
            : {};
        const byCode = new Map(allPerfumes.map(p => [String(p.code || ''), p]));
        const unresolved = [];
        let enriched = 0;

        codes.forEach(code => {
            const perfume = byCode.get(code);
            if (!perfume) {
                unresolved.push(code);
                return;
            }

            clearUnverifiedNotes(perfume);
            const details = verifiedDb[code];
            if (!details || !mergeVerifiedNotes(perfume, details)) {
                unresolved.push(code);
                return;
            }
            enriched += 1;
        });

        window.SHOBI_BESTSELLER_NOTES_AUDIT = {
            scope: '21-100',
            total: codes.length,
            enriched,
            unresolved,
            generatedAt: payload.generated_at || null,
            authority: 'social-card-map-preserved'
        };
        console.log(`Verified note enrichment #21-#100: ${enriched}/${codes.length}; social-card authority preserved.`);
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
