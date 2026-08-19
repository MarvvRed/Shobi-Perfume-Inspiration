// Override bestseller sorting with the complete official Shobi ranking loaded from bestsellers-*.js.
const FULL_BEST_SELLER_RANK = new Map(
    (window.SHOBI_BESTSELLER_CODES || []).map((code, index) => [code, index])
);

sortPerfumes = function(perfumes) {
    const sorted = [...perfumes];

    sorted.sort((a, b) => {
        if (state.sortOrder === 'best-seller') {
            const rankA = FULL_BEST_SELLER_RANK.has(a.code) ? FULL_BEST_SELLER_RANK.get(a.code) : Infinity;
            const rankB = FULL_BEST_SELLER_RANK.has(b.code) ? FULL_BEST_SELLER_RANK.get(b.code) : Infinity;
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

console.log(`Loaded ${FULL_BEST_SELLER_RANK.size} official Shobi bestseller ranks.`);
