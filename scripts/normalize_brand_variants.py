#!/usr/bin/env python3
import csv,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
FILES=[ROOT/'shobi-master.csv',ROOT/'shobi-master-en.csv']
NORMALIZE={
 'BYRP': {'Byron':'Byron Parfums','Byron Parfums':'Byron Parfums'},
 'INI': {'Initio':'Initio Parfums Privés','Initio Parfums Privés':'Initio Parfums Privés'},
 'KIL': {'Kilian':'Kilian Paris','Kilian Paris':'Kilian Paris'},
 'MARC': {'Marc Antoine Barrois':'Marc-Antoine Barrois','Marc-Antoine Barrois':'Marc-Antoine Barrois'},
 'VICT': {"Victoria'S Secret":"Victoria's Secret","Victoria's Secret":"Victoria's Secret"},
}
def clean(v): return re.sub(r'\s+',' ',str(v or '')).strip()
def key(code):
 m=re.match(r'^\s*\d+\s*-\s*([A-Z0-9]+)',clean(code).upper()); return m.group(1) if m else ''
def repair(path):
 with path.open('r',encoding='utf-8-sig',newline='') as fh:
  rd=csv.DictReader(fh); fields=rd.fieldnames or []; rows=list(rd)
 if len(rows)!=2273: raise SystemExit(f'{path.name}: rows={len(rows)}')
 before=[dict(r) for r in rows]; changed=0
 for r in rows:
  k=key(r.get('shobi_code'))
  if k not in NORMALIZE: continue
  cur=clean(r.get('brand'))
  if cur not in NORMALIZE[k]: raise SystemExit(f'{path.name}: unexpected {k} brand {cur!r}')
  target=NORMALIZE[k][cur]
  if cur!=target: r['brand']=target; changed+=1
 for a,b in zip(before,rows):
  for f in fields:
   if f!='brand' and a.get(f,'')!=b.get(f,''): raise SystemExit(f'forbidden change {b.get("shobi_code")} {f}')
 tmp=path.with_suffix(path.suffix+'.tmp')
 with tmp.open('w',encoding='utf-8-sig',newline='') as fh:
  wr=csv.DictWriter(fh,fieldnames=fields); wr.writeheader(); wr.writerows(rows)
 tmp.replace(path); return changed
def main():
 counts={p.name:repair(p) for p in FILES}
 print(counts)
if __name__=='__main__': main()
