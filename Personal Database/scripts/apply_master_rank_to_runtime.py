#!/usr/bin/env python3
import csv
import json
import re
from collections import defaultdict
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
MASTER = REPO_ROOT / 'shobi-master.csv'
RUNTIME = SCRIPT_DIR.parent / 'site-runtime-v2.json'


def key(value):
    return re.sub(r'\s+', '', str(value or '').upper())


def base_key(value):
    m = re.match(r'\s*(\d+)', str(value or ''))
    return m.group(1) if m else ''


def main():
    with MASTER.open(encoding='utf-8-sig', newline='') as fh:
        rows = list(csv.DictReader(fh))

    ranks = {}
    grouped = defaultdict(list)
    for row in rows:
        raw = str(row.get('best_seller_rank') or '').strip()
        if not raw:
            continue
        rank = int(raw)
        code = row.get('shobi_code')
        ranks[key(code)] = rank
        base = base_key(code)
        if base:
            grouped[base].append(rank)

    if len(ranks) < 500:
        raise SystemExit(f'Canonical root master has too few bestseller ranks: {len(ranks)}')

    base_ranks = {base: values[0] for base, values in grouped.items() if len(values) == 1}

    data = json.loads(RUNTIME.read_text(encoding='utf-8'))
    products = data.get('p', [])
    matched = 0
    exact_matched = 0
    fallback_matched = 0
    runtime_top40 = set()

    for product in products:
        if not isinstance(product, list) or not product:
            continue
        code = product[0]
        rank = ranks.get(key(code), 0)
        if rank:
            exact_matched += 1
        else:
            rank = base_ranks.get(base_key(code), 0)
            if rank:
                fallback_matched += 1
        while len(product) < 7:
            product.append(0)
        product[6] = rank
        if rank:
            matched += 1
            if rank <= 40:
                runtime_top40.add(rank)

    if matched < 500:
        raise SystemExit(f'Runtime matched too few root-master bestseller ranks: {matched}')

    missing_top40 = sorted(set(range(1, 41)) - runtime_top40)
    if missing_top40:
        raise SystemExit(f'Top 40 bestseller ranks missing from runtime: {missing_top40}')

    RUNTIME.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print('RUNTIME_BESTSELLER_RANKED_FROM_ROOT_MASTER', matched, 'EXACT', exact_matched, 'FALLBACK', fallback_matched, 'TOP40_OK')


if __name__ == '__main__':
    main()
