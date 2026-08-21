#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const {chromium}=require('playwright');

const ROOT=process.cwd();
const CDP_URL=process.env.SHOBI_CDP_URL||'http://127.0.0.1:9222';
const OUT=process.env.SHOBI_CATCHER_OUT||path.join(ROOT,'tools','fragrantica-main-notes','results','playwright-41-100');
const TOP100='Shobi Master Database/bestseller-top100-enrichment.csv';
const LOCKS=['Shobi Master Database/bestseller-top100-source-lock.csv','Shobi Master Database/bestseller-top100-source-lock-pass2.csv'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const key=s=>String(s||'').replace(/\s+/g,'').toUpperCase();
const slug=s=>String(s||'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase();
const isFrag=s=>/^https:\/\/(?:www\.)?fragrantica\.(?:com|it)\//i.test(String(s||''));

function read(p){return fs.readFileSync(path.join(ROOT,p),'utf8');}
function parseTargets(){
  const out=[];
  for(const line of read(TOP100).split(/\r?\n/)){
    const m=line.match(/^(\d+),([^,]+),/);
    if(!m) continue;
    const rank=Number(m[1]);
    if(rank<41||rank>100) continue;
    out.push({rank,code:m[2].trim()});
  }
  out.sort((a,b)=>a.rank-b.rank);
  const ranks=new Set(out.map(x=>x.rank));
  const missing=[]; for(let r=41;r<=100;r++) if(!ranks.has(r)) missing.push(r);
  if(out.length!==60||missing.length) throw new Error(`TOP100_SOURCE_INVALID count=${out.length} missing=${missing.join(',')}`);
  return out;
}
function resolveUrl(code){
  const k=key(code);
  for(const rel of LOCKS){
    for(const line of read(rel).split(/\r?\n/)){
      if(!key(line).includes(k)) continue;
      const m=line.match(/https:\/\/(?:www\.)?fragrantica\.(?:com|it)\/[^,\"\s]+/i);
      if(m) return {url:m[0],source:rel};
    }
  }
  return {url:'',source:''};
}
async function findVoteControl(page){
  const all=page.locator('button,a,[role="button"],span,div');
  const count=await all.count();
  for(let i=0;i<count;i++){
    const el=all.nth(i);
    const txt=clean(await el.innerText().catch(()=>''));
    const aria=clean(await el.getAttribute('aria-label').catch(()=>''));
    const title=clean(await el.getAttribute('title').catch(()=>''));
    if(/^(show|hide)\s+votes$/i.test(txt)||/(show|hide)\s+votes/i.test(aria)||/(show|hide)\s+votes/i.test(title)) return el;
  }
  return null;
}
async function collect(page){
  let control=null;
  const deadline=Date.now()+30000;
  while(Date.now()<deadline&&!control){control=await findVoteControl(page); if(!control) await sleep(1000);}
  if(!control) throw new Error('SHOW_VOTES_NOT_FOUND');
  const label=clean(await control.innerText().catch(()=>''));
  if(!/^Hide\s+votes$/i.test(label)){
    await control.scrollIntoViewIfNeeded().catch(()=>{});
    await control.click({timeout:10000});
    await sleep(1200);
  }
  for(let attempt=0;attempt<10;attempt++){
    const notes=await page.evaluate(()=>{
      const c=s=>String(s||'').replace(/\s+/g,' ').trim();
      const idOf=href=>{const m=String(href||'').match(/\/notes\/[^/]*?(\d+)(?:\.html)?(?:[?#]|$)/i)||String(href||'').match(/id=(\d+)/i);return m?Number(m[1]):null;};
      const best=new Map();
      for(const a of document.querySelectorAll('a[href*="/notes/"]')){
        const raw=c(a.textContent)||c(a.querySelector('img[alt]')?.alt)||c(a.getAttribute('title'));
        const m=raw.match(/^\s*([0-9][0-9.,\s]*)\s*([^0-9].*?)\s*$/); if(!m) continue;
        const votes=Number(m[1].replace(/[^0-9]/g,'')), note=c(m[2]);
        if(!Number.isFinite(votes)||votes<=0||!note||note.length>80) continue;
        const id=idOf(a.getAttribute('href')), k=id!=null?`id:${id}`:`name:${note.toLowerCase()}`;
        const prev=best.get(k); if(!prev||votes>prev.votes) best.set(k,{note,sastojak_id:id,votes});
      }
      return [...best.values()].sort((a,b)=>b.votes-a.votes||a.note.localeCompare(b.note));
    });
    if(notes.length) return notes;
    await sleep(750);
  }
  throw new Error('VOTED_NOTES_NOT_PARSED');
}
async function capture(page,t){
  console.log(`\n=== #${t.rank} ${t.code} ===`);
  console.log(`URL ${t.url}`);
  await page.goto(t.url,{waitUntil:'domcontentloaded',timeout:60000});
  await sleep(1800);
  const ranked=await collect(page);
  const top5=ranked.slice(0,5).map((n,i)=>({rank:i+1,...n}));
  const idm=page.url().match(/-(\d+)\.html(?:[?#]|$)/i);
  const payload={schema_version:1,source:'playwright-cdp-real-edge',captured_at:new Date().toISOString(),rank:t.rank,shobi_code:t.code,fragrantica_id:idm?Number(idm[1]):null,url:page.url(),url_source:t.url_source,total_voted_notes:ranked.length,saved_note_count:top5.length,notes:top5};
  fs.writeFileSync(path.join(OUT,`${String(t.rank).padStart(3,'0')}-${slug(t.code)}.json`),JSON.stringify(payload,null,2)+'\n');
  for(const n of top5) console.log(`#${n.rank} ${n.note} votes=${n.votes} sastojak_id=${n.sastojak_id??''}`);
  return payload;
}
async function main(){
  fs.rmSync(OUT,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true});
  const targets=parseTargets().map(x=>{const r=resolveUrl(x.code);return {...x,url:r.url,url_source:r.source};});
  fs.writeFileSync(path.join(OUT,'canonical-targets-41-100.json'),JSON.stringify(targets,null,2)+'\n');
  const missing=targets.filter(x=>!isFrag(x.url));
  fs.writeFileSync(path.join(OUT,'missing-fragrantica-urls.json'),JSON.stringify(missing,null,2)+'\n');
  console.log(`TARGETS ${targets.length}`);
  for(const t of targets) console.log(`RESOLVE #${t.rank} ${t.code}: ${t.url||'MISSING'}`);
  if(missing.length) throw new Error(`FRAGRANTICA_URLS_MISSING_${missing.length}`);

  const browser=await chromium.connectOverCDP(CDP_URL,{timeout:15000});
  const context=browser.contexts()[0]; if(!context) throw new Error('CDP_NO_BROWSER_CONTEXT');
  const pages=context.pages(); const page=pages.find(p=>/fragrantica\.(com|it)/i.test(p.url()))||pages[0]||await context.newPage();
  const results=[],failures=[];
  for(const t of targets){
    let ok=false;
    for(let attempt=1;attempt<=2&&!ok;attempt++){
      try{results.push(await capture(page,t));ok=true;}
      catch(e){console.error(`ATTEMPT_FAIL #${t.rank} attempt=${attempt} ${e.message}`);if(attempt<2)await sleep(5000);else failures.push({rank:t.rank,code:t.code,url:t.url,error:e.message});}
    }
    await sleep(2500);
  }
  const summary={schema_version:1,captured_at:new Date().toISOString(),range:[41,100],success_count:results.length,failure_count:failures.length,results,failures};
  fs.writeFileSync(path.join(OUT,'batch-41-100.json'),JSON.stringify(summary,null,2)+'\n');
  console.log(`BATCH_SUMMARY success=${results.length} failures=${failures.length}`);
  await browser.close().catch(()=>{});
  if(failures.length) process.exit(2);
}
main().catch(e=>{console.error('BATCH_FATAL',e?.stack||e);process.exit(1);});
