#!/usr/bin/env python3
import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / 'shobi-master-en.csv'
RAW = ROOT / 'shobi-best-sales-raw.csv'
OUT_DIR = ROOT / 'Fragrantica ID Database' / 'rebuild-top100'
OUT = OUT_DIR / 'shobi-top100-clean.json'

ALIASES = {
    '1685-FRED N': '1685-FRE N',
    '1068-CHA': '1068-CHA M',
    '1930-VIC': '1930-VIC M',
    '1156-HER': '1156-HER M',
    '1065-CHA': '1065-CHA M',
}


def clean(v):
    return re.sub(r'\s+', ' ', str(v or '')).strip()


def norm_code(v):
    v = clean(v).upper().replace('Ν', 'N')
    m = re.match(r'^(\d{1,5})\s*-\s*([A-Z0-9]+)(?:\s+([A-Z0-9]+))?', v)
    if not m:
        return v
    code = f'{m.group(1)}-{m.group(2)}' + (f' {m.group(3)}' if m.group(3) else '')
    return ALIASES.get(code, code)


def load_master():
    with MASTER.open('r', encoding='utf-8-sig', newline='') as fh:
        rows = list(csv.DictReader(fh))
    by_code = {}
    for row in rows:
        code = norm_code(row.get('shobi_code'))
        if code:
            by_code[code] = row
    if len(by_code) < 2200:
        raise SystemExit(f'Safety stop: filtered Shobi master unexpectedly small ({len(by_code)} codes)')
    return by_code


def main():
    if not RAW.exists():
        raise SystemExit('Safety stop: shobi-best-sales-raw.csv is missing. Capture/update it from the real browser before rebuilding.')

    master = load_master()
    with RAW.open('r', encoding='utf-8-sig', newline='') as fh:
        raw_rows = list(csv.DictReader(fh))
    if not raw_rows:
        raise SystemExit('Safety stop: raw Shobi Best Sales snapshot is empty')

    selected = []
    seen = set()
    skipped_not_in_master = 0
    last_global_rank = 0

    for raw in raw_rows:
        try:
            global_rank = int(clean(raw.get('global_rank')))
        except ValueError:
            raise SystemExit(f"Safety stop: invalid global_rank {raw.get('global_rank')!r}")
        if global_rank <= last_global_rank:
            raise SystemExit('Safety stop: raw Best Sales global ranks are not strictly increasing')
        last_global_rank = global_rank

        code = norm_code(raw.get('shobi_code'))
        if not code or code not in master:
            skipped_not_in_master += 1
            continue
        if code in seen:
            continue

        seen.add(code)
        mrow = master[code]
        selected.append({
            'rank': len(selected) + 1,
            'global_rank': global_rank,
            'shobi_code': code,
            'master_name': clean(mrow.get('inspired_by') or mrow.get('inspiredBy') or mrow.get('name') or mrow.get('perfume')),
            'master_brand': clean(mrow.get('brand')),
        })
        if len(selected) == 100:
            break

    if len(selected) != 100:
        raise SystemExit(f'Safety stop: expected 100 filtered Shobi perfumes, got {len(selected)}')
    if [x['rank'] for x in selected] != list(range(1, 101)):
        raise SystemExit('Safety stop: non-contiguous perfume-only ranking')
    if len({x['shobi_code'] for x in selected}) != 100:
        raise SystemExit('Safety stop: duplicate Shobi codes in clean Top100')

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        'schema_version': 2,
        'method': 'Real-browser Shobi Best Sales snapshot -> official Shobi Master filter -> clean Top100',
        'built_at': datetime.now(timezone.utc).isoformat(),
        'source_snapshot': 'shobi-best-sales-raw.csv',
        'master_source': 'shobi-master-en.csv',
        'count': 100,
        'raw_rows_available': len(raw_rows),
        'global_products_scanned_until_rank100': selected[-1]['global_rank'],
        'non_master_products_skipped_before_rank100': skipped_not_in_master,
        'records': selected,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print('CLEAN_SHOBI_TOP100=100')
    print(f'RAW_ROWS_AVAILABLE={len(raw_rows)}')
    print(f'GLOBAL_RANK_AT_FILTERED_100={selected[-1]["global_rank"]}')
    print(f'NON_MASTER_SKIPPED={skipped_not_in_master}')
    print('FIRST_20=' + ','.join(x['shobi_code'] for x in selected[:20]))
    print('LAST_10=' + ','.join(x['shobi_code'] for x in selected[-10:]))
    print(f'OUTPUT={OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
