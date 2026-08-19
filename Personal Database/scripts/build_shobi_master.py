#!/usr/bin/env python3
import csv
import json
import re
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'shobi-catalog.json'
DETAILS = ROOT / 'perfume-details.json'
METADATA = ROOT / 'perfume-metadata.json'
IMAGES = ROOT / 'perfume-images.json'
MASTER = ROOT / 'shobi-master.csv'
LITE = ROOT / 'catalog-lite.json'


def load_json(path, default):
    try:
        with path.open(encoding='utf-8') as fh:
            return json.load(fh)
    except Exception:
        return default


def norm(value):
    return re.sub(r'\s+', ' ', str(value or '')).strip().lower()


def code_key(value):
    return re.sub(r'\s+', '', str(value or '')).upper()


def first_nonempty(*values):
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
        if value not in (None, '', [], {}):
            return value
    return ''


def detail_for(details, item):
    code = code_key(item.get('code'))
    brand = norm(item.get('brand'))
    perfume = norm(item.get('official_inspired_by') or item.get('original_perfume') or item.get('perfume'))
    for key in (code, code.lower(), f'{brand}|{perfume}'):
        rec = details.get(key)
        if isinstance(rec, dict) and rec:
            return rec
    return {}


def metadata_for(metadata, item):
    code = code_key(item.get('code'))
    brand = norm(item.get('brand'))
    perfume = norm(item.get('official_inspired_by') or item.get('original_perfume') or item.get('perfume'))
    for key in (code, code.lower(), f'{brand}|{perfume}'):
        rec = metadata.get(key)
        if isinstance(rec, dict) and rec:
            return rec
    return {}


def image_for(images, item):
    code = code_key(item.get('code'))
    brand = norm(item.get('brand'))
    perfume = norm(item.get('official_inspired_by') or item.get('original_perfume') or item.get('perfume'))
    if isinstance(images, dict):
        pools = [images]
        for k in ('images', 'by_code', 'products'):
            if isinstance(images.get(k), dict):
                pools.append(images[k])
        for pool in pools:
            for key in (code, code.lower(), f'{brand}|{perfume}'):
                rec = pool.get(key)
                if isinstance(rec, dict) and rec:
                    return rec
    return {}


def notes_list(value):
    if isinstance(value, list):
        return [str(x).strip() for x in value if str(x).strip()]
    if isinstance(value, str):
        return [x.strip() for x in re.split(r'[,;|]+', value) if x.strip()]
    return []


def join_notes(values):
    return ' | '.join(dict.fromkeys(values))


def main():
    catalog = load_json(CATALOG, {})
    products = catalog.get('products') if isinstance(catalog, dict) else None
    if not isinstance(products, list) or len(products) < 500:
        raise SystemExit('Invalid shobi-catalog.json')

    details = load_json(DETAILS, {})
    metadata = load_json(METADATA, {})
    images = load_json(IMAGES, {})

    fields = [
        'shobi_code','shobi_name','inspired_by','brand','gender','status','new',
        'shobi_url','identity_source_type','identity_source_url','identity_verified',
        'identity_match_rule','secondary_identity_source','fragrantica_url',
        'top_notes','heart_notes','base_notes','notes','season','image','description',
        'last_built_utc'
    ]
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    rows = []
    lite_rows = []
    seen = set()
    official_count = 0

    for item in products:
        code = str(item.get('code') or '').strip()
        if not code:
            continue
        ck = code_key(code)
        if ck in seen:
            raise SystemExit(f'Duplicate Shobi code in source: {code}')
        seen.add(ck)

        d = detail_for(details, item)
        m = metadata_for(metadata, item)
        im = image_for(images, item)

        official = str(item.get('official_inspired_by') or '').strip()
        if official:
            official_count += 1
        inspired = official or str(item.get('original_perfume') or item.get('perfume') or '').strip()
        shobi_name = str(item.get('perfume') or inspired or '').strip()
        brand = str(item.get('brand') or '').strip()
        gender = str(item.get('gender') or m.get('gender') or '').strip().lower()
        status = str(item.get('status') or '').strip()
        is_new = bool(item.get('new'))
        shobi_url = str(item.get('url') or '').strip()

        top = notes_list(first_nonempty(d.get('top_notes'), d.get('topNotes')))
        heart = notes_list(first_nonempty(d.get('heart_notes'), d.get('middle_notes'), d.get('heartNotes'), d.get('middleNotes')))
        base = notes_list(first_nonempty(d.get('base_notes'), d.get('baseNotes')))
        all_notes = notes_list(d.get('notes')) or (top + heart + base)

        fragrantica_url = str(first_nonempty(
            im.get('fragrantica_url'), m.get('fragrantica_url'), d.get('fragrantica_url'),
            d.get('notes_source_url'), d.get('source_url')
        ) or '').strip()
        image = str(first_nonempty(im.get('url'), im.get('src'), im.get('image'), d.get('image')) or '').strip()
        season = m.get('season') or d.get('season') or ''
        if isinstance(season, list):
            season = ' | '.join(str(x) for x in season if str(x).strip())

        if official:
            source_type = 'SHOBI_OFFICIAL_EXPLICIT'
            verified = True
        elif item.get('identity_verified_exact_code') is True:
            source_type = 'SECONDARY_EXACT_CODE'
            verified = True
        elif item.get('identity_verified_cross_source') is True:
            source_type = 'SECONDARY_CROSS_VERIFIED'
            verified = True
        else:
            source_type = 'SHOBI_CATALOG_UNRESOLVED_IDENTITY'
            verified = False

        rows.append({
            'shobi_code': code,
            'shobi_name': shobi_name,
            'inspired_by': inspired,
            'brand': brand,
            'gender': gender,
            'status': status,
            'new': '1' if is_new else '0',
            'shobi_url': shobi_url,
            'identity_source_type': source_type,
            'identity_source_url': str(item.get('identity_source') or '').strip(),
            'identity_verified': '1' if verified else '0',
            'identity_match_rule': str(item.get('identity_match_rule') or '').strip(),
            'secondary_identity_source': str(item.get('identity_secondary_source') or '').strip(),
            'fragrantica_url': fragrantica_url,
            'top_notes': join_notes(top),
            'heart_notes': join_notes(heart),
            'base_notes': join_notes(base),
            'notes': join_notes(all_notes),
            'season': str(season or ''),
            'image': image,
            'description': str(d.get('description') or item.get('description') or '').replace('\n', ' ').strip(),
            'last_built_utc': now,
        })

        # Runtime format: [code, perfume, brand, gender, status, new].
        # Official Shobi inspired-by always has first priority.
        lite_rows.append([code, inspired or shobi_name, brand, gender, status, 1 if is_new else 0])

    with MASTER.open('w', encoding='utf-8-sig', newline='') as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    payload = {'v': 1, 'count': len(lite_rows), 'p': lite_rows}
    LITE.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    if len(lite_rows) != len(products):
        raise SystemExit(f'Lite row count mismatch: {len(lite_rows)} vs {len(products)}')
    if len(seen) != len(lite_rows):
        raise SystemExit('Lite duplicate-code validation failed')
    if catalog.get('official_explicit_identity_count') is not None and official_count != int(catalog['official_explicit_identity_count']):
        raise SystemExit('Official identity count mismatch')

    print('MASTER_ROWS', len(rows))
    print('MASTER_OFFICIAL_EXPLICIT', official_count)
    print('MASTER_BYTES', MASTER.stat().st_size)
    print('LITE_BYTES', LITE.stat().st_size)


if __name__ == '__main__':
    main()
