#!/usr/bin/env python3
import csv
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / 'Shobi Master Database' / 'shobi-master-current.csv'
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
        return ''
    code = f'{m.group(1)}-{m.group(2)}' + (f' {m.group(3)}' if m.group(3) else '')
    return ALIASES.get(code, code)


def code_from_row(row):
    # shobi_name carries the complete retail code (e.g. suffix EL/WP/N/M/LUX).
    # shobi_code is often only the prefix. Prefer the complete official name code,
    # then fall back generically to shobi_code when needed.
    return norm_code(row.get('shobi_name')) or norm_code(row.get('shobi_code'))


def main():
    with MASTER.open('r', encoding='utf-8-sig', newline='') as fh:
        rows = list(csv.DictReader(fh))

    if len(rows) < 2200:
        raise SystemExit(f'Safety stop: official current Shobi master unexpectedly small ({len(rows)} rows)')

    selected = []
    seen = set()
    source_row = 0

    for row in rows:
        source_row += 1
        code = code_from_row(row)
        if not code:
            continue
        if code in seen:
            raise SystemExit(f'Safety stop: duplicate Shobi code {code} before Top100 completion')
        seen.add(code)

        selected.append({
            'rank': len(selected) + 1,
            'source_row': source_row,
            'prestashop_product_id': clean(row.get('prestashop_product_id')),
            'shobi_code': code,
            'shobi_name': clean(row.get('shobi_name')),
            'inspired_by': clean(row.get('inspired_by')),
            'category': clean(row.get('category')),
            'url': clean(row.get('url')),
            'status': clean(row.get('status')),
            'classification_rule': clean(row.get('classification_rule')),
            'source': clean(row.get('source')),
        })
        if len(selected) == 100:
            break

    if len(selected) != 100:
        raise SystemExit(f'Safety stop: expected 100 valid rows from official current Shobi master, got {len(selected)}')
    if [x['rank'] for x in selected] != list(range(1, 101)):
        raise SystemExit('Safety stop: non-contiguous Top100 ranking')
    if len({x['shobi_code'] for x in selected}) != 100:
        raise SystemExit('Safety stop: duplicate Shobi codes in clean Top100')
    if any(x['status'] and x['status'] != 'ACTIVE' for x in selected):
        raise SystemExit('Safety stop: inactive product found inside first 100 official master rows')

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        'schema_version': 3,
        'method': 'First 100 valid rows of official current Shobi Master, preserving source order exactly',
        'built_at': datetime.now(timezone.utc).isoformat(),
        'ranking_authority': 'Shobi Master Database/shobi-master-current.csv',
        'master_count': len(rows),
        'count': 100,
        'records': selected,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print(f'OFFICIAL_MASTER_ROWS={len(rows)}')
    print('CLEAN_SHOBI_TOP100=100')
    print('FIRST_20=' + ','.join(x['shobi_code'] for x in selected[:20]))
    print('LAST_10=' + ','.join(x['shobi_code'] for x in selected[-10:]))
    print(f'OUTPUT={OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
