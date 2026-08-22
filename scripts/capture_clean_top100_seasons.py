#!/usr/bin/env python3
import json,time,re
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

ROOT=Path(__file__).resolve().parents[1]
DB=ROOT/'Fragrantica ID Database'/'rebuild-top100'
SRC=DB/'top100-fragrantica-mapped.json'
OUT=DB/'top100-seasons.json'

SEASONS=['winter','spring','summer','fall']

def extract(page):
    return page.evaluate("""() => {
      const out={};
      for (const el of document.querySelectorAll('div[index]')) {
        const legend=el.querySelector('span.vote-button-legend');
        if(!legend) continue;
        let name=(legend.textContent||'').trim().toLowerCase();
        if(name==='autumn') name='fall';
        if(!['winter','spring','summer','fall'].includes(name)) continue;
        const chart=el.querySelector('div.voting-small-chart-size');
        if(!chart) continue;
        const divs=[...chart.querySelectorAll('div[style*="width:"]')];
        let pct=null;
        for (let i=1;i<divs.length;i++) {
          const m=(divs[i].getAttribute('style')||'').match(/width:\s*([0-9.]+)%/i);
          if(m){pct=parseFloat(m[1]);break;}
        }
        if(pct===null && divs[0]) {
          const m=(divs[0].getAttribute('style')||'').match(/width:\s*([0-9.]+)%/i);
          if(m && parseFloat(m[1])!==100) pct=parseFloat(m[1]);
        }
        if(pct!==null) out[name]=pct;
      }
      return out;
    }""")

def main():
    rows=json.loads(SRC.read_text(encoding='utf-8'))['records']; results=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--disable-http2','--disable-blink-features=AutomationControlled'])
        context=browser.new_context(locale='en-US',viewport={'width':1440,'height':1200},user_agent='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36')
        page=context.new_page(); page.set_default_timeout(30000)
        for rec in rows:
            rank=int(rec['rank']); url=rec['fragrantica_url']; vals={}; err=''
            for attempt in range(1,4):
                try:
                    page.goto(url,wait_until='domcontentloaded',timeout=60000)
                    page.wait_for_timeout(2500)
                    vals=extract(page)
                    if len(vals)==4: break
                    err=f'only-{len(vals)}-season-values'
                except Exception as e:
                    err=str(e)
                page.wait_for_timeout(1500*attempt)
            dominant=max(vals,key=vals.get) if vals else None
            results.append({'rank':rank,'shobi_code':rec['shobi_code'],'fragrantica_id':rec['fragrantica_id'],'fragrantica_url':url,'season_votes_percent':vals,'season':dominant,'status':'verified' if len(vals)==4 else 'unresolved','error':err})
            print(f"#{rank} {rec['shobi_code']} {vals} => {dominant or 'UNRESOLVED'}")
            page.wait_for_timeout(700)
        context.close();browser.close()
    payload={'schema_version':1,'method':'Fragrantica ID Mapping Rule / When To Wear seasonal vote bars','count':len(results),'verified_count':sum(r['status']=='verified' for r in results),'unresolved_count':sum(r['status']!='verified' for r in results),'records':results}
    OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f"SEASONS_VERIFIED={payload['verified_count']}/100 UNRESOLVED={payload['unresolved_count']}")

if __name__=='__main__': main()
