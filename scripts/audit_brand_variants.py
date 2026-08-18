#!/usr/bin/env python3
import csv,re
from collections import defaultdict,Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'shobi-master.csv'
KEYS={'ARM','BYRP','INI','JOV','KIL','MARC','VICT'}
def clean(v): return re.sub(r'\s+',' ',str(v or '')).strip()
def key(code):
 m=re.match(r'^\s*\d+\s*-\s*([A-Z0-9]+)',clean(code).upper()); return m.group(1) if m else ''
def main():
 with SOURCE.open('r',encoding='utf-8-sig',newline='') as fh: rows=list(csv.DictReader(fh))
 groups=defaultdict(list)
 for r in rows:
  k=key(r.get('shobi_code'))
  if k in KEYS: groups[k].append(r)
 for k in sorted(KEYS):
  rowsk=groups[k]
  counts=Counter(clean(r.get('brand')) for r in rowsk)
  print(f'KEY\t{k}\tROWS={len(rowsk)}\tBRANDS='+' | '.join(f'{b}:{n}' for b,n in sorted(counts.items())))
  for r in rowsk:
   print('ROW\t%s\t%s\t%s\t%s\t%s' % (k,clean(r.get('shobi_code')),clean(r.get('brand')),clean(r.get('inspired_by')),clean(r.get('shobi_url'))))
if __name__=='__main__': main()
