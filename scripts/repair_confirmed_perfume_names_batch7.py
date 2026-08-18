#!/usr/bin/env python3
import csv,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
FILES=[ROOT/'shobi-master.csv',ROOT/'shobi-master-en.csv']
CODE='2073-LTN N'
TARGET='ÉTOILE FILANTE'
BAD={'','notes','note','of','n/a','na','unknown','-'}
def clean(v): return re.sub(r'\s+',' ',str(v or '')).strip()
def repair(p):
 with p.open('r',encoding='utf-8-sig',newline='') as fh:
  rd=csv.DictReader(fh); fields=rd.fieldnames or []; rows=list(rd)
 if len(rows)!=2273: raise SystemExit(f'{p.name}: rows={len(rows)}')
 before=[dict(r) for r in rows]; found=False
 for r in rows:
  code=clean(r.get('shobi_code'))
  if code!=CODE: continue
  found=True
  for f in ('inspired_by','shobi_name'):
   cur=clean(r.get(f))
   if cur and cur!=CODE and cur.casefold() not in BAD and cur.casefold()!=TARGET.casefold():
    raise SystemExit(f'{p.name}: conflict {CODE} {f}={cur!r}')
   r[f]=TARGET
 if not found: raise SystemExit(f'{p.name}: {CODE} missing')
 for a,b in zip(before,rows):
  for f in fields:
   if f not in {'inspired_by','shobi_name'} and a.get(f,'')!=b.get(f,''):
    raise SystemExit(f'forbidden change {b.get("shobi_code")} {f}')
 tmp=p.with_suffix(p.suffix+'.tmp')
 with tmp.open('w',encoding='utf-8-sig',newline='') as fh:
  wr=csv.DictWriter(fh,fieldnames=fields); wr.writeheader(); wr.writerows(rows)
 tmp.replace(p)
 print(f'{p.name}: {CODE}={TARGET}')
def main():
 for p in FILES: repair(p)
if __name__=='__main__': main()
