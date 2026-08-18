#!/usr/bin/env python3
import csv,re
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'shobi-master.csv'
def clean(v): return re.sub(r'\s+',' ',str(v or '')).strip()
def main():
 with SOURCE.open('r',encoding='utf-8-sig',newline='') as fh: rows=list(csv.DictReader(fh))
 missing=[r for r in rows if not clean(r.get('identity_source_url'))]
 print(f'MISSING_IDENTITY_SOURCE_URL={len(missing)}')
 print('TYPES='+' | '.join(f'{k}:{v}' for k,v in sorted(Counter(clean(r.get("identity_source_type")) for r in missing).items())))
 recoverable=0
 for r in missing:
  options=[]
  for f in ('fragrantica_url','secondary_identity_source','shobi_url'):
   v=clean(r.get(f))
   if v.startswith(('http://','https://')): options.append((f,v))
  if any(f!='shobi_url' for f,_ in options): recoverable+=1
  print('ROW\t%s\t%s\t%s\t%s\t%s\t%s' % (clean(r.get('shobi_code')),clean(r.get('identity_source_type')),clean(r.get('identity_match_rule')),clean(r.get('fragrantica_url')),clean(r.get('secondary_identity_source')),clean(r.get('shobi_url'))))
 print(f'NON_SHOBI_URL_AVAILABLE={recoverable}')
if __name__=='__main__': main()
