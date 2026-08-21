#!/usr/bin/env python3
import csv
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, urlunparse

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / 'Shobi Master Database' / 'shobi-master-current.csv'
ENRICHMENT = ROOT / 'shobi-master.csv'
OUT_DIR = ROOT / 'Shobi Master Database' / 'site-build'
CANDIDATE = OUT_DIR / 'shobi-master-site-candidate.csv'
REPORT = OUT_DIR / 'site-build-report.json'


def read_csv(path):
    with path.open('r', encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def clean(value):
    return ' '.join(str(value or '').split()).strip()


def norm_url(value):
    value = clean(value)
    if not value:
        return ''
    p = urlparse(value)
    path = (p.path or '').rstrip('/').lower()
    return urlunparse(((p.scheme or 'https').lower(), (p.netloc or '').lower(), path, '', '', ''))


def norm_code(value):
    return clean(value).upper()


def default_gender(master_row):
    prefix = clean(master_row.get('reference_prefix')).upper()
    category = clean(master_row.get('category')).lower()
    if prefix == 'MP' or 'for men' in category:
        return 'men'
    if prefix == 'WP' or 'for women' in category:
        return 'women'
    return 'unisex'


def minimal_site_row(master_row, headers):
    row = {h: '' for h in headers}
    full_code = clean(master_row.get('shobi_name')) or clean(master_row.get('shobi_code'))
    inspired = clean(master_row.get('inspired_by')) or full_code
    official_url = clean(master_row.get('url'))
    values = {
        'shobi_code': full_code,
        'shobi_name': inspired,
        'inspired_by': inspired,
        'brand': '',
        'gender': default_gender(master_row),
        'status': 'IN_STOCK' if clean(master_row.get('status')).upper() == 'ACTIVE' else clean(master_row.get('status')),
        'new': '1' if clean(master_row.get('first_seen')) == clean(master_row.get('last_seen')) else '0',
        'shobi_url': official_url,
        'identity_source_type': 'SHOBI_MASTER_OFFICIAL',
        'identity_source_url': official_url,
        'identity_verified': '1',
        'identity_match_rule': 'prestashop_product_id-master-authority',
        'secondary_identity_source': '',
        'fragrantica_url': '',
        'top_notes': '',
        'heart_notes': '',
        'base_notes': '',
        'notes': '',
        'season': '',
        'image': '',
        'description': clean(master_row.get('official_description')),
        'last_built_utc': datetime.now(timezone.utc).isoformat(),
    }
    for k, v in values.items():
        if k in row:
            row[k] = v
    return row


def main():
    if not MASTER.exists():
        raise SystemExit('Safety stop: official shobi-master-current.csv missing')
    if not ENRICHMENT.exists():
        raise SystemExit('Safety stop: current site shobi-master.csv missing')

    master_rows = read_csv(MASTER)
    enrichment_rows = read_csv(ENRICHMENT)
    if not master_rows:
        raise SystemExit('Safety stop: official Master is empty')
    if not enrichment_rows:
        raise SystemExit('Safety stop: site enrichment CSV is empty')

    master_ids = [clean(r.get('prestashop_product_id')) for r in master_rows]
    if any(not x for x in master_ids):
        raise SystemExit('Safety stop: Master row missing prestashop_product_id')
    if len(master_ids) != len(set(master_ids)):
        raise SystemExit('Safety stop: duplicate prestashop_product_id in Master')

    enrichment_headers = list(enrichment_rows[0].keys())
    output_headers = ['prestashop_product_id'] + [h for h in enrichment_headers if h != 'prestashop_product_id']

    by_url = defaultdict(list)
    by_code = defaultdict(list)
    for idx, row in enumerate(enrichment_rows):
        u = norm_url(row.get('shobi_url'))
        c = norm_code(row.get('shobi_code'))
        if u:
            by_url[u].append(idx)
        if c:
            by_code[c].append(idx)

    used = set()
    output = []
    matched_by_url = 0
    matched_by_code = 0
    unmatched = []
    ambiguous = []

    for master in master_rows:
        pid = clean(master.get('prestashop_product_id'))
        master_url = norm_url(master.get('url'))
        master_full_code = norm_code(master.get('shobi_name'))
        candidates = []
        match_type = ''

        if master_url and len(by_url.get(master_url, [])) == 1:
            candidates = by_url[master_url]
            match_type = 'url'
        elif master_full_code and len(by_code.get(master_full_code, [])) == 1:
            candidates = by_code[master_full_code]
            match_type = 'code'
        elif master_url and len(by_url.get(master_url, [])) > 1:
            ambiguous.append({'prestashop_product_id': pid, 'reason': 'duplicate-enrichment-url', 'value': master_url})
        elif master_full_code and len(by_code.get(master_full_code, [])) > 1:
            ambiguous.append({'prestashop_product_id': pid, 'reason': 'duplicate-enrichment-code', 'value': master_full_code})

        if candidates:
            idx = candidates[0]
            if idx in used:
                ambiguous.append({'prestashop_product_id': pid, 'reason': 'enrichment-row-reused', 'index': idx})
                site = minimal_site_row(master, enrichment_headers)
                unmatched.append(pid)
            else:
                used.add(idx)
                site = dict(enrichment_rows[idx])
                if match_type == 'url':
                    matched_by_url += 1
                else:
                    matched_by_code += 1
                # Master owns identity/existence and official Shobi URL/description.
                site['shobi_url'] = clean(master.get('url')) or clean(site.get('shobi_url'))
                if clean(master.get('official_description')):
                    site['description'] = clean(master.get('official_description'))
                if not clean(site.get('shobi_code')):
                    site['shobi_code'] = clean(master.get('shobi_name'))
                if not clean(site.get('inspired_by')):
                    site['inspired_by'] = clean(master.get('inspired_by')) or clean(master.get('shobi_name'))
                site['last_built_utc'] = datetime.now(timezone.utc).isoformat()
        else:
            site = minimal_site_row(master, enrichment_headers)
            unmatched.append(pid)

        out = {'prestashop_product_id': pid}
        for h in enrichment_headers:
            if h == 'prestashop_product_id':
                continue
            out[h] = clean(site.get(h)) if h not in {'description'} else str(site.get(h) or '').strip()
        output.append(out)

    out_ids = [r['prestashop_product_id'] for r in output]
    if len(output) != len(master_rows):
        raise SystemExit(f'Safety stop: output rows {len(output)} != Master rows {len(master_rows)}')
    if len(out_ids) != len(set(out_ids)):
        raise SystemExit('Safety stop: duplicate prestashop_product_id in site candidate')
    if set(out_ids) != set(master_ids):
        raise SystemExit('Safety stop: candidate identity set differs from official Master')

    matched = matched_by_url + matched_by_code
    coverage = matched / len(master_rows)
    # Current production enrichment should map almost entirely. Future NEW Master rows may be temporarily unenriched.
    if coverage < 0.90:
        raise SystemExit(f'Safety stop: enrichment coverage too low: {matched}/{len(master_rows)} ({coverage:.2%})')

    orphans = [idx for idx in range(len(enrichment_rows)) if idx not in used]
    duplicate_enrichment_urls = sum(1 for v in by_url.values() if len(v) > 1)
    duplicate_enrichment_codes = sum(1 for v in by_code.values() if len(v) > 1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with CANDIDATE.open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=output_headers)
        w.writeheader()
        w.writerows(output)

    report = {
        'built_at_utc': datetime.now(timezone.utc).isoformat(),
        'mode': 'STAGING_ONLY_DO_NOT_PUBLISH_YET',
        'official_master': str(MASTER.relative_to(ROOT)),
        'enrichment_source': str(ENRICHMENT.relative_to(ROOT)),
        'candidate': str(CANDIDATE.relative_to(ROOT)),
        'master_rows': len(master_rows),
        'existing_site_rows': len(enrichment_rows),
        'candidate_rows': len(output),
        'matched_total': matched,
        'matched_by_url': matched_by_url,
        'matched_by_code': matched_by_code,
        'unmatched_master_rows': len(unmatched),
        'unmatched_master_sample': unmatched[:50],
        'orphan_enrichment_rows': len(orphans),
        'duplicate_enrichment_urls': duplicate_enrichment_urls,
        'duplicate_enrichment_codes': duplicate_enrichment_codes,
        'ambiguous_matches': len(ambiguous),
        'ambiguous_sample': ambiguous[:50],
        'identity_set_exact_match': True,
        'enrichment_coverage': round(coverage, 6),
        'safety': 'PASS',
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
