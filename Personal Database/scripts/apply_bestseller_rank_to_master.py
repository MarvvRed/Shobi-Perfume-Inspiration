#!/usr/bin/env python3
import csv
import json
import re
from collections import defaultdict
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
MASTER = REPO_ROOT / 'shobi-master.csv'
BEST = SCRIPT_DIR.parent / 'shobi-bestsellers.json'
LIVE40 = SCRIPT_DIR.parent / 'bestseller-top40-live.json'


def key(value):
    return re.sub(r'\s+', '', str(value or '').upper())


def base_key(value):
    """Stable Shobi product id: leading numeric code only."""
    m = re.match(r'\s*(\d+)', str(value or ''))
    return m.group(1) if m else ''


def unique_base_index(items):
    grouped = defaultdict(list)
    for code, rank in items:
        base = base_key(code)
        if base:
            grouped[base].append(rank)
    return {base: values[0] for base, values in grouped.items() if len(values) == 1}


def load_effective_codes():
    data = json.loads(BEST.read_text(encoding='utf-8'))
    codes = data.get('codes', []) if isinstance(data, dict) else []
    if len(codes) < 500:
        raise SystemExit('Invalid shobi-bestsellers.json')

    live = json.loads(LIVE40.read_text(encoding='utf-8'))
    live40 = live.get('codes', []) if isinstance(live, dict) else []
    if len(live40) != 40:
        raise SystemExit(f'Invalid bestseller-top40-live.json count: {len(live40)}')
    live_bases = [base_key(code) for code in live40]
    if not all(live_bases) or len(set(live_bases)) != 40:
        raise SystemExit('Invalid or duplicate base codes in bestseller-top40-live.json')

    # The verified live Top 40 is authoritative for ranks 1-40.
    # Remove the same products from the older full ranking before appending the tail,
    # preventing duplicates while preserving the old order beyond the tested window.
    live_base_set = set(live_bases)
    tail = [code for code in codes if base_key(code) not in live_base_set]
    effective = live40 + tail
    return effective


def main():
    codes = load_effective_codes()

    ranks = {key(code): i + 1 for i, code in enumerate(codes)}
    if len(ranks) != len(codes):
        raise SystemExit('Duplicate bestseller codes after Top 40 overlay')
    base_ranks = unique_base_index((code, i + 1) for i, code in enumerate(codes))

    with MASTER.open(encoding='utf-8-sig', newline='') as fh:
        rows = list(csv.DictReader(fh))
        fields = list(rows[0].keys()) if rows else []
    if len(rows) < 500:
        raise SystemExit('Invalid root shobi-master.csv')
    if 'best_seller_rank' not in fields:
        insert_at = fields.index('shobi_url') if 'shobi_url' in fields else len(fields)
        fields.insert(insert_at, 'best_seller_rank')

    matched = 0
    exact_matched = 0
    fallback_matched = 0
    for row in rows:
        code = row.get('shobi_code')
        rank = ranks.get(key(code))
        if rank:
            exact_matched += 1
        else:
            rank = base_ranks.get(base_key(code))
            if rank:
                fallback_matched += 1
        row['best_seller_rank'] = str(rank or '')
        if rank:
            matched += 1

    if matched < 500:
        raise SystemExit(f'Too few bestseller ranks matched root master: {matched}')

    top40 = set(range(1, 41))
    found_top40 = {int(row['best_seller_rank']) for row in rows if str(row.get('best_seller_rank') or '').isdigit() and int(row['best_seller_rank']) <= 40}
    missing_top40 = sorted(top40 - found_top40)
    if missing_top40:
        raise SystemExit(f'Top 40 bestseller ranks missing from root master: {missing_top40}')

    with MASTER.open('w', encoding='utf-8-sig', newline='') as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    print('ROOT_MASTER_BESTSELLER_RANKED', matched, 'EXACT', exact_matched, 'FALLBACK', fallback_matched, 'TOP40_OK')


if __name__ == '__main__':
    main()
