#!/usr/bin/env python3
# Rebuilt clean Top100 -> official Fragrantica ID Mapping Rule.
import json, re
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DB=ROOT/'Fragrantica ID Database'
CLEAN=DB/'rebuild-top100'/'shobi-top100-clean.json'
REGISTRY=DB/'mappings'/'bestseller-001-100.json'
SUPPLEMENT=DB/'rebuild-top100'/'new-identities-verified.json'
OUT=DB/'rebuild-top100'/'top100-fragrantica-mapped.json'
UNRESOLVED=DB/'rebuild-top100'/'top100-fragrantica-unresolved.json'
ALIASES={'1685-FRED N':'1685-FRE N','1068-CHA':'1068-CHA M','1930-VIC':'1930-VIC M','1156-HER':'1156-HER M','1065-CHA':'1065-CHA M'}

def clean(v): return re.sub(r'\s+',' ',str(v or '')).strip()
def norm_code(v):
    v=clean(v).upper().replace('Ν','N')
    m=re.match(r'^(\d{1,5})\s*-\s*([A-Z0-9]+)(?:\s+([A-Z0-9]+))?',v)
    if not m: return v
    code=f'{m.group(1)}-{m.group(2)}'+(f' {m.group(3)}' if m.group(3) else '')
    return ALIASES.get(code,code)
def derived(fid):
    return {'social_card_url':f'https://fimgs.net/mdimg/perfume-social-cards/en-p_c_{fid}.jpeg','image_url':f'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.{fid}.avif'}

def main():
    clean_payload=json.loads(CLEAN.read_text(encoding='utf-8'))
    registry_payload=json.loads(REGISTRY.read_text(encoding='utf-8'))
    supplement_payload=json.loads(SUPPLEMENT.read_text(encoding='utf-8'))
    clean_rows=clean_payload.get('records') or []
    if len(clean_rows)!=100: raise SystemExit(f'Safety stop: clean Top100 must contain exactly 100 records, got {len(clean_rows)}')

    by_code={}
    for source_name,rows in (
        ('Fragrantica ID Database/mappings/bestseller-001-100.json',registry_payload.get('records') or []),
        ('Fragrantica ID Database/rebuild-top100/new-identities-verified.json',supplement_payload.get('records') or []),
    ):
        for row in rows:
            code=norm_code(row.get('shobi_code'))
            if not code: continue
            if code in by_code and source_name.endswith('new-identities-verified.json'):
                # New verified identities intentionally supersede stale/variant legacy rows by Shobi code.
                pass
            elif code in by_code:
                continue
            copied=dict(row)
            copied['_identity_source']=source_name
            by_code[code]=copied

    mapped=[]; unresolved=[]; seen_ids={}
    for expected_rank,source in enumerate(clean_rows,start=1):
        rank=int(source.get('rank') or 0)
        if rank!=expected_rank: raise SystemExit(f'Safety stop: non-contiguous clean rank at {expected_rank}')
        code=norm_code(source.get('shobi_code') or source.get('shobi_name'))
        verified=by_code.get(code)
        if not verified:
            unresolved.append({'rank':rank,'shobi_code':code,'field':'fragrantica_identity','reason':'No verified Fragrantica ID mapping exists for this Shobi code'})
            continue
        fid=verified.get('fragrantica_id'); furl=clean(verified.get('fragrantica_url'))
        if not fid or not furl:
            unresolved.append({'rank':rank,'shobi_code':code,'field':'fragrantica_identity','reason':'Verified registry entry missing Fragrantica ID or URL'})
            continue
        fid=int(fid)
        if fid in seen_ids and seen_ids[fid]!=code: raise SystemExit(f'Safety stop: duplicate Fragrantica ID {fid} for {seen_ids[fid]} and {code}')
        seen_ids[fid]=code
        urls=derived(fid); notes=list(verified.get('main_notes') or []); evidence=list(verified.get('main_note_evidence') or [])
        gender=verified.get('gender') or None; season=verified.get('season') or None
        mapped.append({'rank':rank,'shobi_code':code,'shobi_name':clean(source.get('shobi_name')),'shobi_url':clean(source.get('url')),'inspired_by_shobi':clean(source.get('inspired_by')),'perfume':clean(verified.get('perfume')) or clean(source.get('inspired_by')),'fragrantica_id':fid,'fragrantica_url':furl,'social_card_url':urls['social_card_url'],'image_url':urls['image_url'],'main_notes':notes,'main_note_evidence':evidence,'gender':gender,'season':season,'verification':{'shobi_ranking':True,'fragrantica_identity':True,'main_notes':bool(notes),'gender':bool(gender),'season':bool(season),'mapping_join_key':'shobi_code','identity_registry':verified.get('_identity_source')}})

    payload={'schema_version':2,'method':'Fragrantica ID Mapping Rule','built_at':datetime.now(timezone.utc).isoformat(),'ranking_authority':clean_payload.get('ranking_authority'),'identity_join_key':'shobi_code','identity_authorities':['Fragrantica ID Database/mappings/bestseller-001-100.json','Fragrantica ID Database/rebuild-top100/new-identities-verified.json'],'target_count':100,'mapped_count':len(mapped),'identity_verified_count':len(mapped),'main_notes_verified_count':sum(1 for x in mapped if x['verification']['main_notes']),'gender_verified_count':sum(1 for x in mapped if x['verification']['gender']),'season_verified_count':sum(1 for x in mapped if x['verification']['season']),'records':mapped}
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    UNRESOLVED.write_text(json.dumps({'schema_version':1,'method':'Fragrantica ID Mapping Rule','scope':'Rebuilt clean Shobi Top100','count':len(unresolved),'items':unresolved},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'CLEAN_TOP100_FRAGRANTICA_IDENTITY={len(mapped)}/100')
    print(f'UNRESOLVED_IDENTITIES={len(unresolved)}')
    print(f'MAIN_NOTES_VERIFIED={payload["main_notes_verified_count"]}/100')
    print(f'GENDER_VERIFIED={payload["gender_verified_count"]}/100')
    print(f'SEASON_VERIFIED={payload["season_verified_count"]}/100')

if __name__=='__main__': main()
