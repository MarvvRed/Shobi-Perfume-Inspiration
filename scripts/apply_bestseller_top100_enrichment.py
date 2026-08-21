#!/usr/bin/env python3
import csv,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'Shobi Master Database'/'bestseller-top100-enrichment.csv'
RUNTIME=ROOT/'Personal Database'/'site-runtime-v2.json'
ENRICH=ROOT/'Personal Database'/'site-enrichment-v2.json'
OUT=ROOT/'site-build'/'bestseller-top100-enrichment-overlay.json'

def key(v): return re.sub(r'\s+','',str(v or '')).upper()
rows=list(csv.DictReader(SRC.open(encoding='utf-8')))
if len(rows)!=100: raise SystemExit(f'Expected 100 enrichment rows, got {len(rows)}')
if any(r.get('source_status') not in {'source-locked','approved-existing-card'} for r in rows):
    bad=[r['rank'] for r in rows if r.get('source_status') not in {'source-locked','approved-existing-card'}]
    raise SystemExit('Non locked rows: '+','.join(bad))
runtime=json.loads(RUNTIME.read_text(encoding='utf-8'))
site_by_key={key(p[0]):p for p in runtime.get('p',[])}
existing=json.loads(ENRICH.read_text(encoding='utf-8')).get('e',{})
overlay={}
missing=[]
for r in rows:
    k=key(r['shobi_code']); p=site_by_key.get(k)
    if not p:
        missing.append(r['shobi_code']); continue
    notes=[x.strip() for x in (r.get('main_notes') or '').split('|') if x.strip()]
    if not notes: raise SystemExit(f'No notes for rank {r["rank"]}')
    old=existing.get(k) or existing.get(r['shobi_code']) or [[],"",[],"",""]
    while len(old)<5: old.append('')
    overlay[k]={
      'rank':int(r['rank']),'code':p[0],'perfume':r['perfume'],'gender':r['gender'],'season':r['season'],
      'main_notes':notes[:5],'note_count':int(r['note_count'] or len(notes)),'source_status':r['source_status'],
      'image':old[1] if len(old)>1 else '', 'shobi_url':old[3] if len(old)>3 else '', 'fragrantica_url':old[4] if len(old)>4 else ''
    }
if missing: raise SystemExit('Top100 codes missing from public runtime: '+','.join(missing))
if len(overlay)!=100: raise SystemExit(f'Expected overlay 100, got {len(overlay)}')
OUT.parent.mkdir(exist_ok=True)
OUT.write_text(json.dumps({'v':1,'count':100,'e':overlay},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(f'OK: wrote {OUT.relative_to(ROOT)} with {len(overlay)} source-locked Top100 records')
