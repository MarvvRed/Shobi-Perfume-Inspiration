#!/usr/bin/env python3
# Canonical Top100 builder for the official Fragrantica ID Mapping Rule.
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / 'Fragrantica ID Database'
OUT = DB / 'mappings' / 'bestseller-001-100.json'
JS_OUT = ROOT / 'bestseller-001-100-canonical-data.js'
UNRESOLVED = DB / 'validation' / 'unresolved.json'

LOCK1 = ROOT / 'Shobi Master Database' / 'bestseller-top100-source-lock.csv'
LOCK2 = ROOT / 'Shobi Master Database' / 'bestseller-top100-source-lock-pass2.csv'
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


def load_locks():
    by_rank = {}
    for path in (LOCK1, LOCK2):
        for r in read_csv(path):
            rank = int(r['rank'])
            url = fragrantica_url(r)
            if not url:
                continue
            by_rank[rank] = {
                'rank': rank,
                'shobi_code': clean(r.get('shobi_code')),
                'fragrantica_url': url,
                'fragrantica_id': fragrantica_id(url),
                'verified_fields': [x for x in clean(r.get('verified_fields')).split('|') if x],
                'source_status': clean(r.get('status')),
                'source_lock_file': str(path.relative_to(ROOT)),
            }
    return by_rank


def load_enrichment():
    rows = read_csv(ENRICH)
    return {int(r['rank']): r for r in rows}


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


def load_notes_by_id():
    out = {}
    p1 = json.loads(NOTES_1_20.read_text(encoding='utf-8'))
    for key, item in (p1.get('perfumes') or {}).items():
        fid = int(item.get('fragrantica_id') or key)
        out[fid] = {'notes': note_payload(item), 'capture_source': str(NOTES_1_20.relative_to(ROOT))}
    for path in (NOTES_21_40, NOTES_41_100):
        payload = json.loads(path.read_text(encoding='utf-8'))
        for item in payload.get('results') or []:
            fid = int(item['fragrantica_id'])
            out[fid] = {'notes': note_payload(item), 'capture_source': str(path.relative_to(ROOT))}
    return out


def main():
    locks = load_locks()
    enrich = load_enrichment()
    notes_by_id = load_notes_by_id()
    expected = set(range(1, 101))
    if set(locks) != expected:
        raise SystemExit(f'Safety stop: source-lock coverage mismatch; missing={sorted(expected-set(locks))} extra={sorted(set(locks)-expected)}')
    if set(enrich) != expected:
        raise SystemExit('Safety stop: enrichment ranks must be exactly 1..100')

    records, unresolved, seen_codes = [], [], set()
    for rank in range(1, 101):
        lock, e = locks[rank], enrich[rank]
        fid, code = lock['fragrantica_id'], lock['shobi_code']
        if not fid or not code:
            raise SystemExit(f'Safety stop: missing canonical identity at rank {rank}')
        if code.upper() in seen_codes:
            raise SystemExit(f'Safety stop: duplicate Shobi code {code}')
        seen_codes.add(code.upper())

        note_cap = notes_by_id.get(fid)
        notes = note_cap['notes'] if note_cap else []
        if not notes:
            unresolved.append({'rank': rank, 'shobi_code': code, 'fragrantica_id': fid, 'field': 'main_notes', 'reason': 'No verified Fragrantica note capture for mapped ID'})
        gender = clean(e.get('gender')) if 'gender' in lock['verified_fields'] else ''
        if not gender:
            unresolved.append({'rank': rank, 'shobi_code': code, 'fragrantica_id': fid, 'field': 'gender', 'reason': 'Gender not verified in source-lock'})
        unresolved.append({'rank': rank, 'shobi_code': code, 'fragrantica_id': fid, 'field': 'season', 'reason': 'Awaiting Fragrantica seasonal-vote capture for canonical ID'})

        urls = derived(fid)
        records.append({
            'rank': rank,
            'shobi_code': code,
            'perfume': clean(e.get('perfume')),
            'fragrantica_id': fid,
            'fragrantica_url': lock['fragrantica_url'],
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
                'source_status': lock['source_status'],
                'source_lock': lock['source_lock_file'],
                'note_capture': note_cap['capture_source'] if note_cap else None,
            },
        })

    payload = {
        'schema_version': 1,
        'method': 'Fragrantica ID Mapping Rule',
        'scope': 'Shobi Best Seller 1-100',
        'count': len(records),
        'canonical_key': 'fragrantica_id',
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

    runtime = {
        ''.join(code.upper().split()): {
            'rank': r['rank'],
            'shobi_code': r['shobi_code'],
            'perfume': r['perfume'],
            'fragrantica_id': r['fragrantica_id'],
            'fragrantica_url': r['fragrantica_url'],
            'social_card_url': r['social_card_url'],
            'image_url': r['image_url'],
            'gender': r['gender'],
            'season': r['season'],
            'main_notes': r['main_notes'],
            'main_note_evidence': r['main_note_evidence'],
            'verification': r['verification'],
        }
        for r in records
        for code in [r['shobi_code']]
    }
    JS_OUT.write_text(
        '// Generated from Fragrantica ID Database by the official Fragrantica ID Mapping Rule; do not hand edit.\n'
        'window.SHOBI_FRAGRANTICA_CANONICAL_TOP100=' + json.dumps(runtime, ensure_ascii=False, separators=(',', ':')) + ';\n',
        encoding='utf-8'
    )

    print(f'CANONICAL_RECORDS={len(records)}')
    print(f'IDENTITY_VERIFIED={sum(1 for x in records if x["verification"]["identity"])}')
    print(f'GENDER_VERIFIED={sum(1 for x in records if x["verification"]["gender"])}')
    print(f'MAIN_NOTES_VERIFIED={sum(1 for x in records if x["verification"]["main_notes"])}')
    print(f'SEASON_VERIFIED={sum(1 for x in records if x["verification"]["season"])}')
    print(f'UNRESOLVED_FIELDS={len(unresolved)}')
    print(f'RUNTIME_JS={JS_OUT.name}')


if __name__ == '__main__':
    main()
