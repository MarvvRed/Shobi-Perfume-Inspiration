#!/usr/bin/env python3
import csv
import json
from collections import Counter
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
MASTER = REPO_ROOT / 'shobi-master.csv'
RUNTIME = SCRIPT_DIR.parent / 'site-runtime-v2.json'


def truthy(value):
    return str(value or '').strip().lower() in {'1', 'true', 'yes', 'y'}


def main():
    with MASTER.open(encoding='utf-8-sig', newline='') as fh:
        rows = list(csv.DictReader(fh))

    if len(rows) < 500:
        raise SystemExit(f'Invalid master row count: {len(rows)}')

    products = []
    code_counts = Counter()
    for row in rows:
        code = str(row.get('shobi_code') or '').strip()
        key = ''.join(code.upper().split())
        if not code or not key:
            raise SystemExit('Master contains blank shobi_code')
        code_counts[key] += 1

        name = str(row.get('inspired_by') or row.get('shobi_name') or code).strip()
        brand = str(row.get('brand') or '').strip()
        gender = str(row.get('gender') or '').strip().lower()
        status = str(row.get('status') or '').strip()
        raw_rank = str(row.get('best_seller_rank') or '').strip()
        rank = int(raw_rank) if raw_rank.isdigit() else 0

        products.append([
            code,
            name,
            brand,
            gender,
            status,
            1 if truthy(row.get('new')) else 0,
            rank,
        ])

    duplicates = sorted((code, count) for code, count in code_counts.items() if count > 1)
    if duplicates:
        print('RUNTIME_DUPLICATE_SHOBI_CODES', duplicates)

    payload = {'v': 2, 'count': len(products), 'p': products}
    RUNTIME.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(',', ':')),
        encoding='utf-8',
    )

    print(
        f'RUNTIME_REBUILT source={MASTER} rows={len(products)} '
        f'unique_codes={len(code_counts)} duplicate_code_groups={len(duplicates)}'
    )


if __name__ == '__main__':
    main()
