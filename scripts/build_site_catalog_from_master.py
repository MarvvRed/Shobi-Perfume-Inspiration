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
CURRENT_SITE = ROOT / 'shobi-master.csv'
LEGACY_SEED = ROOT / 'Shobi Master Database' / 'site-enrichment-seed-v1.csv'
OUT_DIR = ROOT / 'Shobi Master Database' / 'site-build'
CANDIDATE = OUT_DIR / 'shobi-master-site-candidate.csv'
REPORT = OUT_DIR / 'site-build-report.json'
UNRESOLVED = OUT_DIR / 'site-build-unresolved.json'
AMBIGUOUS = OUT_DIR / 'site-build-ambiguous.json'


def read_csv(path):
    with path.open('r', encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        return list(reader), list(reader.fieldnames or [])


def clean(value):
    return ' '.join(str(value or '').split()).strip()


def norm_url(value):
    value = clean(value)
    if not value:
        return ''
    p = urlparse(value)
    path = (p.path or '').rstrip('/').lower()
    return urlunparse(((p.scheme or 'https').lower(), (p.netloc or '').lower(), path, '', '', ''))


def fragrantica_id(value):
    value = clean(value)
    if not value:
        return ''
    m = re.search(r'-(\d+)\.html(?:[?#].*)?$', value, re.I)
    return m.group(1) if m else ''


def fragrantica_image_url(value):
    fid = fragrantica_id(value)
    return f'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.{fid}.avif' if fid else ''


def norm_code(value):
    return clean(value).upper()


def base_code(value):
    value = norm_code(value)
    m = re.search(r'\b(\d{2,5})\s*-\s*([A-Z0-9]+)', value)
    return f'{m.group(1)}-{m.group(2)}' if m else ''


def numeric_code(value):
    m = re.search(r'\b(\d{2,5})\b', norm_code(value))
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
    if value in {'male', 'man', 'men', 'masculine', 'm'}: return 'men'
    if value in {'female', 'woman', 'women', 'feminine', 'f'}: return 'women'
    if value in {'unisex', 'u', 'men & women', 'women & men', 'male & female', 'female & male'}: return 'unisex'
    return value


def enrichment_names(row):
    out = {norm_text(row.get('inspired_by')), norm_text(row.get('shobi_name'))}
    out.discard('')
    return out


def enrichment_quality(row):
    weighted = {
        'brand': 4, 'gender': 3, 'identity_source_type': 4, 'identity_source_url': 2,
        'identity_verified': 2, 'fragrantica_url': 3, 'top_notes': 2, 'heart_notes': 2,
        'base_notes': 2, 'notes': 2, 'season': 1, 'image': 2,
    }
    return sum(weight for field, weight in weighted.items() if clean(row.get(field)))


def same_enrichment_identity(rows):
    if len(rows) < 2: return False
    urls = {norm_url(r.get('shobi_url')) for r in rows if norm_url(r.get('shobi_url'))}
    names = {norm_text(r.get('inspired_by') or r.get('shobi_name')) for r in rows if norm_text(r.get('inspired_by') or r.get('shobi_name'))}
    nums = {numeric_code(r.get('shobi_code')) for r in rows if numeric_code(r.get('shobi_code'))}
    return len(urls) == 1 and len(names) == 1 and (not nums or len(nums) == 1)


def is_minimal_master_only(row):
    return clean(row.get('identity_source_type')) == 'SHOBI_MASTER_OFFICIAL'


def minimal_site_row(master, headers):
    row = {h: '' for h in headers}
    full_code = clean(master.get('shobi_name')) or clean(master.get('shobi_code'))
    inspired = clean(master.get('inspired_by')) or full_code
    official_url = clean(master.get('url'))
    values = {
        'shobi_code': full_code,
        'shobi_name': inspired,
        'inspired_by': inspired,
        'brand': '',
        'gender': default_gender(master),
        'status': 'IN_STOCK' if clean(master.get('status')).upper() == 'ACTIVE' else clean(master.get('status')),
        'new': '1' if clean(master.get('first_seen')) == clean(master.get('last_seen')) else '0',
        'shobi_url': official_url,
        'identity_source_type': 'SHOBI_MASTER_OFFICIAL',
        'identity_source_url': official_url,
        'identity_verified': '1',
        'identity_match_rule': 'prestashop_product_id-master-authority',
        'secondary_identity_source': '',
        'fragrantica_url': '', 'top_notes': '', 'heart_notes': '', 'base_notes': '',
        'notes': '', 'season': '', 'image': '',
        'description': clean(master.get('official_description')),
        'last_built_utc': datetime.now(timezone.utc).isoformat(),
    }
    for k, v in values.items():
        if k in row: row[k] = v
    return row


def apply_master_authority(site, master):
    site = dict(site)
    site['shobi_url'] = clean(master.get('url')) or clean(site.get('shobi_url'))
    site['gender'] = default_gender(master)
    if clean(master.get('official_description')):
        site['description'] = clean(master.get('official_description'))
    if not clean(site.get('shobi_code')):
        site['shobi_code'] = clean(master.get('shobi_name')) or clean(master.get('shobi_code'))
    if not clean(site.get('shobi_name')):
        site['shobi_name'] = clean(master.get('inspired_by')) or clean(master.get('shobi_name'))
    if not clean(site.get('inspired_by')):
        site['inspired_by'] = clean(master.get('inspired_by')) or clean(master.get('shobi_name'))
    site['last_built_utc'] = datetime.now(timezone.utc).isoformat()
    return site


def diagnostic_master(master):
    return {
        'prestashop_product_id': clean(master.get('prestashop_product_id')),
        'shobi_code': clean(master.get('shobi_code')), 'shobi_name': clean(master.get('shobi_name')),
        'reference': clean(master.get('reference')), 'reference_prefix': clean(master.get('reference_prefix')),
        'inspired_by': clean(master.get('inspired_by')), 'category': clean(master.get('category')),
        'url': clean(master.get('url')), 'gender_from_master': default_gender(master),
    }


def diagnostic_enrichment(idx, row, signals):
    return {
        'index': idx, 'signals': sorted(signals), 'quality': enrichment_quality(row),
        'shobi_code': clean(row.get('shobi_code')), 'base_code': base_code(row.get('shobi_code')),
        'shobi_name': clean(row.get('shobi_name')), 'inspired_by': clean(row.get('inspired_by')),
        'brand': clean(row.get('brand')), 'gender': norm_gender(row.get('gender')),
        'shobi_url': clean(row.get('shobi_url')), 'identity_source_type': clean(row.get('identity_source_type')),
        'identity_source_url': clean(row.get('identity_source_url')),
    }


def build_fallback_indexes(rows):
    by_url, by_code, by_base, by_name = defaultdict(list), defaultdict(list), defaultdict(list), defaultdict(list)
    for idx, row in enumerate(rows):
        u, c, b = norm_url(row.get('shobi_url')), norm_code(row.get('shobi_code')), base_code(row.get('shobi_code'))
        if u: by_url[u].append(idx)
        if c: by_code[c].append(idx)
        if b: by_base[b].append(idx)
        for n in enrichment_names(row): by_name[n].append(idx)
    return by_url, by_code, by_base, by_name


def choose_legacy_fallback(master, rows, indexes):
    by_url, by_code, by_base, by_name = indexes
    m_url = norm_url(master.get('url'))
    m_full = norm_code(master.get('shobi_name'))
    m_base = base_code(master.get('shobi_code')) or base_code(master.get('shobi_name'))
    m_num = numeric_code(master.get('shobi_code')) or numeric_code(master.get('shobi_name'))
    m_gender = default_gender(master)
    m_names = {norm_text(master.get('inspired_by'))}; m_names.discard('')

    evidence = defaultdict(set)
    if m_url:
        for i in by_url.get(m_url, []): evidence[i].add('url')
    if m_full:
        for i in by_code.get(m_full, []): evidence[i].add('code')
    if m_base:
        for i in by_base.get(m_base, []): evidence[i].add('base_code')
    for n in m_names:
        for i in by_name.get(n, []): evidence[i].add('name')

    scored = []
    for idx, kinds in evidence.items():
        row = rows[idx]
        eg = norm_gender(row.get('gender'))
        gender_ok = (not eg or eg == m_gender or eg == 'unisex' or m_gender == 'unisex')
        score = (120 if 'code' in kinds else 0) + (100 if 'url' in kinds else 0) + (80 if 'base_code' in kinds else 0) + (70 if 'name' in kinds else 0) + (5 if gender_ok else 0)
        anchors = kinds & {'code', 'url', 'base_code'}
        safe, rule = False, ''
        if 'code' in kinds and len(by_code.get(m_full, [])) == 1:
            safe, rule = True, 'legacy-unique-full-code'
        elif anchors and 'name' in kinds and gender_ok:
            safe, rule = True, 'legacy-identity-anchor+exact-name'
        elif 'url' in kinds and len(by_url.get(m_url, [])) == 1 and ('base_code' in kinds or 'code' in kinds):
            safe, rule = True, 'legacy-unique-url+code-anchor'
        elif 'base_code' in kinds and len(by_base.get(m_base, [])) == 1:
            safe, rule = True, 'legacy-unique-base-code'
        elif kinds == {'url'} and len(by_url.get(m_url, [])) == 1:
            row_num = numeric_code(row.get('shobi_code'))
            if m_num and row_num == m_num and clean(row.get('identity_source_type')) == 'SHOBI_OFFICIAL_EXPLICIT':
                safe, rule = True, 'legacy-unique-url+numeric-code+official-source'
        elif kinds == {'name'}:
            n = next(iter(m_names), '')
            if n and len(by_name.get(n, [])) == 1 and gender_ok:
                safe, rule = True, 'legacy-unique-exact-name+gender'
        scored.append((score, idx, kinds, safe, rule))

    safe = sorted([x for x in scored if x[3]], key=lambda x: (-x[0], x[1]))
    if not safe:
        return None, evidence, 'evidence-without-safe-convergence' if evidence else 'no-enrichment-evidence'
    top_score = safe[0][0]
    tied = [x for x in safe if x[0] == top_score]
    if len(tied) == 1:
        return tied[0], evidence, ''
    tied_rows = [rows[x[1]] for x in tied]
    if same_enrichment_identity(tied_rows):
        ranked = sorted(((enrichment_quality(rows[x[1]]), x) for x in tied), key=lambda t: (-t[0], t[1][1]))
        if len(ranked) == 1 or ranked[0][0] > ranked[1][0]:
            x = ranked[0][1]
            return (x[0], x[1], x[2], True, 'legacy-duplicate-identity-richest-enrichment'), evidence, ''
    return None, evidence, 'equal-safe-score'


def main():
    if not MASTER.exists() or not CURRENT_SITE.exists():
        raise SystemExit('Safety stop: required Master/current site source missing')
    master_rows, _ = read_csv(MASTER)
    current_rows, current_headers = read_csv(CURRENT_SITE)
    fallback_path = LEGACY_SEED if LEGACY_SEED.exists() else CURRENT_SITE
    fallback_rows, _ = read_csv(fallback_path)
    if not master_rows or not current_rows or not fallback_rows:
        raise SystemExit('Safety stop: required CSV is empty')

    master_ids = [clean(r.get('prestashop_product_id')) for r in master_rows]
    if any(not x for x in master_ids) or len(master_ids) != len(set(master_ids)):
        raise SystemExit('Safety stop: invalid/duplicate prestashop_product_id in Master')

    headers = current_headers
    if 'prestashop_product_id' not in headers:
        headers = ['prestashop_product_id'] + headers
    output_headers = headers

    current_by_pid = defaultdict(list)
    for row in current_rows:
        pid = clean(row.get('prestashop_product_id'))
        if pid: current_by_pid[pid].append(row)
    fallback_indexes = build_fallback_indexes(fallback_rows)

    output, unresolved, ambiguous = [], [], []
    counters = defaultdict(int)
    minimal_ids = []

    for master in master_rows:
        pid = clean(master.get('prestashop_product_id'))
        direct = current_by_pid.get(pid, [])
        site = None

        if len(direct) == 1:
            site = apply_master_authority(direct[0], master)
            counters['existing-prestashop-product-id'] += 1
            if is_minimal_master_only(direct[0]): minimal_ids.append(pid)
        elif len(direct) > 1:
            raise SystemExit(f'Safety stop: duplicate prestashop_product_id {pid} in current site source')
        else:
            chosen, evidence, reason = choose_legacy_fallback(master, fallback_rows, fallback_indexes)
            if chosen:
                _, idx, kinds, _, rule = chosen
                site = apply_master_authority(fallback_rows[idx], master)
                counters[rule] += 1
            else:
                site = minimal_site_row(master, output_headers)
                minimal_ids.append(pid)
                detail = {
                    'master': diagnostic_master(master), 'reason': reason,
                    'candidate_count': len(evidence),
                    'candidates': [diagnostic_enrichment(i, fallback_rows[i], kinds) for i, kinds in evidence.items()],
                }
                unresolved.append(detail)
                if evidence: ambiguous.append(detail)

        out = {'prestashop_product_id': pid}
        for h in output_headers:
            if h == 'prestashop_product_id': continue
            out[h] = clean(site.get(h)) if h != 'description' else str(site.get(h) or '').strip()

        # One rule for every mapped Fragrantica perfume: derive the direct image from its page ID.
        direct_image = fragrantica_image_url(out.get('fragrantica_url'))
        if direct_image and 'image' in out:
            out['image'] = direct_image

        output.append(out)

    out_ids = [r['prestashop_product_id'] for r in output]
    if len(output) != len(master_rows) or len(out_ids) != len(set(out_ids)) or set(out_ids) != set(master_ids):
        raise SystemExit('Safety stop: candidate identity set differs from official Master')

    rich_count = len(master_rows) - len(minimal_ids)
    rich_coverage = rich_count / len(master_rows)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with CANDIDATE.open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=output_headers); w.writeheader(); w.writerows(output)

    stamp = datetime.now(timezone.utc).isoformat()
    UNRESOLVED.write_text(json.dumps({'built_at_utc': stamp, 'purpose': 'AUDIT_ONLY_NEW_OR_UNENRICHED_MASTER_ROWS', 'unresolved_count': len(unresolved), 'items': unresolved}, ensure_ascii=False, indent=2), encoding='utf-8')
    AMBIGUOUS.write_text(json.dumps({'built_at_utc': stamp, 'purpose': 'AUDIT_ONLY_AMBIGUOUS_NEW_MASTER_ROWS', 'ambiguous_count': len(ambiguous), 'items': ambiguous}, ensure_ascii=False, indent=2), encoding='utf-8')

    report = {
        'built_at_utc': stamp,
        'mode': 'VALIDATED_CANDIDATE_FOR_AUTOMATIC_PROMOTION',
        'official_master': str(MASTER.relative_to(ROOT)),
        'current_site_source': str(CURRENT_SITE.relative_to(ROOT)),
        'legacy_enrichment_fallback': str(fallback_path.relative_to(ROOT)),
        'candidate': str(CANDIDATE.relative_to(ROOT)),
        'master_rows': len(master_rows), 'current_site_rows': len(current_rows), 'candidate_rows': len(output),
        'existing_pid_matches': counters.get('existing-prestashop-product-id', 0),
        'match_rules': dict(sorted(counters.items())),
        'minimal_official_master_rows': len(minimal_ids),
        'minimal_official_master_sample': minimal_ids[:50],
        'new_unresolved_master_rows': len(unresolved),
        'ambiguous_matches': len(ambiguous),
        'identity_set_exact_match': True,
        'rich_enrichment_coverage': round(rich_coverage, 6),
        'safety': 'PASS' if not ambiguous else 'FAIL',
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if ambiguous:
        raise SystemExit('Safety stop: ambiguous new Master rows require review before site promotion')


if __name__ == '__main__':
    main()
