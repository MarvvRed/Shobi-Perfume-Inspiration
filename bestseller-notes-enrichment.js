// Verified note enrichment for Best Seller #21-#100.
// Runtime source: bestseller-notes-verified.json, generated from Personal Database/perfume-details.json.
// Personal Database remains read-only and is never fetched by the browser.
(function () {
    const rankedCodes = () => (window.SHOBI_BESTSELLER_CODES || []).slice(20, 100).map(String);

    function unique(values) {
        return [...new Set((values || []).map(v => String(v || '').trim()).filter(Boolean))];
    }

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

            // Never expose legacy/unverified note data on Best Seller #21-#100.
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
            generatedAt: payload.generated_at || null
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
