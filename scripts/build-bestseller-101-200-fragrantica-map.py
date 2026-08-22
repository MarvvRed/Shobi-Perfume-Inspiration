#!/usr/bin/env python3
import csv, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BATCH = ROOT / 'Personal Database' / 'bestseller-101-200.json'
MASTER = ROOT / 'shobi-master-en.csv'
OUT = ROOT / 'Personal Database' / 'bestseller-101-200-fragrantica-map.json'


def norm(v):
    return re.sub(r'\s+', ' ', str(v or '').strip()).upper()


def fragrantica_url(row):
    for key in ('primary_source', 'secondary_source'):
        value = str(row.get(key) or '').strip()
        if 'fragrantica.com/perfume/' in value.lower():
            return value
    return ''


def fragrantica_id(url):
    if not url:
        return ''
    m = re.search(r'-(\d+)\.html(?:[?#].*)?$', url)
    return m.group(1) if m else ''


def main():
    batch = json.loads(BATCH.read_text(encoding='utf-8'))
    rows = batch.get('rows') or []
    if len(rows) != 100:
        raise SystemExit(f'Expected 100 Best Seller rows, got {len(rows)}')

    with MASTER.open('r', encoding='utf-8-sig', newline='') as fh:
        master_rows = list(csv.DictReader(fh))
    by_code = {norm(r.get('shobi_code')): r for r in master_rows if r.get('shobi_code')}

    output = []
    missing_master = []
    missing_fragrantica = []
    for item in rows:
        rank = int(item['rank'])
        code = str(item['code']).strip()
        row = by_code.get(norm(code))
        if not row:
            missing_master.append({'rank': rank, 'code': code})
            output.append({'rank': rank, 'globalRank': item.get('globalRank'), 'code': code, 'inspired_by': '', 'brand': '', 'fragrantica_url': '', 'fragrantica_id': ''})
            continue
        url = fragrantica_url(row)
        fid = fragrantica_id(url)
        rec = {
            'rank': rank,
            'globalRank': item.get('globalRank'),
            'code': code,
            'inspired_by': str(row.get('inspired_by') or '').strip(),
            'brand': str(row.get('brand') or '').strip(),
            'fragrantica_url': url,
            'fragrantica_id': fid,
        }
        output.append(rec)
        if not fid:
            missing_fragrantica.append({'rank': rank, 'code': code, 'inspired_by': rec['inspired_by'], 'brand': rec['brand'], 'primary_source': row.get('primary_source',''), 'secondary_source': row.get('secondary_source','')})

    payload = {
        'count': len(output),
        'master_matched': len(output) - len(missing_master),
        'fragrantica_ids': sum(bool(r['fragrantica_id']) for r in output),
        'missing_master': missing_master,
        'missing_fragrantica': missing_fragrantica,
        'rows': output,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print('BESTSELLER_101_200_COUNT', len(output))
    print('MASTER_MATCHED', payload['master_matched'])
    print('FRAGRANTICA_IDS', payload['fragrantica_ids'])
    print('MISSING_MASTER', len(missing_master))
    print('MISSING_FRAGRANTICA', len(missing_fragrantica))
    for x in missing_master:
        print('MISSING_MASTER_ROW', x)
    for x in missing_fragrantica:
        print('MISSING_FRAGRANTICA_ROW', x)

if __name__ == '__main__':
    main()
