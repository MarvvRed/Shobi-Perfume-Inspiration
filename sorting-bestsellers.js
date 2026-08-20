// Bestseller sorting uses the generated perfume-only Shobi ranking.
// It is independent from shobi-master.csv row order.
const FULL_BEST_SELLER_RANK = new Map(
    Object.entries(window.SHOBI_BESTSELLER_RANK_BY_CODE || {}).map(([code, rank]) => [String(code), Number(rank)])
);

sortPerfumes = function(perfumes) {
    const sorted = [...perfumes];

    sorted.sort((a, b) => {
        if (state.sortOrder === 'best-seller') {
            const rankA = FULL_BEST_SELLER_RANK.has(String(a.code)) ? FULL_BEST_SELLER_RANK.get(String(a.code)) : Infinity;
            const rankB = FULL_BEST_SELLER_RANK.has(String(b.code)) ? FULL_BEST_SELLER_RANK.get(String(b.code)) : Infinity;
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

console.log(`Loaded ${FULL_BEST_SELLER_RANK.size} filtered Shobi perfume bestseller ranks.`);
