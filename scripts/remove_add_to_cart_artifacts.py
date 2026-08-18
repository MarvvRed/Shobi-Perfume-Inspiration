#!/usr/bin/env python3
import csv,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
FILES=[ROOT/'shobi-master.csv',ROOT/'shobi-master-en.csv']
PATTERN=re.compile(r'\s+Add to cart\s*$',re.I)
def repair(path):
 with path.open('r',encoding='utf-8-sig',newline='') as fh:
  rd=csv.DictReader(fh); fields=rd.fieldnames or []; rows=list(rd)
 if len(rows)!=2273: raise SystemExit(f'{path.name}: rows={len(rows)}')
 before=[dict(r) for r in rows]; changed_rows=0; changed_cells=0
 for r in rows:
  touched=False
  for f in ('inspired_by','shobi_name'):
   cur=str(r.get(f) or '')
   new=PATTERN.sub('',cur).strip()
   if new!=cur:
    if not new: raise SystemExit(f'{path.name}: empty result {r.get("shobi_code")} {f}')
    r[f]=new; changed_cells+=1; touched=True
  changed_rows+=int(touched)
 if changed_rows!=42 or changed_cells!=84:
  raise SystemExit(f'{path.name}: expected 42 rows/84 cells, got {changed_rows}/{changed_cells}')
 for a,b in zip(before,rows):
  for f in fields:
   if f not in {'inspired_by','shobi_name'} and a.get(f,'')!=b.get(f,''):
    raise SystemExit(f'forbidden change {b.get("shobi_code")} {f}')
 tmp=path.with_suffix(path.suffix+'.tmp')
 with tmp.open('w',encoding='utf-8-sig',newline='') as fh:
  wr=csv.DictWriter(fh,fieldnames=fields); wr.writeheader(); wr.writerows(rows)
 tmp.replace(path)
 print(f'{path.name}: rows={changed_rows} cells={changed_cells}')
def main():
 for p in FILES: repair(p)
if __name__=='__main__': main()
