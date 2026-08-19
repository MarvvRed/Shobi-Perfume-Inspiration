#!/usr/bin/env python3
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / 'shobi-master.csv'
BEST = ROOT / 'shobi-bestsellers.json'


def key(value):
    return re.sub(r'\s+', '', str(value or '').upper())


def main():
    data = json.loads(BEST.read_text(encoding='utf-8'))
    codes = data.get('codes', []) if isinstance(data, dict) else []
    if len(codes) < 500:
        raise SystemExit('Invalid shobi-bestsellers.json')
    ranks = {key(code): i + 1 for i, code in enumerate(codes)}
    if len(ranks) != len(codes):
        raise SystemExit('Duplicate bestseller codes')

    with MASTER.open(encoding='utf-8-sig', newline='') as fh:
        rows = list(csv.DictReader(fh))
        fields = list(rows[0].keys()) if rows else []
    if len(rows) < 500:
        raise SystemExit('Invalid shobi-master.csv')
    if 'best_seller_rank' not in fields:
        insert_at = fields.index('shobi_url') if 'shobi_url' in fields else len(fields)
        fields.insert(insert_at, 'best_seller_rank')

    matched = 0
    for row in rows:
        rank = ranks.get(key(row.get('shobi_code')))
        row['best_seller_rank'] = str(rank or '')
        if rank:
            matched += 1
    if matched < 500:
        raise SystemExit(f'Too few bestseller ranks matched master: {matched}')

    with MASTER.open('w', encoding='utf-8-sig', newline='') as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    print('MASTER_BESTSELLER_RANKED', matched)


if __name__ == '__main__':
    main()
