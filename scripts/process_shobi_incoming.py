#!/usr/bin/env python3
import csv
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import urlparse, urlunparse

ROOT = Path(__file__).resolve().parents[1]
MASTER_DIR = ROOT / 'Shobi Master Database'
INCOMING = MASTER_DIR / 'incoming' / 'shobi-live-latest.json'
BASELINE = MASTER_DIR / 'shobi-master-v1.csv'
CURRENT = MASTER_DIR / 'shobi-master-current.csv'
CANDIDATE = MASTER_DIR / 'shobi-master-candidate.csv'
REPORT_JSON = MASTER_DIR / 'latest-sync-report.json'
REPORT_CSV = MASTER_DIR / 'latest-sync-changes.csv'
RULE = 'Choose+Bottle+Extra Essence'
SECONDARY_RULE = 'prestashop_product_id present in /el/shobi'
FIELDS = ['prestashop_product_id','shobi_code','shobi_name','reference','reference_prefix','inspired_by','category','price_from_eur','official_description','url','first_seen','last_seen','status','classification_rule','source']


def clean(v): return re.sub(r'\s+', ' ', str(v or '')).strip()
def extract_inspired(desc):
    desc=clean(desc)
    for pat in [r'Inspired by the fragrance notes of\s+(.+?)(?:\.|$)',r'Inspired by the fragrance of\s+(.+?)(?:\.|$)',r'Inspired by\s+(.+?)(?:\.|$)',r'Ιnspired by the fragrance notes of\s+(.+?)(?:\.|$)',r'Ιnspired by\s+(.+?)(?:\.|$)']:
        m=re.search(pat,desc,re.I)
        if m:return clean(m.group(1)).strip(' :-')
    return ''
def extract_code(name,desc):
    for value in (name,desc):
        m=re.match(r'^\s*(\d{2,5}-[A-Za-z0-9]+)',value or '')
        if m:return m.group(1)
    return ''
def price_value(text):
    m=re.search(r'(\d+(?:[\.,]\d+)?)',clean(text)); return m.group(1).replace(',','.') if m else ''
def normalize_url(href):
    p=urlparse(href); return urlunparse((p.scheme,p.netloc,p.path,p.params,p.query,''))
