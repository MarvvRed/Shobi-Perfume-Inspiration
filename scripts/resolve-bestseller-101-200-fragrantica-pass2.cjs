const fs=require('fs');
const { chromium }=require('playwright');
const src='Personal Database/bestseller-101-200-fragrantica-resolved.json';
const data=JSON.parse(fs.readFileSync(src,'utf8'));
const items=Array.isArray(data.unresolved)?data.unresolved:[];

function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/add to cart/gi,' ').replace(/^of\s+/i,'').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();}
function tokens(s){return norm(s).split(/\s+/).filter(x=>x.length>2 && !['the','and','for','eau','parfum','perfume','toilette','intense'].includes(x));}
function score(item,title,url){
  const a=new Set(tokens(item.inspired_by));
  const b=new Set(tokens(title+' '+url));
  let hit=0; for(const t of a) if(b.has(t)) hit++;
  return a.size?hit/a.size:0;
}
async function search(ctx,q,item){
  const page=await ctx.newPage();
  try{
    await page.goto('https://www.bing.com/search?q='+encodeURIComponent(q),{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForTimeout(1400);
    const links=await page.$$eval('a',as=>as.map(a=>({href:a.href||'',text:(a.innerText||a.textContent||'').trim()})).filter(x=>/fragrantica\.com\/perfume\//i.test(x.href)));
    let best=null;
    for(const l of links){
      const m=l.href.match(/-(\d+)\.html(?:[?#]|$)/);
      if(!m) continue;
      const ratio=score(item,l.text,l.href);
      if(!best||ratio>best.ratio) best={...l,id:Number(m[1]),ratio};
    }
    return best;
  } finally { await page.close().catch(()=>{}); }
}

(async()=>{
  const browser=await chromium.connectOverCDP(process.env.SHOBI_CDP_URL||'http://127.0.0.1:9222');
  const ctx=browser.contexts()[0]||await browser.newContext();
  const resolved=[], unresolved=[];
  for(const item of items){
    const name=norm(item.inspired_by);
    const brand=norm(item.brand);
    const queries=[
      `site:fragrantica.com/perfume \"${name}\" ${brand}`,
      `site:fragrantica.com/perfume ${name} ${brand}`,
      `site:fragrantica.com/perfume \"${name}\"`,
      `${name} ${brand} Fragrantica`
    ];
    let best=null;
    for(const q of queries){
      try{
        const cand=await search(ctx,q,item);
        if(cand && (!best || cand.ratio>best.ratio)) best=cand;
        if(best && best.ratio>=0.8) break;
      }catch(e){ console.log(`QUERY_ERROR #${item.rank} ${q} ${e.message}`); }
    }
    if(best && best.ratio>=0.5){
      resolved.push({...item,fragrantica_id:best.id,fragrantica_url:best.href,match_score:Number(best.ratio.toFixed(3)),resolver:'bing-self-hosted-pass2'});
      console.log(`RESOLVED #${item.rank} ${item.code} id=${best.id} score=${best.ratio.toFixed(2)}`);
    } else {
      unresolved.push({...item,candidate:best||null});
      console.log(`UNRESOLVED #${item.rank} ${item.code}`);
    }
  }
  const out={resolved_count:resolved.length,unresolved_count:unresolved.length,resolved,unresolved};
  fs.writeFileSync('Personal Database/bestseller-101-200-fragrantica-pass2.json',JSON.stringify(out,null,2)+'\n');
  console.log('PASS2_RESOLVED_COUNT',resolved.length);
  console.log('PASS2_UNRESOLVED_COUNT',unresolved.length);
  await browser.close();
})();
