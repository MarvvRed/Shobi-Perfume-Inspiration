#!/usr/bin/env python3
import csv
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / 'shobi-master.csv'
BEST = ROOT / 'shobi-bestsellers.json'


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


def main():
    data = json.loads(BEST.read_text(encoding='utf-8'))
    codes = data.get('codes', []) if isinstance(data, dict) else []
    if len(codes) < 500:
        raise SystemExit('Invalid shobi-bestsellers.json')

    ranks = {key(code): i + 1 for i, code in enumerate(codes)}
    if len(ranks) != len(codes):
        raise SystemExit('Duplicate bestseller codes')
    base_ranks = unique_base_index((code, i + 1) for i, code in enumerate(codes))

    with MASTER.open(encoding='utf-8-sig', newline='') as fh:
        rows = list(csv.DictReader(fh))
        fields = list(rows[0].keys()) if rows else []
    if len(rows) < 500:
        raise SystemExit('Invalid shobi-master.csv')
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
        raise SystemExit(f'Too few bestseller ranks matched master: {matched}')

    top40 = {i for i in range(1, 41)}
    found_top40 = {int(row['best_seller_rank']) for row in rows if str(row.get('best_seller_rank') or '').isdigit() and int(row['best_seller_rank']) <= 40}
    missing_top40 = sorted(top40 - found_top40)
    if missing_top40:
        raise SystemExit(f'Top 40 bestseller ranks missing from master: {missing_top40}')

    with MASTER.open('w', encoding='utf-8-sig', newline='') as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    print('MASTER_BESTSELLER_RANKED', matched, 'EXACT', exact_matched, 'FALLBACK', fallback_matched, 'TOP40_OK')


if __name__ == '__main__':
    main()
