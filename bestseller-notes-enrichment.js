// Verified note enrichment for Best Sellers.
// #1-#20 are loaded directly from the Official Catcher before first render.
// #21-#100 keep using bestseller-notes-verified.json.
(function () {
    const catcherFids1to20 = [
        '52616','62615','6686','1825','60665','33519','899','51411','84951','56062',
        '34893','6458','9828','4322','39358','84933','64757','30529','3865','83483'
    ];

    function unique(values) {
        return [...new Set((values || []).map(v => String(v || '').trim()).filter(Boolean))];
    }

    async function loadOfficialCatcherForFirst20() {
        const codes = (window.SHOBI_BESTSELLER_CODES || []).slice(0, 20).map(String);
        if (codes.length < 20) {
            console.warn(`Official Catcher card bridge: expected 20 Best Seller codes, found ${codes.length}.`);
            return;
        }

        try {
            const response = await fetch('Personal Database/fragrantica-main-notes.json', { cache: 'no-cache' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const payload = await response.json();
            const perfumes = payload && payload.perfumes && typeof payload.perfumes === 'object' ? payload.perfumes : {};
            const byCode = {};
            const missing = [];

            catcherFids1to20.forEach((fid, index) => {
                const record = perfumes[fid];
                const code = codes[index];
                if (!record || !Array.isArray(record.notes) || !record.notes.length) {
                    missing.push(`#${index + 1}:${fid}`);
                    return;
                }
                byCode[code] = record.notes
                    .slice()
                    .sort((a, b) => (Number(a.rank) || 999) - (Number(b.rank) || 999))
                    .slice(0, 5)
                    .map(note => [String(note.note || '').trim(), String(note.sastojak_id || '').trim()])
                    .filter(pair => pair[0]);
            });

            window.SHOBI_CATCHER_NOTES_BY_CODE = byCode;
            window.SHOBI_CATCHER_CARD_AUDIT = {
                scope: '1-20',
                total: 20,
                loaded: Object.keys(byCode).length,
                missing
            };
            console.log(`Official Catcher card bridge #1-#20: ${Object.keys(byCode).length}/20 loaded.`);
            if (missing.length) console.warn('Official Catcher card bridge missing:', missing);
        } catch (error) {
            console.error('Official Catcher card bridge failed; static card fallbacks remain active.', error);
        }
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
            generatedAt: payload.generated_at || null
        };
        console.log(`Verified note enrichment #21-#100: ${enriched}/${codes.length}.`);
        if (unresolved.length) console.info('Best Seller note records still requiring verification:', unresolved);
    }

    if (typeof init === 'function') {
        const baseInit = init;
        init = async function () {
            await loadOfficialCatcherForFirst20();
            await baseInit();
            await enrichBestSellerNotes();
            if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender();
        };
    }
})();
