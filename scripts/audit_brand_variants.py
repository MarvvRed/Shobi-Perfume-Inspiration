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
  counts=Counter(clean(r.get('brand')) for r in groups[k])
  print(f'KEY\t{k}\tROWS={len(groups[k])}\tBRANDS='+' | '.join(f'{b}:{n}' for b,n in sorted(counts.items())))
if __name__=='__main__': main()
