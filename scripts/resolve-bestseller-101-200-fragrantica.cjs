const fs=require('fs');
const { chromium }=require('playwright');
const path='Personal Database/bestseller-101-200-fragrantica-map.json';
const data=JSON.parse(fs.readFileSync(path,'utf8'));
const items=[...(data.missing_fragrantica||[])];
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function tokens(s){return norm(s).split(/\s+/).filter(x=>x.length>2 && !['the','and','for','eau','parfum','perfume','add','cart'].includes(x));}
function score(item,title,url){const a=new Set(tokens(item.inspired_by)); const b=new Set(tokens(title+' '+url)); let hit=0; for(const t of a) if(b.has(t)) hit++; const brand=tokens(item.brand); const brandHit=brand.length?brand.some(t=>b.has(t)):true; return {ratio:a.size?hit/a.size:0,brandHit};}
(async()=>{
 const browser=await chromium.connectOverCDP(process.env.SHOBI_CDP_URL||'http://127.0.0.1:9222');
 const contexts=browser.contexts(); const ctx=contexts[0]||await browser.newContext(); const page=ctx.pages()[0]||await ctx.newPage();
 const resolved=[]; const unresolved=[];
 for(const item of items){
  const q=`site:fragrantica.com/perfume ${item.inspired_by||''} ${item.brand||''}`.trim();
  try{
   await page.goto('https://www.bing.com/search?q='+encodeURIComponent(q),{waitUntil:'domcontentloaded',timeout:30000});
   await page.waitForTimeout(900);
   const links=await page.$$eval('a',as=>as.map(a=>({href:a.href||'',text:(a.innerText||a.textContent||'').trim()})).filter(x=>/fragrantica\.com\/perfume\//i.test(x.href)));
   let best=null;
   for(const l of links){const m=l.href.match(/-(\d+)\.html(?:[?#]|$)/); if(!m) continue; const s=score(item,l.text,l.href); if(!best||s.ratio>best.ratio) best={...l,id:Number(m[1]),...s};}
   if(best && best.ratio>=0.5 && best.brandHit){resolved.push({...item,fragrantica_id:best.id,fragrantica_url:best.href,match_score:Number(best.ratio.toFixed(3)),resolver:'bing-self-hosted'}); console.log(`RESOLVED #${item.rank} ${item.code} id=${best.id} score=${best.ratio.toFixed(2)}`);}
   else {unresolved.push({...item,candidate:best||null}); console.log(`UNRESOLVED #${item.rank} ${item.code}`);}
  }catch(e){unresolved.push({...item,error:String(e.message||e)}); console.log(`ERROR #${item.rank} ${item.code} ${e.message}`);}
 }
 const out={count:100,resolved_count:resolved.length,unresolved_count:unresolved.length,resolved,unresolved,missing_master:data.missing_master||[]};
 fs.writeFileSync('Personal Database/bestseller-101-200-fragrantica-resolved.json',JSON.stringify(out,null,2)+'\n');
 console.log('RESOLVED_COUNT',resolved.length); console.log('UNRESOLVED_COUNT',unresolved.length); console.log('MISSING_MASTER',(data.missing_master||[]).length);
 await browser.close();
})();
