#!/usr/bin/env python3
# Canonical Top100 builder for the official Fragrantica ID Mapping Rule.
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / 'Fragrantica ID Database'
OUT = DB / 'mappings' / 'bestseller-001-100.json'
JSOUT = ROOT / 'bestseller-001-100-canonical-data.js'
UNRESOLVED = DB / 'validation' / 'unresolved.json'

LOCK1 = ROOT / 'Shobi Master Database' / 'bestseller-top100-source-lock.csv'
LOCK2 = ROOT / 'Shobi Master Database' / 'bestseller-top100-source-lock-pass2.csv'
TOP40 = ROOT / 'Shobi Master Database' / 'bestseller-top40-enrichment.csv'
ENRICH = ROOT / 'Shobi Master Database' / 'bestseller-top100-enrichment.csv'
NOTES_1_20 = ROOT / 'Personal Database' / 'fragrantica-main-notes.json'
NOTES_21_40 = ROOT / 'Personal Database' / 'fragrantica-main-notes-21-40.json'
NOTES_41_100 = ROOT / 'Personal Database' / 'fragrantica-main-notes-41-100.json'

ID_PATTERNS = (
    re.compile(r'-(\d+)\.html(?:[?#].*)?$', re.I),
    re.compile(r'/p/(\d+)(?:[/?#].*)?$', re.I),
)


def clean(v):
    return ' '.join(str(v or '').split()).strip()


def norm_code(v):
    return re.sub(r'\s+', '', clean(v).upper())


