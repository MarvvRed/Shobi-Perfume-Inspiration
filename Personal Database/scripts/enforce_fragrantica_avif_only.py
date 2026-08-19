#!/usr/bin/env python3
import csv, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / 'shobi-master.csv'
MANIFEST = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'fragrantica-image-cache' / 'manifest.json'
RAW_PREFIX = 'https://raw.githubusercontent.com/MarvvRed/Shobi-Perfume-Inspiration/fragrantica-image-cache/images/'


def code_key(v):
    return re.sub(r'\s+', ' ', str(v or '').strip().lower())


def fragrantica_id_from_page(url):
    url = str(url or '').strip()
    if 'fragrantica.' not in url.lower() or '/perfume/' not in url.lower():
        return ''
    m = re.search(r'-(\d+)\.html(?:[?#].*)?$', url, re.I)
    return m.group(1) if m else ''


def fragrantica_id_from_thumb(url):
    url = str(url or '').strip()
    if 'fimgs.net/mdimg/perfume-thumbs/' not in url.lower():
        return ''
    m = re.search(r'\.(\d+)\.avif(?:[?#].*)?$', url, re.I)
    return m.group(1) if m else ''


def main():
    if not MASTER.exists():
        raise SystemExit('missing shobi-master.csv')
    if not MANIFEST.exists():
        raise SystemExit(f'missing AVIF manifest: {MANIFEST}')

    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    entries = manifest.get('entries') or {}
    unique = manifest.get('unique_images') or {}
    if not isinstance(entries, dict) or not isinstance(unique, dict):
        raise SystemExit('invalid fragrantica AVIF manifest')

    exact = {}
    for code, rec in entries.items():
        if not isinstance(rec, dict):
            continue
        fid = str(rec.get('fragrantica_id') or '').strip()
        source_url = str(rec.get('source_url') or '').strip()
        backup = str(rec.get('backup_path') or '').strip()
        manifest_page = str(rec.get('fragrantica_url') or '').strip()
        if not fid or fid not in unique or backup != f'images/{fid}.avif':
            continue
        if fragrantica_id_from_thumb(source_url) != fid:
            continue
        if manifest_page and fragrantica_id_from_page(manifest_page) != fid:
            continue
        exact[code_key(code)] = {'fid': fid, 'page': manifest_page}

    with MASTER.open(encoding='utf-8-sig', newline='') as fh:
        rows = list(csv.DictReader(fh))
        fields = list(rows[0].keys()) if rows else []
    if 'image' not in fields or 'fragrantica_url' not in fields:
        raise SystemExit('master image/fragrantica_url columns missing')

    matched = 0
    rejected = 0
    page_backfilled = 0
    page_conflicts = 0
    missing_page = 0
    for row in rows:
        code = code_key(row.get('shobi_code'))
        rec = exact.get(code)
        current_page = str(row.get('fragrantica_url') or '').strip()
        current_page_id = fragrantica_id_from_page(current_page)

        if not rec:
            if row.get('image'):
                rejected += 1
            row['image'] = ''
            continue

        archive_id = rec['fid']
        manifest_page = rec['page']
        if current_page_id and current_page_id != archive_id:
            if row.get('image'):
                rejected += 1
            row['image'] = ''
            page_conflicts += 1
            continue

        if not current_page and manifest_page:
            row['fragrantica_url'] = manifest_page
            current_page = manifest_page
            current_page_id = archive_id
            page_backfilled += 1

        if not current_page_id:
            row['image'] = ''
            missing_page += 1
            continue

        row['image'] = f'{RAW_PREFIX}{archive_id}.avif'
        matched += 1

    with MASTER.open('w', encoding='utf-8-sig', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader(); w.writerows(rows)

    bad = []
    for row in rows:
        image = str(row.get('image') or '').strip()
        if not image:
            continue
        image_id_m = re.search(r'/images/(\d+)\.avif$', image)
        image_id = image_id_m.group(1) if image_id_m else ''
        page_id = fragrantica_id_from_page(row.get('fragrantica_url'))
        if not image.startswith(RAW_PREFIX) or not image.endswith('.avif') or not image_id:
            bad.append((row.get('shobi_code'), row.get('fragrantica_url'), image))
            continue
        if not page_id or page_id != image_id:
            bad.append((row.get('shobi_code'), row.get('fragrantica_url'), image))
    if bad:
        raise SystemExit(f'unverified Fragrantica AVIF survived: {bad[:3]}')
    if matched == 0:
        raise SystemExit('zero exact verified Fragrantica AVIF matches')

    print('EXACT_OFFICIAL_FRAGRANTICA_AVIF', matched, '/', len(rows))
    print('REJECTED_NONEXACT_OR_CONFLICTING', rejected)
    print('FRAGRANTICA_PAGE_BACKFILLED', page_backfilled)
    print('FRAGRANTICA_PAGE_CONFLICTS', page_conflicts)
    print('FRAGRANTICA_PAGE_MISSING_REJECTED', missing_page)
    print('PLACEHOLDERS', len(rows) - matched)

if __name__ == '__main__':
    main()
