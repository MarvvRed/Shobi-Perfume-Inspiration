#!/usr/bin/env python3
import csv
import json
import re
import unicodedata
from collections import defaultdict
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


def base_code(value):
    value = norm_code(value)
    m = re.match(r'^(\d{2,5}-[A-Z0-9]+)', value)
    return m.group(1) if m else ''


def norm_text(value):
    value = unicodedata.normalize('NFKD', clean(value)).encode('ascii', 'ignore').decode('ascii')
    value = value.upper().replace('&', ' AND ')
    value = re.sub(r'[^A-Z0-9]+', ' ', value)
    return ' '.join(value.split())


def default_gender(master_row):
    prefix = clean(master_row.get('reference_prefix')).upper()
    category = clean(master_row.get('category')).lower()
    if prefix == 'MP' or 'for men' in category:
        return 'men'
    if prefix == 'WP' or 'for women' in category:
        return 'women'
    return 'unisex'


def norm_gender(value):
    value = clean(value).lower()
    if value in {'male', 'man', 'men', 'masculine', 'm'}:
        return 'men'
    if value in {'female', 'woman', 'women', 'feminine', 'f'}:
        return 'women'
    if value in {'unisex', 'u', 'men & women', 'women & men', 'male & female', 'female & male'}:
        return 'unisex'
    return value


def master_names(master):
    names = {
        norm_text(master.get('inspired_by')),
        norm_text(master.get('shobi_name')),
        norm_text(master.get('official_description')),
    }
    # Description is useful only as a fallback token source; exact long description
    # must not itself create a match.
    names.discard('')
    return names


