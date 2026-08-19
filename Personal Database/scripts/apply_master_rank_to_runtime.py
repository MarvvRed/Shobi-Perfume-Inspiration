#!/usr/bin/env python3
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / 'shobi-master.csv'
RUNTIME = ROOT / 'site-runtime-v2.json'


def key(value):
    return re.sub(r'\s+', '', str(value or '').upper())


def main():
    with MASTER.open(encoding='utf-8-sig', newline='') as fh:
        rows = list(csv.DictReader(fh))
    ranks = {}
    for row in rows:
        raw = str(row.get('best_seller_rank') or '').strip()
        if raw:
            ranks[key(row.get('shobi_code'))] = int(raw)
    if len(ranks) < 500:
        raise SystemExit(f'Canonical master has too few bestseller ranks: {len(ranks)}')

    data = json.loads(RUNTIME.read_text(encoding='utf-8'))
    products = data.get('p', [])
    matched = 0
    for product in products:
        if not isinstance(product, list) or not product:
            continue
        rank = ranks.get(key(product[0]), 0)
        while len(product) < 7:
            product.append(0)
        product[6] = rank
        if rank:
            matched += 1
    if matched < 500:
        raise SystemExit(f'Runtime matched too few master bestseller ranks: {matched}')
    RUNTIME.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('RUNTIME_BESTSELLER_RANKED', matched)


if __name__ == '__main__':
    main()
