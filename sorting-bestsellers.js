// Bestseller sorting uses the generated perfume-only Shobi ranking.
// It is independent from shobi-master.csv row order.
const normalizeBestSellerCode = value => String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
const bestSellerBaseCode = value => {
    const normalized = normalizeBestSellerCode(value);
    const match = normalized.match(/^(\d+)-([A-Z0-9]+)/);
    return match ? `${match[1]}-${match[2]}` : normalized;
};

const FULL_BEST_SELLER_RANK = new Map();
const BASE_BEST_SELLER_RANK = new Map();
const AMBIGUOUS_BASE_CODES = new Set();

Object.entries(window.SHOBI_BESTSELLER_RANK_BY_CODE || {}).forEach(([code, rankValue]) => {
    const rank = Number(rankValue);
    const exact = normalizeBestSellerCode(code);
    const base = bestSellerBaseCode(code);
    FULL_BEST_SELLER_RANK.set(exact, rank);

    if (!BASE_BEST_SELLER_RANK.has(base)) {
        BASE_BEST_SELLER_RANK.set(base, rank);
    } else if (BASE_BEST_SELLER_RANK.get(base) !== rank) {
        // Never guess when two ranked products share the same numeric-brand base.
        AMBIGUOUS_BASE_CODES.add(base);
        BASE_BEST_SELLER_RANK.delete(base);
    }
});

function getBestSellerRank(code) {
    const exact = normalizeBestSellerCode(code);
    if (FULL_BEST_SELLER_RANK.has(exact)) return FULL_BEST_SELLER_RANK.get(exact);

    const base = bestSellerBaseCode(exact);
    if (!AMBIGUOUS_BASE_CODES.has(base) && BASE_BEST_SELLER_RANK.has(base)) {
        return BASE_BEST_SELLER_RANK.get(base);
    }
    return Infinity;
}

function chooseCanonicalBestSellerVariant(current, candidate) {
    if (!current) return candidate;

    const currentExact = FULL_BEST_SELLER_RANK.has(normalizeBestSellerCode(current.code));
    const candidateExact = FULL_BEST_SELLER_RANK.has(normalizeBestSellerCode(candidate.code));

    // Prefer the exact variant explicitly present in the official ranking.
    if (candidateExact && !currentExact) return candidate;
    if (currentExact && !candidateExact) return current;

    const currentRank = getBestSellerRank(current.code);
    const candidateRank = getBestSellerRank(candidate.code);
    if (candidateRank < currentRank) return candidate;
    if (currentRank < candidateRank) return current;

    // Stable deterministic fallback if two catalog rows share the same base code.
    return compareText(candidate.code, current.code) < 0 ? candidate : current;
}

function dedupeBestSellerVariants(perfumes) {
    const byBase = new Map();
    perfumes.forEach(perfume => {
        const base = bestSellerBaseCode(perfume.code);
        byBase.set(base, chooseCanonicalBestSellerVariant(byBase.get(base), perfume));
    });
    return [...byBase.values()];
}

sortPerfumes = function(perfumes) {
    let sorted = [...perfumes];

    if (state.sortOrder === 'best-seller') {
        // A Best Seller position represents one Shobi perfume/base-code, not all
        // catalog variants (MIX, alternate suffixes, etc.). Keep the catalog
        // complete for every other sort, but collapse variants here only.
        sorted = dedupeBestSellerVariants(sorted);
        sorted.sort((a, b) => {
            const rankA = getBestSellerRank(a.code);
            const rankB = getBestSellerRank(b.code);
            if (rankA !== rankB) return rankA - rankB;
            return compareText(a.brand, b.brand) || compareText(a.inspiredBy, b.inspiredBy);
        });
        return sorted;
    }

    sorted.sort((a, b) => {
        if (state.sortOrder === 'brand-za') {
            return compareText(b.brand, a.brand) || compareText(b.inspiredBy, a.inspiredBy);
        }

        if (state.sortOrder === 'name-az') {
            return compareText(a.inspiredBy, b.inspiredBy) || compareText(a.brand, b.brand);
        }

        if (state.sortOrder === 'name-za') {
            return compareText(b.inspiredBy, a.inspiredBy) || compareText(a.brand, b.brand);
        }

        return compareText(a.brand, b.brand) || compareText(a.inspiredBy, b.inspiredBy);
    });

    return sorted;
};

console.log(`Loaded ${FULL_BEST_SELLER_RANK.size} filtered Shobi perfume bestseller ranks (${BASE_BEST_SELLER_RANK.size} safe base-code fallbacks).`);
