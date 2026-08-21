#!/usr/bin/env python3
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / 'shobi-master.csv'
RANKING = ROOT / 'bestseller-ranking.js'
OUT = ROOT / 'Shobi Master Database' / 'bestseller-top100-enrichment.csv'


def clean(v): return ' '.join(str(v or '').split()).strip()
def key(v): return re.sub(r'\s+', '', clean(v).upper())

def ranking():
    text=RANKING.read_text(encoding='utf-8')
    m=re.search(r'window\.SHOBI_BESTSELLER_RANKING=(\[.*?\]);',text,re.S)
    if not m: raise SystemExit('ranking parse failed')
    rows=json.loads(m.group(1))
    if len(rows)<100: raise SystemExit('ranking has fewer than 100 rows')
    return rows[:100]

def main():
    ranked=ranking()
    ranked_codes=[key(x.get('code')) for x in ranked]
    if OUT.exists():
        with OUT.open('r',encoding='utf-8-sig',newline='') as f:
            rows=list(csv.DictReader(f))
        if len(rows)!=100:
            raise SystemExit(f'Safety stop: curated Top100 table has {len(rows)} rows, expected 100')
        table_codes=[key(r.get('shobi_code')) for r in rows]
        if len(set(table_codes))!=100:
            raise SystemExit('Safety stop: duplicate shobi_code in curated Top100 table')
        if table_codes!=ranked_codes:
            raise SystemExit('Safety stop: curated Top100 table no longer matches current ranking; explicit reconciliation required')
        print('CURATED_TOP100_PRESENT=1')
        print('ROWS=100')
        print('ACTION=preserve-existing-no-overwrite')
        return
    raise SystemExit('Safety stop: curated Top100 table missing. Do not auto-recreate after curation; restore or rebuild explicitly.')

if __name__=='__main__': main()
