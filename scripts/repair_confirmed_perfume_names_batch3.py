#!/usr/bin/env python3
import csv,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
FILES=[ROOT/'shobi-master.csv',ROOT/'shobi-master-en.csv']
BAD={'','notes','note','of','n/a','na','unknown','-'}
CONFIRMED={
 '2458-LTN EL':'LV LOVERS',
 '2319-LTN N':'ORAGE',
 '2193-LTN N':'MON NOUVEAU',
 '2141-LTN N':'STELLAR TIMES',
 '1612-LTN N':'TURBULENCES',
}
def clean(v): return re.sub(r'\s+',' ',str(v or '')).strip()
def bad(code,v):
 x=clean(v); return not x or x==code or x.casefold() in BAD
def repair(p):
 with p.open('r',encoding='utf-8-sig',newline='') as fh:
  rd=csv.DictReader(fh); fields=rd.fieldnames or []; rows=list(rd)
 if len(rows)!=2273: raise SystemExit(f'{p.name}: rows={len(rows)}')
 before=[dict(r) for r in rows]; changed=0; seen=set()
 for r in rows:
  code=clean(r.get('shobi_code'))
  if code not in CONFIRMED: continue
  seen.add(code); target=CONFIRMED[code]; touched=False
  for f in ('inspired_by','shobi_name'):
   if bad(code,r.get(f)): r[f]=target; touched=True
   elif clean(r.get(f)).casefold()!=target.casefold(): raise SystemExit(f'{p.name}: conflict {code} {f}={r.get(f)!r}')
  changed+=int(touched)
 if seen!=set(CONFIRMED): raise SystemExit(f'{p.name}: missing={set(CONFIRMED)-seen}')
 for a,b in zip(before,rows):
  for f in fields:
   if f not in {'inspired_by','shobi_name'} and a.get(f,'')!=b.get(f,''): raise SystemExit(f'forbidden {b.get("shobi_code")} {f}')
 tmp=p.with_suffix(p.suffix+'.tmp')
 with tmp.open('w',encoding='utf-8-sig',newline='') as fh:
  wr=csv.DictWriter(fh,fieldnames=fields); wr.writeheader(); wr.writerows(rows)
 tmp.replace(p); return changed
def main():
 c={p.name:repair(p) for p in FILES}
 if any(v!=len(CONFIRMED) for v in c.values()): raise SystemExit(f'expected {len(CONFIRMED)}: {c}')
 print(c)
if __name__=='__main__': main()