def load_csv(path):
    with path.open('r',encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def write_csv(path,rows,fields=FIELDS):
    with path.open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
def normalize_compare(field,value):
    value=clean(value)
    if field=='price_from_eur' and value:
        try:return f'{float(value.replace(",",".")):.6f}'
        except ValueError:pass
    return value

def main():
    if not INCOMING.exists():raise SystemExit('Safety stop: incoming snapshot missing')
    data=json.loads(INCOMING.read_text(encoding='utf-8'))
    rows=data.get('rows') or []; cat_ids=[clean(x) for x in (data.get('shobi_category_ids') or [])]
    total=int(data.get('total_perfumes_cards') or 0)
    if data.get('classification_rule')!=RULE:raise SystemExit('Safety stop: wrong classification rule in incoming snapshot')
    if data.get('secondary_validation_rule')!=SECONDARY_RULE:raise SystemExit('Safety stop: wrong secondary validation rule')
    if total<2400 or len(rows)<2200:raise SystemExit(f'Safety stop: suspicious counts total={total} shobi={len(rows)}')
    ids=[clean(r.get('prestashop_product_id')) for r in rows]
    if any(not x for x in ids) or len(ids)!=len(set(ids)):raise SystemExit('Safety stop: missing/duplicate Shobi prestashop_product_id')
    if len(cat_ids)<3000 or len(cat_ids)!=len(set(cat_ids)):raise SystemExit('Safety stop: suspicious /el/shobi ID set')
    missing=sorted(set(ids)-set(cat_ids),key=lambda x:int(x) if x.isdigit() else x)
    if missing:raise SystemExit(f'Safety stop: {len(missing)} signature-certified IDs absent from /el/shobi; sample={missing[:20]}')
    for r in rows:
        h=clean(r.get('signature_href')).lower()
        if not all(x in h for x in ('choose-','bottle-','extra_essence-')):
            raise SystemExit(f"Safety stop: invalid signature href for product {r.get('prestashop_product_id')}")

    old_path=CURRENT if CURRENT.exists() else BASELINE
    if not old_path.exists():raise SystemExit('Safety stop: no official Master baseline')
    old_rows=load_csv(old_path); old={r['prestashop_product_id']:r for r in old_rows}
    if abs(len(rows)-len(old_rows))>max(300,int(len(old_rows)*0.12)):
        raise SystemExit(f'Safety stop: suspicious catalog-size jump old={len(old_rows)} live={len(rows)}')

    today=date.today().isoformat(); merged=[]
    for src in rows:
        pid=clean(src['prestashop_product_id']); prev=old.get(pid); row={k:'' for k in FIELDS}
        if prev:row.update(prev)
        reference=clean(src.get('reference')); pm=re.match(r'^[A-Za-z]+',reference)
        live={
          'prestashop_product_id':pid,'shobi_code':extract_code(clean(src.get('shobi_name')),clean(src.get('official_description'))),
          'shobi_name':clean(src.get('shobi_name')),'reference':reference,'reference_prefix':pm.group(0).upper() if pm else '',
          'inspired_by':extract_inspired(src.get('official_description')),'category':clean(src.get('category')),
          'price_from_eur':price_value(src.get('price_text')),'official_description':clean(src.get('official_description')),
          'url':normalize_url(clean(src.get('signature_href')))
        }
        for k,v in live.items():
            if v!='' or not prev:row[k]=v
        row['first_seen']=prev.get('first_seen',today) if prev else today;row['last_seen']=today;row['status']='ACTIVE';row['classification_rule']=RULE;row['source']='SHOBI_LOCAL_AUTHORIZED_XHR'
        merged.append(row)

    live={r['prestashop_product_id']:r for r in merged}; old_ids,live_ids=set(old),set(live)
    def changed_fields(a,b):
        return [k for k in FIELDS if k not in {'last_seen','source'} and normalize_compare(k,a.get(k))!=normalize_compare(k,b.get(k))]
    new_ids=sorted(live_ids-old_ids,key=lambda x:int(x) if x.isdigit() else x); removed_ids=sorted(old_ids-live_ids,key=lambda x:int(x) if x.isdigit() else x); modified=[]
    for pid in sorted(old_ids&live_ids,key=lambda x:int(x) if x.isdigit() else x):
        f=changed_fields(old[pid],live[pid])
        if f:modified.append((pid,f))
    changes=[]
    for pid in new_ids: changes.append({'change':'NEW','prestashop_product_id':pid,'shobi_name':live[pid]['shobi_name'],'reference':live[pid]['reference'],'fields':''})
    for pid,f in modified: changes.append({'change':'MODIFIED','prestashop_product_id':pid,'shobi_name':live[pid]['shobi_name'],'reference':live[pid]['reference'],'fields':'|'.join(f)})
    for pid in removed_ids: changes.append({'change':'REMOVED','prestashop_product_id':pid,'shobi_name':old[pid]['shobi_name'],'reference':old[pid]['reference'],'fields':''})
    write_csv(CANDIDATE,merged);write_csv(REPORT_CSV,changes,['change','prestashop_product_id','shobi_name','reference','fields'])
    catset=set(cat_ids);report={'date':today,'captured_at_utc':data.get('captured_at_utc'),'baseline_file':old_path.name,'source':'LOCAL_AUTHORIZED_FIREFOX_XHR','total_perfumes_cards':total,'shobi_perfumes':len(merged),'shobi_category_products':len(catset),'shobi_category_extra_products':len(catset-live_ids),'shobi_category_missing_perfumes':0,'new':len(new_ids),'modified':len(modified),'removed':len(removed_ids),'changed':bool(changes),'classification_rule':RULE,'secondary_validation_rule':SECONDARY_RULE,'primary_key':'prestashop_product_id','safety':'PASS'}
    REPORT_JSON.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps(report,indent=2,ensure_ascii=False))

if __name__=='__main__':main()
