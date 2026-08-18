#!/usr/bin/env python3
import csv,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
FILES=[ROOT/'shobi-master.csv',ROOT/'shobi-master-en.csv']
TARGETS={
 '2791-LTN N':'MOON TALE',
 '2786-LTN N':'TEA STORM',
 '2783-LTN N':'INK MARK',
}
BAD={'','notes','note','of','n/a','na','unknown','-'}
def clean(v): return re.sub(r'\s+',' ',str(v or '')).strip()
def repair(p):
 with p.open('r',encoding='utf-8-sig',newline='') as fh:
  rd=csv.DictReader(fh); fields=rd.fieldnames or []; rows=list(rd)
 if len(rows)!=2273: raise SystemExit(f'{p.name}: rows={len(rows)}')
 before=[dict(r) for r in rows]; seen=set()
 for r in rows:
  code=clean(r.get('shobi_code'))
  if code not in TARGETS: continue
  seen.add(code); target=TARGETS[code]
  for f in ('inspired_by','shobi_name'):
   cur=clean(r.get(f))
   if cur and cur!=code and cur.casefold() not in BAD and cur.casefold()!=target.casefold():
    raise SystemExit(f'{p.name}: conflict {code} {f}={cur!r}')
   r[f]=target
 if seen!=set(TARGETS): raise SystemExit(f'{p.name}: missing={set(TARGETS)-seen}')
 for a,b in zip(before,rows):
  for f in fields:
   if f not in {'inspired_by','shobi_name'} and a.get(f,'')!=b.get(f,''):
    raise SystemExit(f'forbidden change {b.get("shobi_code")} {f}')
 tmp=p.with_suffix(p.suffix+'.tmp')
 with tmp.open('w',encoding='utf-8-sig',newline='') as fh:
  wr=csv.DictWriter(fh,fieldnames=fields); wr.writeheader(); wr.writerows(rows)
 tmp.replace(p)
 print(f'{p.name}: verified={len(TARGETS)}')
def main():
 for p in FILES: repair(p)
if __name__=='__main__': main()
