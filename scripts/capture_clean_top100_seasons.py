#!/usr/bin/env python3
import json,re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
DB=ROOT/'Fragrantica ID Database'/'rebuild-top100'
SRC=DB/'top100-fragrantica-mapped.json'
OUT=DB/'top100-seasons.json'
SEASONS=['winter','spring','summer','fall']

# Canonical rule:
# Read the PUBLIC Fragrantica "WHEN TO WEAR" widget exactly as rendered to a
# logged-out visitor. Consider only winter/spring/summer/fall. The season with
# the highest displayed vote value wins. Day/night are ignored. No note-based
# inference and no legacy season heuristic is allowed.
#
# Hosted GitHub runners are served a reduced www.fragrantica.com DOM that omits
# the widget entirely. beta.fragrantica.com exposes the same public fragrance
# page anonymously and retains the When To Wear block, so use that public host
# for capture while preserving the canonical www URL in the database.

def public_capture_url(url):
    return re.sub(r'^https://www\.fragrantica\.com/', 'https://beta.fragrantica.com/', url)

def extract_when_to_wear(page):
    return page.evaluate(r"""() => {
      const seasons=['winter','spring','summer','fall'];
      const norm=s=>(s||'').replace(/\s+/g,' ').trim().toLowerCase().replace('autumn','fall');
      const visible=el=>!!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
      const parseNum=s=>{
        const m=String(s||'').replace(/,/g,'').match(/([0-9]+(?:\.[0-9]+)?)\s*([kKmM])?/);
        if(!m) return null;
        let n=parseFloat(m[1]);
        if(!Number.isFinite(n)) return null;
        if(m[2]) n*=m[2].toLowerCase()==='k'?1000:1000000;
        return n;
      };
      const all=[...document.querySelectorAll('body *')].filter(visible);
      const labels={};
      for(const season of seasons){
        labels[season]=all.find(el=>norm(el.textContent)===season && el.children.length<=2) || null;
      }
      if(seasons.some(s=>!labels[s])) return {values:{},displayed:{},error:'season-labels-not-found'};

      let container=labels.winter;
      while(container && !seasons.every(s=>container.contains(labels[s]))) container=container.parentElement;
      if(!container) return {values:{},displayed:{},error:'when-to-wear-container-not-found'};

      const result={values:{},displayed:{}};
      const candidateTexts=(label)=>{
        const out=[];
        let cur=label;
        for(let depth=0; depth<5 && cur; depth++,cur=cur.parentElement){
          const els=[cur,cur.previousElementSibling,cur.nextElementSibling,
            ...cur.querySelectorAll('[title],[aria-label],[data-value],[data-count],[data-votes],span,div')];
          for(const el of els){
            if(!el || !visible(el)) continue;
            for(const v of [el.getAttribute?.('data-votes'),el.getAttribute?.('data-count'),el.getAttribute?.('data-value'),el.getAttribute?.('aria-label'),el.getAttribute?.('title'),el.innerText,el.textContent]){
              const t=String(v||'').replace(/\s+/g,' ').trim();
              if(t && norm(t)!==norm(label.textContent)) out.push(t);
            }
          }
        }
        return [...new Set(out)];
      };
      for(const season of seasons){
        const texts=candidateTexts(labels[season]);
        for(const t of texts){
          const n=parseNum(t);
          if(n===null || t.length>80) continue;
          result.values[season]=n;
          result.displayed[season]=t;
          break;
        }
      }
      if(Object.keys(result.values).length!==4) result.error=`only-${Object.keys(result.values).length}-season-values`;
      return result;
    }""")

def main():
    payload=json.loads(SRC.read_text(encoding='utf-8'))
    rows=payload['records']
    if len(rows)!=100:
        raise SystemExit(f'Safety stop: mapped Top100 has {len(rows)} records, expected 100')

    results=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--disable-http2','--disable-blink-features=AutomationControlled'])
        context=browser.new_context(
            locale='en-US',viewport={'width':1440,'height':1600},
            user_agent='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
        )
        page=context.new_page(); page.set_default_timeout(20000)
        for rec in rows:
            rank=int(rec['rank']); canonical_url=rec['fragrantica_url']; capture_url=public_capture_url(canonical_url)
            extracted={}; err=''
            for attempt in range(1,3):
                try:
                    page.goto(capture_url,wait_until='domcontentloaded',timeout=45000)
                    page.wait_for_timeout(1200)
                    extracted=extract_when_to_wear(page)
                    vals=extracted.get('values') or {}
                    if len(vals)==4: break
                    err=extracted.get('error') or f'only-{len(vals)}-season-values'
                except Exception as e:
                    err=str(e)

            vals=extracted.get('values') or {}
            displayed=extracted.get('displayed') or {}
            dominant=None; status='unresolved'; tie=[]
            if len(vals)==4:
                best=max(vals.values())
                tie=[s for s in SEASONS if vals[s]==best]
                if len(tie)==1:
                    dominant=tie[0]; status='verified'; err=''
                else:
                    err='displayed-value-tie:'+','.join(tie)

            results.append({
                'rank':rank,'shobi_code':rec['shobi_code'],'fragrantica_id':rec['fragrantica_id'],
                'fragrantica_url':canonical_url,'capture_url':capture_url,
                'source':'Fragrantica public WHEN TO WEAR widget (logged-out)',
                'when_to_wear_displayed':displayed,'season_votes':vals,'season':dominant,
                'status':status,'error':err
            })
            print(f"#{rank} {rec['shobi_code']} {vals} => {dominant or 'UNRESOLVED'}"+(f" [{err}]" if err else ''))
        context.close(); browser.close()

    verified=sum(r['status']=='verified' for r in results)
    unresolved=len(results)-verified
    out={
        'schema_version':4,
        'method':'Fragrantica public WHEN TO WEAR displayed vote values; highest of winter/spring/summer/fall wins; day/night ignored',
        'count':len(results),'verified_count':verified,'unresolved_count':unresolved,'records':results
    }
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'SEASONS_VERIFIED={verified}/100 UNRESOLVED={unresolved}')
    if verified!=100:
        raise SystemExit(f'Safety stop: WHEN TO WEAR season coverage {verified}/100; unresolved={unresolved}')

if __name__=='__main__': main()
