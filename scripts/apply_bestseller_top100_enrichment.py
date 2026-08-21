#!/usr/bin/env python3
import csv,json,re
from collections import defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'Shobi Master Database'/'bestseller-top100-enrichment.csv'
RUNTIME=ROOT/'Personal Database'/'site-runtime-v2.json'
ENRICH=ROOT/'Personal Database'/'site-enrichment-v2.json'
OUT=ROOT/'site-build'/'bestseller-top100-enrichment-overlay.json'
JSOUT=ROOT/'bestseller-top100-enrichment.js'
def key(v): return re.sub(r'\s+','',str(v or '')).upper()
def base_key(v):
    m=re.match(r'\s*(\d+)',str(v or ''))
    return m.group(1) if m else ''
rows=list(csv.DictReader(SRC.open(encoding='utf-8')))
if len(rows)!=100: raise SystemExit(f'Expected 100 enrichment rows, got {len(rows)}')
if any(r.get('source_status') not in {'source-locked','approved-existing-card'} for r in rows):
    bad=[r['rank'] for r in rows if r.get('source_status') not in {'source-locked','approved-existing-card'}]
    raise SystemExit('Non locked rows: '+','.join(bad))
runtime=json.loads(RUNTIME.read_text(encoding='utf-8'))
products=runtime.get('p',[])
site_by_key={key(p[0]):p for p in products}
by_base=defaultdict(list)
for p in products:
    b=base_key(p[0])
    if b: by_base[b].append(p)
site_by_base={b:ps[0] for b,ps in by_base.items() if len(ps)==1}
existing=json.loads(ENRICH.read_text(encoding='utf-8')).get('e',{})
overlay={}; missing=[]; fallback=[]
for r in rows:
    k=key(r['shobi_code']); p=site_by_key.get(k)
    if not p:
        p=site_by_base.get(base_key(r['shobi_code']))
        if p: fallback.append((r['shobi_code'],p[0]))
    if not p:
        missing.append((int(r['rank']),r['shobi_code']))
        continue
    notes=[x.strip() for x in (r.get('main_notes') or '').split('|') if x.strip()]
    if not notes: raise SystemExit(f'No notes for rank {r["rank"]}')
    actual_key=key(p[0])
    old=existing.get(actual_key) or existing.get(k) or existing.get(r['shobi_code']) or [[],"",[],"",""]
    while len(old)<5: old.append('')
    overlay[actual_key]={'rank':int(r['rank']),'code':p[0],'perfume':r['perfume'],'gender':r['gender'],'season':r['season'],'main_notes':notes[:5],'note_count':int(r['note_count'] or len(notes)),'source_status':r['source_status'],'image':old[1] if len(old)>1 else '','shobi_url':old[3] if len(old)>3 else '','fragrantica_url':old[4] if len(old)>4 else ''}
critical=[f'{rank}:{code}' for rank,code in missing if rank<=40]
if critical:
    raise SystemExit('Verified Top40 enrichment codes missing from public runtime: '+','.join(critical))
if missing:
    print('WARN stale Top100 enrichment rows skipped:', ','.join(f'{rank}:{code}' for rank,code in missing))
if fallback:
    print('INFO base-code fallback matches:', ','.join(f'{src}->{dst}' for src,dst in fallback))
OUT.parent.mkdir(exist_ok=True)
payload={'v':1,'count':len(overlay),'source_rows':100,'missing_count':len(missing),'e':overlay}
OUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
JSOUT.write_text('// Generated from Shobi Master Database/bestseller-top100-enrichment.csv; do not hand edit.\nwindow.SHOBI_TOP100_ENRICHMENT_BY_CODE='+json.dumps(overlay,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
print(f'OK: wrote {OUT.relative_to(ROOT)} and {JSOUT.name} with {len(overlay)} source-locked Top100 records; skipped {len(missing)} stale rows')
