#!/usr/bin/env python3
import csv
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / 'Shobi Master Database' / 'shobi-master-current.csv'
CURRENT = ROOT / 'shobi-master.csv'
CANDIDATE = ROOT / 'Shobi Master Database' / 'site-build' / 'shobi-master-site-candidate.csv'
BUILD_REPORT = ROOT / 'Shobi Master Database' / 'site-build' / 'site-build-report.json'
OUT = ROOT / 'Shobi Master Database' / 'site-build' / 'site-build-regression.json'

SITE_REQUIRED_COLUMNS = {
    'prestashop_product_id', 'shobi_code', 'shobi_name', 'inspired_by', 'brand',
    'gender', 'status', 'new', 'shobi_url', 'fragrantica_url', 'top_notes',
    'heart_notes', 'base_notes', 'notes', 'season', 'image', 'description'
}
RICH_FIELDS = ['brand', 'fragrantica_url', 'top_notes', 'heart_notes', 'base_notes', 'notes', 'season', 'image']


def read_csv(path):
    with path.open('r', encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        return list(reader), list(reader.fieldnames or [])


def nonempty(row, key):
    return bool(str(row.get(key) or '').strip())


def main():
    master, _ = read_csv(MASTER)
    current, current_headers = read_csv(CURRENT)
    candidate, candidate_headers = read_csv(CANDIDATE)
    build = json.loads(BUILD_REPORT.read_text(encoding='utf-8'))

    master_ids = [str(r.get('prestashop_product_id') or '').strip() for r in master]
    candidate_ids = [str(r.get('prestashop_product_id') or '').strip() for r in candidate]
    missing_columns = sorted(SITE_REQUIRED_COLUMNS - set(candidate_headers))

    missing_required_values = {
        'prestashop_product_id': sum(not nonempty(r, 'prestashop_product_id') for r in candidate),
        'shobi_code': sum(not nonempty(r, 'shobi_code') for r in candidate),
        'inspired_by': sum(not nonempty(r, 'inspired_by') for r in candidate),
        'shobi_url': sum(not nonempty(r, 'shobi_url') for r in candidate),
        'gender': sum(not nonempty(r, 'gender') for r in candidate),
    }

    # Mirrors the current frontend's basic rendering gate: code + inspiredBy.
    renderable = sum(nonempty(r, 'shobi_code') and nonempty(r, 'inspired_by') for r in candidate)
    code_counts = Counter(str(r.get('shobi_code') or '').strip() for r in candidate if nonempty(r, 'shobi_code'))
    duplicate_codes = sorted((code, n) for code, n in code_counts.items() if n > 1)

    current_rich = {field: sum(nonempty(r, field) for r in current) for field in RICH_FIELDS}
    candidate_rich = {field: sum(nonempty(r, field) for r in candidate) for field in RICH_FIELDS}

    safety_checks = {
        'candidate_rows_equal_master': len(candidate) == len(master),
        'candidate_identity_exact_master': set(candidate_ids) == set(master_ids),
        'candidate_ids_unique': len(candidate_ids) == len(set(candidate_ids)),
        'required_columns_present': not missing_columns,
        'all_rows_renderable_by_current_frontend': renderable == len(candidate),
        'all_rows_have_official_url': missing_required_values['shobi_url'] == 0,
        'all_rows_have_gender': missing_required_values['gender'] == 0,
        'build_safety_pass': build.get('safety') == 'PASS',
        'build_ambiguous_zero': int(build.get('ambiguous_matches', -1)) == 0,
    }
    safety = 'PASS' if all(safety_checks.values()) else 'FAIL'

    report = {
        'mode': 'STAGING_REGRESSION_AUDIT_DO_NOT_PUBLISH_YET',
        'master_rows': len(master),
        'current_site_rows': len(current),
        'candidate_rows': len(candidate),
        'renderable_rows_current_frontend_semantics': renderable,
        'removed_legacy_rows_vs_current': len(current) - len(candidate),
        'matched_enrichment_rows': build.get('matched_total'),
        'minimal_official_master_rows': build.get('unmatched_master_rows'),
        'ambiguous_matches': build.get('ambiguous_matches'),
        'enrichment_coverage': build.get('enrichment_coverage'),
        'missing_required_columns': missing_columns,
        'missing_required_values': missing_required_values,
        'duplicate_display_codes_count': len(duplicate_codes),
        'duplicate_display_codes_sample': duplicate_codes[:50],
        'rich_field_nonempty_counts_current_site': current_rich,
        'rich_field_nonempty_counts_candidate': candidate_rich,
        'safety_checks': safety_checks,
        'safety': safety,
        'note': 'prestashop_product_id is the official identity. Duplicate display codes are reported because the current frontend still keys favorites/modals by shobi_code and must be audited before production switch.'
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if safety != 'PASS':
        raise SystemExit('Safety stop: site candidate regression audit failed')


if __name__ == '__main__':
    main()
