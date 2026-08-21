#!/usr/bin/env python3
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / 'shobi-master.csv'
CAPTURE = ROOT / 'bestsellers-1.js'
RANKING = ROOT / 'bestseller-ranking.js'

ALIASES = {
    '1685-FRED N': '1685-FRE N',
    '1068-CHA': '1068-CHA M',
    '1930-VIC': '1930-VIC M',
    '1156-HER': '1156-HER M',
    '1065-CHA': '1065-CHA M',
}


def clean(v):
    return re.sub(r'\s+', ' ', str(v or '')).strip()


def norm_code(v):
    v = clean(v).upper().replace('Ν', 'N')
    m = re.match(r'^(\d{1,5})\s*-\s*([A-Z0-9]+)(?:\s+([A-Z0-9]+))?', v)
    if not m:
        return v
    code = f'{m.group(1)}-{m.group(2)}' + (f' {m.group(3)}' if m.group(3) else '')
    return ALIASES.get(code, code)


def load_master_codes():
    with MASTER.open('r', encoding='utf-8-sig', newline='') as fh:
        rows = list(csv.DictReader(fh))
    return {norm_code(r.get('shobi_code')) for r in rows if r.get('shobi_code')}


def load_capture_codes():
    text = CAPTURE.read_text(encoding='utf-8')
    m = re.search(r'\.concat\((\[.*?\])\)', text, re.S)
    if not m:
        raise SystemExit('Could not parse bestsellers-1.js')
    return json.loads(m.group(1))


def load_verified_global_ranks():
    text = RANKING.read_text(encoding='utf-8')
    m = re.search(r'window\.SHOBI_BESTSELLER_RANKING=(\[.*?\]);', text, re.S)
    if not m:
        return {}
    rows = json.loads(m.group(1))
    return {norm_code(x['code']): x.get('globalRank') for x in rows if x.get('globalRank') is not None}


def main():
    master = load_master_codes()
    captured = load_capture_codes()
    verified = load_verified_global_ranks()
    selected = []
    seen = set()
    for raw in captured:
        code = norm_code(raw)
        if code not in master or code in seen:
            continue
        seen.add(code)
        selected.append(code)
        if len(selected) == 100:
            break
    if len(selected) != 100:
        raise SystemExit(f'Only {len(selected)} captured codes survive Master filtering')
    rows = [
        {'rank': i + 1, 'globalRank': verified.get(code), 'code': code}
        for i, code in enumerate(selected)
    ]
    payload = json.dumps(rows, ensure_ascii=False, separators=(',', ':'))
    RANKING.write_text(
        '// TEST/QA ranking seed filtered against the current official Master.\n'
        '// Verified live globalRank values are preserved where available; remaining QA ranks use the captured perfume sequence and globalRank=null.\n'
        f'window.SHOBI_BESTSELLER_RANKING={payload};\n'
        'window.SHOBI_BESTSELLER_CODES=window.SHOBI_BESTSELLER_RANKING.map(x=>x.code);\n'
        'window.SHOBI_BESTSELLER_RANK_BY_CODE=Object.fromEntries(window.SHOBI_BESTSELLER_RANKING.map(x=>[x.code,x.rank]));\n'
        'window.SHOBI_BESTSELLER_GLOBAL_RANK_BY_CODE=Object.fromEntries(window.SHOBI_BESTSELLER_RANKING.filter(x=>x.globalRank!=null).map(x=>[x.code,x.globalRank]));\n',
        encoding='utf-8'
    )
    print('QA_TOP100=100')
    print('FIRST=' + selected[0])
    print('LAST=' + selected[-1])


if __name__ == '__main__':
    main()
