#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'shobi-catalog.json'

PATTERNS = (
    r'inspired by(?: the)?(?: fragrance)?(?: notes)?(?: of)?\s+(.+?)(?:\.|\b(?:Women|Men|Unisex)\b)',
    r'Εμπνευσμένο από (?:τις )?(?:αρωματικές )?νότες (?:του|του οίκου|του αρώματος)\s+(.+?)(?:\.|\b(?:Γυναικείο|Ανδρικό|Unisex)\b)',
    r'Εμπνευσμένο από το (?:γυναικείο |ανδρικό )?άρωμα\s+(.+?)(?:\.|\b(?:Γυναικείο|Ανδρικό|Unisex)\b)',
)


def clean(value):
    return re.sub(r'\s+', ' ', str(value or '')).strip()


def explicit_inspiration(product):
    text = clean(product.get('description'))
    if not text:
        return ''
    for pattern in PATTERNS:
        match = re.search(pattern, text, re.I)
        if match:
            return clean(match.group(1)).strip(' -–—')
    return ''


def main():
    data = json.loads(CATALOG.read_text(encoding='utf-8'))
    products = data.get('products', [])
    if not isinstance(products, list) or len(products) < 500:
        raise SystemExit('Invalid shobi-catalog.json')

    locked = 0
    changed = 0
    for product in products:
        inspired = explicit_inspiration(product)
        if not inspired:
            continue
        locked += 1

        before = json.dumps(product, ensure_ascii=False, sort_keys=True)
        previous_source = clean(product.get('identity_source'))
        previous_trust = clean(product.get('identity_source_trust'))
        if previous_source and previous_source != clean(product.get('url')):
            product.setdefault('identity_secondary_source', previous_source)
        if previous_trust and previous_trust != 'official-shobi-explicit':
            product.setdefault('identity_secondary_source_trust', previous_trust)

        product['official_inspired_by'] = inspired
        product['original_perfume'] = inspired
        product['perfume'] = inspired
        product['identity_verified_official'] = True
        product['identity_source'] = clean(product.get('url')) or 'https://leparfum.com.gr/el/shobi'
        product['identity_source_trust'] = 'official-shobi-explicit'
        product['identity_match_rule'] = 'shobi-explicit-inspired-by'

        after = json.dumps(product, ensure_ascii=False, sort_keys=True)
        if after != before:
            changed += 1

    data['official_explicit_identity_count'] = locked
    CATALOG.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print('OFFICIAL_EXPLICIT_IDENTITIES', locked)
    print('OFFICIAL_IDENTITY_ROWS_CHANGED', changed)
    if locked == 0:
        raise SystemExit('No explicit Shobi inspiration identities detected; refusing precedence update')


if __name__ == '__main__':
    main()