def enrichment_names(row):
    names = {
        norm_text(row.get('inspired_by')),
        norm_text(row.get('shobi_name')),
    }
    names.discard('')
    return names


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
    if not master_rows or not enrichment_rows:
        raise SystemExit('Safety stop: required CSV is empty')

    master_ids = [clean(r.get('prestashop_product_id')) for r in master_rows]
    if any(not x for x in master_ids) or len(master_ids) != len(set(master_ids)):
        raise SystemExit('Safety stop: invalid/duplicate prestashop_product_id in Master')

    enrichment_headers = list(enrichment_rows[0].keys())
    output_headers = ['prestashop_product_id'] + [h for h in enrichment_headers if h != 'prestashop_product_id']

    by_url = defaultdict(list)
    by_code = defaultdict(list)
    by_base_code = defaultdict(list)
    by_name = defaultdict(list)
    row_names = []
    for idx, row in enumerate(enrichment_rows):
        u = norm_url(row.get('shobi_url'))
        c = norm_code(row.get('shobi_code'))
        b = base_code(row.get('shobi_code'))
        names = enrichment_names(row)
        row_names.append(names)
        if u: by_url[u].append(idx)
        if c: by_code[c].append(idx)
        if b: by_base_code[b].append(idx)
        for n in names: by_name[n].append(idx)

    used = set()
    output = []
    counters = defaultdict(int)
    unmatched = []
    ambiguous = []
    resolution_details = []

    for master in master_rows:
        pid = clean(master.get('prestashop_product_id'))
        m_url = norm_url(master.get('url'))
        m_full = norm_code(master.get('shobi_name'))
        m_base = base_code(master.get('shobi_code')) or base_code(master.get('shobi_name'))
        m_gender = default_gender(master)
        m_names = {norm_text(master.get('inspired_by'))}
        m_names.discard('')

        evidence = defaultdict(set)
        if m_url:
            for i in by_url.get(m_url, []): evidence[i].add('url')
        if m_full:
            for i in by_code.get(m_full, []): evidence[i].add('code')
        if m_base:
            for i in by_base_code.get(m_base, []): evidence[i].add('base_code')
        for n in m_names:
            for i in by_name.get(n, []): evidence[i].add('name')

        scored = []
        for idx, kinds in evidence.items():
            if idx in used:
                continue
            row = enrichment_rows[idx]
            eg = norm_gender(row.get('gender'))
            gender_ok = (not eg or eg == m_gender or eg == 'unisex' or m_gender == 'unisex')
            score = 0
            if 'code' in kinds: score += 120
            if 'url' in kinds: score += 100
            if 'base_code' in kinds: score += 80
            if 'name' in kinds: score += 70
            if gender_ok: score += 5
            anchors = kinds & {'code', 'url', 'base_code'}
            # Strict acceptance: identity anchor plus corroboration, or a unique
            # full-code match. Name-only matches are allowed only when globally
            # unique and gender-compatible.
            safe = False
            rule = ''
            if 'code' in kinds and len(by_code.get(m_full, [])) == 1:
                safe = True; rule = 'unique-full-code'
            elif anchors and ('name' in kinds) and gender_ok:
                safe = True; rule = 'identity-anchor+exact-name'
            elif 'url' in kinds and len(by_url.get(m_url, [])) == 1 and ('base_code' in kinds or 'code' in kinds):
                safe = True; rule = 'unique-url+code-anchor'
            elif 'base_code' in kinds and len(by_base_code.get(m_base, [])) == 1:
                safe = True; rule = 'unique-base-code'
            elif kinds == {'name'}:
                n = next(iter(m_names), '')
                if n and len(by_name.get(n, [])) == 1 and gender_ok:
                    safe = True; rule = 'unique-exact-name+gender'
            scored.append((score, idx, kinds, safe, rule))

        safe_scored = [x for x in scored if x[3]]
        safe_scored.sort(key=lambda x: (-x[0], x[1]))
        chosen = None
        if safe_scored:
            top = safe_scored[0]
            same_top = [x for x in safe_scored if x[0] == top[0]]
            if len(same_top) == 1:
                chosen = top
            else:
                ambiguous.append({'prestashop_product_id': pid, 'reason': 'equal-safe-score', 'candidates': [x[1] for x in same_top]})
        elif evidence:
            ambiguous.append({
                'prestashop_product_id': pid,
                'reason': 'evidence-without-safe-convergence',
                'candidates': [{'index': i, 'signals': sorted(k)} for i, k in evidence.items() if i not in used][:10],
            })

        if chosen:
            score, idx, kinds, _, rule = chosen
            used.add(idx)
            counters[rule] += 1
            site = dict(enrichment_rows[idx])
            site['shobi_url'] = clean(master.get('url')) or clean(site.get('shobi_url'))
            if clean(master.get('official_description')):
                site['description'] = clean(master.get('official_description'))
            if not clean(site.get('shobi_code')):
                site['shobi_code'] = clean(master.get('shobi_name'))
            if not clean(site.get('inspired_by')):
                site['inspired_by'] = clean(master.get('inspired_by')) or clean(master.get('shobi_name'))
            site['last_built_utc'] = datetime.now(timezone.utc).isoformat()
            resolution_details.append({'prestashop_product_id': pid, 'enrichment_index': idx, 'rule': rule, 'signals': sorted(kinds), 'score': score})
        else:
            site = minimal_site_row(master, enrichment_headers)
            unmatched.append(pid)

        out = {'prestashop_product_id': pid}
        for h in enrichment_headers:
            if h == 'prestashop_product_id':
                continue
            out[h] = clean(site.get(h)) if h != 'description' else str(site.get(h) or '').strip()
        output.append(out)

    out_ids = [r['prestashop_product_id'] for r in output]
    if len(output) != len(master_rows) or len(out_ids) != len(set(out_ids)) or set(out_ids) != set(master_ids):
        raise SystemExit('Safety stop: candidate identity set differs from official Master')

    matched = len(master_rows) - len(unmatched)
    coverage = matched / len(master_rows)
    if coverage < 0.90:
        raise SystemExit(f'Safety stop: enrichment coverage too low: {matched}/{len(master_rows)} ({coverage:.2%})')

    orphans = [idx for idx in range(len(enrichment_rows)) if idx not in used]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with CANDIDATE.open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=output_headers)
        w.writeheader(); w.writerows(output)

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
        'match_rules': dict(sorted(counters.items())),
        'unmatched_master_rows': len(unmatched),
        'unmatched_master_sample': unmatched[:50],
        'orphan_enrichment_rows': len(orphans),
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
