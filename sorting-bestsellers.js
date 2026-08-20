// Bestseller sorting uses only explicitly verified ranks and never shobi-master.csv row order.
// #1-#20 come from the previously validated ranking; #21 is Sauvage Elixir.
const VERIFIED_BESTSELLER_CODES = [
    ...(window.SHOBI_BESTSELLER_CODES || []).slice(0, 20),
    "1644-DRC M"
];

const FULL_BEST_SELLER_RANK = new Map(
    VERIFIED_BESTSELLER_CODES.map((code, index) => [String(code), index])
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

console.log(`Loaded ${FULL_BEST_SELLER_RANK.size} verified Shobi bestseller ranks.`);