def read_csv(path):
    with path.open('r', encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def fragrantica_url(row):
    for field in ('primary_source', 'secondary_source'):
        url = clean(row.get(field))
        if 'fragrantica.' in url.lower():
            return url
    return ''


def fragrantica_id(url):
    url = clean(url)
    for pattern in ID_PATTERNS:
        m = pattern.search(url)
        if m:
            return int(m.group(1))
    return None


def derived(fid):
    return {
        'social_card_url': f'https://fimgs.net/mdimg/perfume-social-cards/en-p_c_{fid}.jpeg',
        'image_url': f'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.{fid}.avif',
    }


def authoritative_rows():
    top40 = read_csv(TOP40)
    legacy = read_csv(ENRICH)
    if [int(r['rank']) for r in top40] != list(range(1, 41)):
        raise SystemExit('Safety stop: authoritative Top40 ranks must be exactly 1..40')
    late = [r for r in legacy if 41 <= int(r['rank']) <= 100]
    if [int(r['rank']) for r in late] != list(range(41, 101)):
        raise SystemExit('Safety stop: legacy Top100 late ranks must be exactly 41..100')
    rows = top40 + late
    if len(rows) != 100:
        raise SystemExit(f'Safety stop: expected 100 authoritative ranking rows, got {len(rows)}')
    return rows


def load_locks_by_code():
    out = {}
    for path in (LOCK1, LOCK2):
        for r in read_csv(path):
            code = clean(r.get('shobi_code'))
            url = fragrantica_url(r)
            fid = fragrantica_id(url)
            if not code or not url or not fid:
                continue
            out[norm_code(code)] = {
                'shobi_code': code,
                'fragrantica_url': url,
                'fragrantica_id': fid,
                'verified_fields': [x for x in clean(r.get('verified_fields')).split('|') if x],
                'source_status': clean(r.get('status')),
                'identity_source': str(path.relative_to(ROOT)),
            }
    return out


def note_payload(item):
    notes = []
    for n in item.get('notes') or []:
        note = clean(n.get('note'))
        if note:
            notes.append({
                'rank': int(n.get('rank') or len(notes) + 1),
                'note': note,
                'sastojak_id': n.get('sastojak_id'),
                'votes': n.get('votes'),
            })
    return notes


def load_captures():
    notes_by_id = {}
    identity_by_code = {}

    p1 = json.loads(NOTES_1_20.read_text(encoding='utf-8'))
    for key, item in (p1.get('perfumes') or {}).items():
        fid = int(item.get('fragrantica_id') or key)
        notes_by_id[fid] = {
            'notes': note_payload(item),
            'capture_source': str(NOTES_1_20.relative_to(ROOT)),
        }

    for path in (NOTES_21_40, NOTES_41_100):
        payload = json.loads(path.read_text(encoding='utf-8'))
        for item in payload.get('results') or []:
            fid = int(item['fragrantica_id'])
            code = clean(item.get('shobi_code'))
            url = clean(item.get('url'))
            notes_by_id[fid] = {
                'notes': note_payload(item),
                'capture_source': str(path.relative_to(ROOT)),
            }
            if code and url and fid:
                identity_by_code[norm_code(code)] = {
                    'shobi_code': code,
                    'fragrantica_url': url,
                    'fragrantica_id': fid,
                    'verified_fields': ['identity', 'gender', 'notes'],
                    'source_status': 'source-locked',
                    'identity_source': str(path.relative_to(ROOT)),
                }
    return notes_by_id, identity_by_code


def main():
    ranked = authoritative_rows()
    locks_by_code = load_locks_by_code()
    notes_by_id, captures_by_code = load_captures()

    records, unresolved, seen_codes = [], [], set()

    for ranked_row in ranked:
        rank = int(ranked_row['rank'])
        code = clean(ranked_row.get('shobi_code'))
        k = norm_code(code)
        if not code or k in seen_codes:
            raise SystemExit(f'Safety stop: invalid or duplicate Shobi code at rank {rank}: {code}')
        seen_codes.add(k)

        # Exact-code identity is authoritative. Verified catcher identity wins when present;
        # otherwise use the source-lock for the same Shobi code. Legacy rank is never a join key.
        identity = captures_by_code.get(k) or locks_by_code.get(k)
        if not identity:
            raise SystemExit(f'Safety stop: no verified Fragrantica identity for rank {rank} code {code}')

        fid = identity['fragrantica_id']
        note_cap = notes_by_id.get(fid)
        notes = note_cap['notes'] if note_cap else []
        if not notes:
            unresolved.append({
                'rank': rank, 'shobi_code': code, 'fragrantica_id': fid,
                'field': 'main_notes', 'reason': 'No verified Fragrantica note capture for mapped ID'
            })

        gender = clean(ranked_row.get('gender')) if 'gender' in identity['verified_fields'] else ''
        if not gender:
            unresolved.append({
                'rank': rank, 'shobi_code': code, 'fragrantica_id': fid,
                'field': 'gender', 'reason': 'Gender not verified for canonical identity'
            })

        unresolved.append({
            'rank': rank, 'shobi_code': code, 'fragrantica_id': fid,
            'field': 'season', 'reason': 'Awaiting Fragrantica seasonal-vote capture for canonical ID'
        })

        urls = derived(fid)
        records.append({
            'rank': rank,
            'shobi_code': code,
            'perfume': clean(ranked_row.get('perfume')),
            'fragrantica_id': fid,
            'fragrantica_url': identity['fragrantica_url'],
            'social_card_url': urls['social_card_url'],
            'image_url': urls['image_url'],
            'gender': gender or None,
            'season': None,
            'main_notes': [n['note'] for n in notes],
            'main_note_evidence': notes,
            'verification': {
                'identity': True,
                'gender': bool(gender),
                'main_notes': bool(notes),
                'season': False,
                'source_status': identity['source_status'],
                'identity_source': identity['identity_source'],
                'note_capture': note_cap['capture_source'] if note_cap else None,
            },
        })

    if [r['rank'] for r in records] != list(range(1, 101)):
        raise SystemExit('Safety stop: canonical records are not exactly ranks 1..100')

    payload = {
        'schema_version': 1,
        'method': 'Fragrantica ID Mapping Rule',
        'scope': 'Shobi Best Seller 1-100',
        'count': len(records),
        'canonical_key': 'fragrantica_id',
        'ranking_key': 'shobi_code',
        'resource_rule': 'One verified identity -> one Fragrantica ID -> page + social card/main notes + image + gender + season',
        'records': records,
    }

    DB.joinpath('mappings').mkdir(parents=True, exist_ok=True)
    DB.joinpath('validation').mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    UNRESOLVED.write_text(json.dumps({
        'schema_version': 1,
        'method': 'Fragrantica ID Mapping Rule',
        'scope': 'Shobi Best Seller 1-100',
        'count': len(unresolved),
        'items': unresolved,
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    by_code = {norm_code(r['shobi_code']): r for r in records}
    JSOUT.write_text(
        '// Generated from Fragrantica ID Database by the official Fragrantica ID Mapping Rule; do not hand edit.\n'
        + 'window.SHOBI_FRAGRANTICA_CANONICAL_TOP100='
        + json.dumps(by_code, ensure_ascii=False, separators=(',', ':'))
        + ';\n',
        encoding='utf-8',
    )

    print(f'CANONICAL_RECORDS={len(records)}')
    print(f'IDENTITY_VERIFIED={sum(1 for x in records if x["verification"]["identity"])}')
    print(f'GENDER_VERIFIED={sum(1 for x in records if x["verification"]["gender"])}')
    print(f'MAIN_NOTES_VERIFIED={sum(1 for x in records if x["verification"]["main_notes"])}')
    print(f'SEASON_VERIFIED={sum(1 for x in records if x["verification"]["season"])}')
    print(f'UNRESOLVED_FIELDS={len(unresolved)}')


if __name__ == '__main__':
    main()
