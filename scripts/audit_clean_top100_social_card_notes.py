#!/usr/bin/env python3
import json,re
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DB=ROOT/'Fragrantica ID Database'/'rebuild-top100'
CLEAN=DB/'shobi-top100-clean.json'
MAPPED=DB/'top100-fragrantica-mapped.json'
NEW_NOTES=DB/'new-identities-main-notes-verified.json'
SOCIAL_CARD_MAP=ROOT/'bestseller-catcher-notes.js'
REPORT=DB/'top100-social-card-notes-audit.json'
ALIASES={'1685-FRED N':'1685-FRE N','1068-CHA':'1068-CHA M','1930-VIC':'1930-VIC M','1156-HER':'1156-HER M','1065-CHA':'1065-CHA M'}

def clean(v): return re.sub(r'\s+',' ',str(v or '')).strip()
def norm_code(v):
    v=clean(v).upper().replace('Ν','N')
    m=re.match(r'^(\d{1,5})\s*-\s*([A-Z0-9]+)(?:\s+([A-Z0-9]+))?',v)
    if not m:return v
    code=f'{m.group(1)}-{m.group(2)}'+(f' {m.group(3)}' if m.group(3) else '')
    return ALIASES.get(code,code)

def authority():
    text=SOCIAL_CARD_MAP.read_text(encoding='utf-8')
    m=re.search(r'const\s+socialCardNotes\s*=\s*(\{.*?\});\s*\n\s*window\.SHOBI_SOCIAL_CARD_NOTES_BY_CODE',text,re.S)
    if not m: raise SystemExit('Cannot parse socialCardNotes authority')
    raw=json.loads(m.group(1))
    out={norm_code(k):[clean(x) for x in v if clean(x)] for k,v in raw.items()}
    if NEW_NOTES.exists():
        d=json.loads(NEW_NOTES.read_text(encoding='utf-8'))
        for row in d.get('records') or []:
            code=norm_code(row.get('shobi_code'))
            notes=[clean(x) for x in (row.get('main_notes') or []) if clean(x)]
            if code and notes: out[code]=notes
    return out

def main():
    clean_rows=json.loads(CLEAN.read_text(encoding='utf-8')).get('records') or []
    mapped_rows=json.loads(MAPPED.read_text(encoding='utf-8')).get('records') or []
    if len(clean_rows)!=100 or len(mapped_rows)!=100:
        raise SystemExit(f'Safety stop: expected 100 clean + 100 mapped, got {len(clean_rows)} + {len(mapped_rows)}')

    auth=authority()
    mapped={norm_code(r.get('shobi_code')):r for r in mapped_rows}
    results=[]
    missing_authority=[]; missing_mapped=[]; truncated=[]; extra=[]; order_or_value=[]

    for expected_rank,src in enumerate(clean_rows,1):
        code=norm_code(src.get('shobi_code') or src.get('shobi_name'))
        expected=auth.get(code)
        got=(mapped.get(code) or {}).get('main_notes')
        got=[clean(x) for x in (got or []) if clean(x)]
        status='exact'
        if expected is None:
            status='missing-authority'; missing_authority.append({'rank':expected_rank,'shobi_code':code})
            expected=[]
        elif code not in mapped:
            status='missing-mapped'; missing_mapped.append({'rank':expected_rank,'shobi_code':code})
        elif got==expected:
            status='exact'
        elif len(got)<len(expected) and got==expected[:len(got)]:
            status='truncated'; truncated.append({'rank':expected_rank,'shobi_code':code,'card_count':len(expected),'saved_count':len(got),'expected':expected,'saved':got})
        elif len(got)>len(expected) and got[:len(expected)]==expected:
            status='extra'; extra.append({'rank':expected_rank,'shobi_code':code,'card_count':len(expected),'saved_count':len(got),'expected':expected,'saved':got})
        else:
            status='order-or-value-mismatch'; order_or_value.append({'rank':expected_rank,'shobi_code':code,'expected':expected,'saved':got})
        results.append({'rank':expected_rank,'shobi_code':code,'card_note_count':len(expected),'saved_note_count':len(got),'status':status,'card_notes':expected,'saved_notes':got})

    exact=sum(r['status']=='exact' for r in results)
    payload={
        'schema_version':1,
        'audited_at':datetime.now(timezone.utc).isoformat(),
        'rule':'All Main Notes visible on the Fragrantica public social card, exact displayed order/count; no fixed Top-N truncation.',
        'target_count':100,
        'exact_match_count':exact,
        'missing_authority_count':len(missing_authority),
        'missing_mapped_count':len(missing_mapped),
        'truncated_count':len(truncated),
        'extra_count':len(extra),
        'order_or_value_mismatch_count':len(order_or_value),
        'missing_authority':missing_authority,
        'missing_mapped':missing_mapped,
        'truncated':truncated,
        'extra':extra,
        'order_or_value_mismatch':order_or_value,
        'records':results,
    }
    REPORT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'SOCIAL_CARD_NOTES_EXACT_MATCH={exact}/100')
    print(f'MISSING_AUTHORITY={len(missing_authority)} MISSING_MAPPED={len(missing_mapped)} TRUNCATED={len(truncated)} EXTRA={len(extra)} ORDER_OR_VALUE_MISMATCH={len(order_or_value)}')
    if exact!=100:
        raise SystemExit('Social-card notes audit failed: not 100/100 exact')

if __name__=='__main__': main()
