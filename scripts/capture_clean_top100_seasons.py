#!/usr/bin/env python3
import json,time,re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
DB=ROOT/'Fragrantica ID Database'/'rebuild-top100'
SRC=DB/'top100-fragrantica-mapped.json'
OUT=DB/'top100-seasons.json'
SEASONS=['winter','spring','summer','fall']

def extract(page):
    return page.evaluate("""() => {
      const wanted=['winter','spring','summer','fall'];
      const out={};
      const norm=s=>(s||'').trim().toLowerCase().replace('autumn','fall');
      const pctFrom = el => {
        if(!el) return null;
        const attrs=['aria-valuenow','data-value','data-percent','value'];
        for(const a of attrs){
          const v=el.getAttribute?.(a); if(v!=null){const n=parseFloat(v); if(Number.isFinite(n)) return n;}
        }
        const style=el.getAttribute?.('style')||'';
        const m=style.match(/width\s*:\s*([0-9.]+)%/i); if(m) return parseFloat(m[1]);
        const txt=(el.textContent||'').trim();
        const t=txt.match(/([0-9]+(?:\.[0-9]+)?)\s*%/); if(t) return parseFloat(t[1]);
        return null;
      };
      const nodes=[...document.querySelectorAll('body *')];
      for(const season of wanted){
        const label=nodes.find(el=>norm(el.textContent)===season && el.children.length<4);
        if(!label) continue;
        let cur=label;
        for(let depth=0; depth<7 && cur; depth++,cur=cur.parentElement){
          const candidates=[cur,...cur.querySelectorAll('[style*="width"],[aria-valuenow],[data-value],[data-percent],progress')];
          const vals=[];
          for(const c of candidates){ const p=pctFrom(c); if(p!=null && p>=0 && p<=100) vals.push(p); }
          const meaningful=vals.filter(v=>v!==100);
          if(meaningful.length){ out[season]=meaningful[0]; break; }
        }
      }
      return out;
    }""")

def main():
    rows=json.loads(SRC.read_text(encoding='utf-8'))['records']; results=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--disable-http2','--disable-blink-features=AutomationControlled'])
        context=browser.new_context(locale='en-US',viewport={'width':1440,'height':1600},user_agent='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36')
        page=context.new_page(); page.set_default_timeout(30000)
        for rec in rows:
            rank=int(rec['rank']); url=rec['fragrantica_url']; vals={}; err=''
            for attempt in range(1,4):
                try:
                    page.goto(url,wait_until='domcontentloaded',timeout=60000)
                    page.wait_for_timeout(3000)
                    vals=extract(page)
                    if len(vals)==4: break
                    err=f'only-{len(vals)}-season-values'
                except Exception as e: err=str(e)
                page.wait_for_timeout(1200*attempt)
            dominant=max(vals,key=vals.get) if len(vals)==4 else None
            results.append({'rank':rank,'shobi_code':rec['shobi_code'],'fragrantica_id':rec['fragrantica_id'],'fragrantica_url':url,'season_votes_percent':vals,'season':dominant,'status':'verified' if len(vals)==4 else 'unresolved','error':err})
            print(f"#{rank} {rec['shobi_code']} {vals} => {dominant or 'UNRESOLVED'}")
            page.wait_for_timeout(500)
        context.close();browser.close()
    payload={'schema_version':2,'method':'Fragrantica ID Mapping Rule / When To Wear seasonal vote bars','count':len(results),'verified_count':sum(r['status']=='verified' for r in results),'unresolved_count':sum(r['status']!='verified' for r in results),'records':results}
    OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f"SEASONS_VERIFIED={payload['verified_count']}/100 UNRESOLVED={payload['unresolved_count']}")

if __name__=='__main__': main()
