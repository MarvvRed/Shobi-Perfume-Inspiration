#!/usr/bin/env python3
import csv
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'Shobi Master Database'/'bestseller-top100-enrichment.csv'
LOCK=ROOT/'Shobi Master Database'/'bestseller-top100-source-lock.csv'
OUT=ROOT/'bestseller-top100-source-lock-summary.txt'


def read(path):
    with path.open('r',encoding='utf-8-sig',newline='') as f:
        return list(csv.DictReader(f))


def clean(v): return ' '.join(str(v or '').split()).strip()


def main():
    data=read(DATA); locks=read(LOCK)
    if len(data)!=100: raise SystemExit(f'Safety stop: enrichment rows={len(data)} expected=100')
    by_code={clean(r.get('shobi_code')):r for r in data}
    locked={}
    bad=[]
    for r in locks:
        code=clean(r.get('shobi_code'))
        if code not in by_code: bad.append(f'lock code not in Top100: {code}'); continue
        if clean(r.get('status'))!='source-locked': bad.append(f'bad lock status: {code}'); continue
        if not clean(r.get('primary_source')).startswith('http'): bad.append(f'missing primary source: {code}'); continue
        locked[code]=r
    if bad: raise SystemExit('Safety stop: '+'; '.join(bad))
    missing=[r for r in data if clean(r.get('shobi_code')) not in locked]
    lines=[
        'BESTSELLER TOP 100 SOURCE LOCK AUDIT',
        f'TOTAL=100',
        f'SOURCE_LOCKED={len(locked)}/100',
        f'PENDING_SOURCE_LOCK={len(missing)}/100',
        f'PRODUCTION_READY={1 if len(locked)==100 else 0}',
        '',
        'PENDING:',
    ]
    lines += [f"#{r['rank']} {r['shobi_code']} | {r['perfume']}" for r in missing]
    OUT.write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print('\n'.join(lines[:5]))

if __name__=='__main__': main()
