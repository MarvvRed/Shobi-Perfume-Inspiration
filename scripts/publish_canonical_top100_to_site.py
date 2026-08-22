#!/usr/bin/env python3
import json,re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'Fragrantica ID Database'/'rebuild-top100'/'top100-fragrantica-mapped.json'
OUT=ROOT/'bestseller-001-100-canonical-data.js'


def norm_code(v):
    return re.sub(r'\s+','',str(v or '').upper())


def main():
    payload=json.loads(SRC.read_text(encoding='utf-8'))
    records=payload.get('records') or []
    checks={
        'records': len(records)==100,
        'mapped_count': payload.get('mapped_count')==100,
        'identity_verified': payload.get('identity_verified_count')==100,
        'notes_verified': payload.get('main_notes_verified_count')==100,
        'gender_verified': payload.get('gender_verified_count')==100,
        'season_verified': payload.get('season_verified_count')==100,
    }
    if not all(checks.values()):
        raise SystemExit(f'Safety stop: canonical Top100 incomplete: {checks}')
    if [int(r.get('rank') or 0) for r in records] != list(range(1,101)):
        raise SystemExit('Safety stop: canonical ranks must be exactly 1..100')

    by_code={}
    for r in records:
        code=norm_code(r.get('shobi_code'))
        notes=[str(x).strip() for x in (r.get('main_notes') or []) if str(x).strip()]
        season=str(r.get('season') or '').lower()
        gender=str(r.get('gender') or '').lower()
        if not code or code in by_code:
            raise SystemExit(f'Safety stop: missing/duplicate Shobi code: {r.get("shobi_code")}')
        if not r.get('fragrantica_id') or not r.get('fragrantica_url') or not r.get('social_card_url') or not r.get('image_url'):
            raise SystemExit(f'Safety stop: missing canonical Fragrantica resource at rank {r.get("rank")}')
        if len(notes)!=(r.get('main_note_count') or len(notes)) or not notes:
            raise SystemExit(f'Safety stop: canonical Main Notes count mismatch at rank {r.get("rank")}')
        if gender not in {'male','female','unisex'}:
            raise SystemExit(f'Safety stop: invalid canonical gender at rank {r.get("rank")}: {gender}')
        if season not in {'winter','spring','summer','autumn'}:
            raise SystemExit(f'Safety stop: invalid canonical season at rank {r.get("rank")}: {season}')
        row=dict(r)
        row['main_notes']=notes
        row['gender']=gender
        row['season']=season
        by_code[code]=row

    canary=next(r for r in records if int(r['rank'])==82)
    if str(canary.get('season')).lower()!='winter':
        raise SystemExit('Safety stop: rank 82 Stronger With You Intensely canary must be winter')

    text=(
        '// Generated ONLY from CANONICAL-TOP100-v1. Do not hand edit.\n'
        '// Source: Fragrantica ID Database/rebuild-top100/top100-fragrantica-mapped.json\n'
        + 'window.SHOBI_FRAGRANTICA_CANONICAL_TOP100='
        + json.dumps(by_code,ensure_ascii=False,separators=(',',':'))
        + ';\n'
    )
    OUT.write_text(text,encoding='utf-8')
    print('SITE_CANONICAL_TOP100=100/100')
    print('SITE_CANONICAL_MAIN_NOTES=100/100')
    print('SITE_CANONICAL_GENDER=100/100')
    print('SITE_CANONICAL_SEASON=100/100')
    print('SITE_CANARY_82=WINTER')

if __name__=='__main__': main()
