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

sortPerfumes = function(perfumes) {
    const sorted = [...perfumes];

    sorted.sort((a, b) => {
        if (state.sortOrder === 'best-seller') {
            const rankA = getBestSellerRank(a.code);
            const rankB = getBestSellerRank(b.code);
            if (rankA !== rankB) return rankA - rankB;
            return compareText(a.brand, b.brand) || compareText(a.inspiredBy, b.inspiredBy);
        }

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
