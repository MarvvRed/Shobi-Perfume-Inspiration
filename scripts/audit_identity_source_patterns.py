#!/usr/bin/env python3
import csv,re
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'shobi-master.csv'
def clean(v): return re.sub(r'\s+',' ',str(v or '')).strip()
def main():
 with SOURCE.open('r',encoding='utf-8-sig',newline='') as fh: rows=list(csv.DictReader(fh))
 same=[]
 for r in rows:
  iu=clean(r.get('identity_source_url')); fu=clean(r.get('fragrantica_url'))
  if iu and fu and iu==fu: same.append(r)
 print(f'IDENTITY_EQUALS_FRAGRANTICA={len(same)}')
 for field in ('identity_source_type','identity_verified','identity_match_rule'):
  c=Counter(clean(r.get(field)) for r in same)
  print(field.upper()+'='+' | '.join(f'{k}:{v}' for k,v in sorted(c.items())))
 examples=same[:20]
 for r in examples:
  print('ROW\t%s\t%s\t%s\t%s\t%s' % (clean(r.get('shobi_code')),clean(r.get('identity_source_type')),clean(r.get('identity_verified')),clean(r.get('identity_match_rule')),clean(r.get('identity_source_url'))))
if __name__=='__main__': main()
