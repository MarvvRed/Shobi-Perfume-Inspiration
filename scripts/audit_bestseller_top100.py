#!/usr/bin/env python3
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / 'shobi-master.csv'
RANKING = ROOT / 'bestseller-ranking.js'
OUT_CSV = ROOT / 'bestseller-top100-audit.csv'
OUT_SUMMARY = ROOT / 'bestseller-top100-audit-summary.txt'


def clean(v):
    return re.sub(r'\s+', ' ', str(v or '')).strip()


def norm_code(v):
    return re.sub(r'\s+', '', clean(v).upper())


def split_pipe(v):
    return [clean(x) for x in str(v or '').split('|') if clean(x)]


def load_ranking():
    text = RANKING.read_text(encoding='utf-8')
    m = re.search(r'window\.SHOBI_BESTSELLER_RANKING=(\[.*?\]);', text, re.S)
    if not m:
        raise SystemExit('Could not parse bestseller-ranking.js')
    rows = json.loads(m.group(1))
    rows = [x for x in rows if int(x.get('rank', 0)) <= 100]
    if len(rows) != 100:
        raise SystemExit(f'Expected exactly 100 QA ranking entries, found {len(rows)}')
    return rows


def note_list(row):
    values = []
    for col in ('top_notes', 'heart_notes', 'base_notes'):
        for n in split_pipe(row.get(col)):
            if n.casefold() not in {x.casefold() for x in values}:
                values.append(n)
    return values


def main():
    ranking = load_ranking()
    with MASTER.open('r', encoding='utf-8-sig', newline='') as fh:
        master_rows = list(csv.DictReader(fh))
    by_code = {}
    for row in master_rows:
        code = norm_code(row.get('shobi_code'))
        if code and code not in by_code:
            by_code[code] = row

    audit = []
    for item in ranking:
        rank = int(item['rank'])
        code = clean(item['code'])
        row = by_code.get(norm_code(code))
        if not row:
            audit.append({
                'rank': rank, 'shobi_code': code, 'inspired_by': '', 'brand': '', 'gender': '',
                'season': '', 'note_count': 0, 'main_5_notes': '', 'fragrantica_url': '',
                'name_ok': 0, 'brand_ok': 0, 'gender_ok': 0, 'season_ok': 0, 'notes5_ok': 0,
                'fragrantica_ok': 0, 'complete_core': 0, 'status': 'MISSING_FROM_MASTER'
            })
            continue

        name = clean(row.get('inspired_by') or row.get('shobi_name'))
        brand = clean(row.get('brand'))
        gender = clean(row.get('gender')).lower()
        seasons = split_pipe(row.get('season'))
        notes = note_list(row)
        frag = clean(row.get('fragrantica_url'))
        code_compact = norm_code(code)
        name_compact = norm_code(name)
        name_ok = bool(name and name_compact != code_compact)
        brand_ok = bool(brand and brand.lower() not in {'unknown brand', 'unknown'})
        gender_ok = gender in {'male', 'female', 'unisex', 'men', 'women'}
        season_ok = len(seasons) >= 1
        notes5_ok = len(notes) >= 5
        frag_ok = frag.startswith('http')
        complete_core = all((name_ok, brand_ok, gender_ok, season_ok, notes5_ok))
        missing = []
        if not name_ok: missing.append('name')
        if not brand_ok: missing.append('brand')
        if not gender_ok: missing.append('gender')
        if not season_ok: missing.append('season')
        if not notes5_ok: missing.append('notes5')
        if not frag_ok: missing.append('fragrantica')
        audit.append({
            'rank': rank,
            'shobi_code': code,
            'inspired_by': name,
            'brand': brand,
            'gender': gender,
            'season': '|'.join(seasons),
            'note_count': len(notes),
            'main_5_notes': '|'.join(notes[:5]),
            'fragrantica_url': frag,
            'name_ok': int(name_ok),
            'brand_ok': int(brand_ok),
            'gender_ok': int(gender_ok),
            'season_ok': int(season_ok),
            'notes5_ok': int(notes5_ok),
            'fragrantica_ok': int(frag_ok),
            'complete_core': int(complete_core),
            'status': 'OK' if complete_core else 'MISSING:' + ','.join(missing),
        })

    fields = list(audit[0].keys())
    with OUT_CSV.open('w', encoding='utf-8', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(audit)

    def count(field):
        return sum(int(x[field]) for x in audit)

    missing_master = sum(x['status'] == 'MISSING_FROM_MASTER' for x in audit)
    incomplete = [x for x in audit if not int(x['complete_core'])]
    summary = [
        'BESTSELLER TOP 100 ENRICHMENT AUDIT',
        f'TOTAL=100',
        f'MISSING_FROM_MASTER={missing_master}',
        f'NAME_OK={count("name_ok")}/100',
        f'BRAND_OK={count("brand_ok")}/100',
        f'GENDER_OK={count("gender_ok")}/100',
        f'SEASON_OK={count("season_ok")}/100',
        f'NOTES5_OK={count("notes5_ok")}/100',
        f'FRAGRANTICA_OK={count("fragrantica_ok")}/100',
        f'COMPLETE_CORE={count("complete_core")}/100',
        f'INCOMPLETE_CORE={len(incomplete)}/100',
        '',
        'INCOMPLETE_ROWS:',
    ]
    summary.extend(
        f"#{x['rank']} {x['shobi_code']} | {x['inspired_by'] or '-'} | {x['status']}"
        for x in incomplete
    )
    OUT_SUMMARY.write_text('\n'.join(summary) + '\n', encoding='utf-8')

    print('\n'.join(summary[:11]))


if __name__ == '__main__':
    main()
