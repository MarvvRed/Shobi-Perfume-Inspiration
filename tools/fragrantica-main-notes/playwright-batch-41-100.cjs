#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const {chromium}=require('playwright');

const ROOT=process.cwd();
const CDP_URL=process.env.SHOBI_CDP_URL||'http://127.0.0.1:9222';
const OUT_DIR=process.env.SHOBI_CATCHER_OUT||path.join(ROOT,'tools','fragrantica-main-notes','results','playwright-41-100');
const readJson=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const RUNTIME=readJson('Personal Database/site-runtime-v2.json');
const ENRICHMENT=readJson('Personal Database/site-enrichment-v2.json');
const runtimeByCode=new Map((RUNTIME.p||[]).filter(Array.isArray).map(r=>[keyOf(r[0]),r]));
const SOURCE_LOCK_FILES=['Shobi Master Database/bestseller-top100-source-lock.csv','Shobi Master Database/bestseller-top100-source-lock-pass2.csv'];
const TOP100_FILE='Shobi Master Database/bestseller-top100-enrichment.csv';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
function keyOf(code){return String(code||'').replace(/\s+/g,'').toUpperCase();}
const slug=code=>String(code).replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase();
const isFragUrl=s=>/^https:\/\/(?:www\.)?fragrantica\.(?:com|it)\//i.test(String(s||''));

function parseCsvLine(line){
  const out=[];let cur='';let q=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){
      if(q&&line[i+1]==='"'){cur+='"';i++;}
      else q=!q;
    }else if(c===','&&!q){out.push(cur);cur='';}
    else cur+=c;
  }
  out.push(cur);return out;
}

function fixedTargets(){
  const text=fs.readFileSync(path.join(ROOT,TOP100_FILE),'utf8').replace(/^\uFEFF/,'');
  const rows=text.split(/\r?\n/).filter(Boolean).slice(1).map(parseCsvLine);
  const wanted=rows.filter(r=>Number(r[0])>=41&&Number(r[0])<=100);
  if(wanted.length!==60)throw new Error(`STATIC_TARGET_COUNT_${wanted.length}`);
  const ranks=new Set(wanted.map(r=>Number(r[0])));
  const missing=[];for(let r=41;r<=100;r++)if(!ranks.has(r))missing.push(r);
  if(missing.length)throw new Error(`STATIC_RANKS_MISSING_${missing.join('_')}`);
  return wanted.map(r=>{
    const rank=Number(r[0]),code=clean(r[1]),name=clean(r[2]);
    const runtime=runtimeByCode.get(keyOf(code));
    const resolved=resolveUrl(code);
    return {rank,code,name:name||runtime?.[1]||code,brand:runtime?.[2]||'',url:resolved.url,url_source:resolved.source};
  }).sort((a,b)=>a.rank-b.rank);
}

function resolveFromTextFile(rel,code){
  try{
    const text=fs.readFileSync(path.join(ROOT,rel),'utf8');
    const k=keyOf(code);
    for(const line of text.split(/\r?\n/)){
      if(!keyOf(line).includes(k))continue;
      const m=line.match(/https:\/\/(?:www\.)?fragrantica\.(?:com|it)\/[^,\"\s]+/i);
      if(m)return m[0];
    }
  }catch{}
  return '';
}

function findFragUrlDeep(node,targetKey,depth=0){
  if(depth>12||node==null)return'';
  if(typeof node==='string')return isFragUrl(node)?node:'';
  if(Array.isArray(node)){
    if(node.some(v=>typeof v==='string'&&keyOf(v)===targetKey)){
      for(const v of node){const u=findFragUrlDeep(v,targetKey,depth+1);if(u)return u;}
    }
    for(const v of node){if(v&&typeof v==='object'){const u=findFragUrlDeep(v,targetKey,depth+1);if(u)return u;}}
    return'';
  }
  if(typeof node==='object'){
    for(const[k,v]of Object.entries(node))if(keyOf(k)===targetKey){const u=findFragUrlDeep(v,targetKey,depth+1);if(u)return u;}
  }
  return'';
}

function resolveUrl(code){
  const k=keyOf(code);
  const direct=ENRICHMENT.e?.[k];
  if(Array.isArray(direct)){const u=direct.find(isFragUrl);if(u)return{url:u,source:'site-enrichment-v2.direct'};}
  const deep=findFragUrlDeep(ENRICHMENT,k);if(deep)return{url:deep,source:'site-enrichment-v2.deep'};
  for(const rel of SOURCE_LOCK_FILES){const u=resolveFromTextFile(rel,code);if(u)return{url:u,source:rel};}
  const u=resolveFromTextFile('Shobi Master Database/shobi-master-current.csv',code);if(u)return{url:u,source:'master-current'};
  return{url:'',source:''};
}

async function findVoteControl(page){
  const all=page.locator('button,a,[role="button"],span,div');
  const count=await all.count();
  for(let i=0;i<count;i++){
    const el=all.nth(i);
    const txt=clean(await el.innerText().catch(()=>''));
    const aria=clean(await el.getAttribute('aria-label').catch(()=>''));
    const title=clean(await el.getAttribute('title').catch(()=>''));
    if(/^(show|hide)\s+votes$/i.test(txt)||/(show|hide)\s+votes/i.test(aria)||/(show|hide)\s+votes/i.test(title))return el;
  }
  return null;
}

async function waitForVoteControl(page,timeoutMs=30000){
  const end=Date.now()+timeoutMs;
  while(Date.now()<end){const c=await findVoteControl(page);if(c)return c;await sleep(1000);}
  return null;
}

async function collect(page){
  const control=await waitForVoteControl(page,30000);
  if(!control)throw new Error('SHOW_VOTES_NOT_FOUND');
  const label=clean(await control.innerText().catch(()=>''));
  if(!/^Hide\s+votes$/i.test(label)){
    await control.scrollIntoViewIfNeeded().catch(()=>{});
    await control.click({timeout:10000});
    await sleep(1200);
  }
  for(let attempt=1;attempt<=10;attempt++){
    const notes=await page.evaluate(()=>{
      const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
      const noteId=href=>{const m=String(href||'').match(/\/notes\/[^/]*?(\d+)(?:\.html)?(?:[?#]|$)/i)||String(href||'').match(/id=(\d+)/i);return m?Number(m[1]):null;};
      const best=new Map();
      for(const a of document.querySelectorAll('a[href*="/notes/"]')){
        const raw=clean(a.textContent)||clean(a.querySelector('img[alt]')?.alt)||clean(a.getAttribute('title'));
        if(!raw)continue;
        const m=raw.match(/^\s*([0-9][0-9.,\s]*)\s*([^0-9].*?)\s*$/);if(!m)continue;
        const votes=Number(m[1].replace(/[^0-9]/g,''));const note=clean(m[2]);
        if(!Number.isFinite(votes)||votes<=0||!note||note.length>80)continue;
        const id=noteId(a.getAttribute('href'));const key=id!=null?`id:${id}`:`name:${note.toLowerCase()}`;
        const prev=best.get(key);if(!prev||votes>prev.votes)best.set(key,{note,sastojak_id:id,votes});
      }
      return[...best.values()].sort((a,b)=>b.votes-a.votes||a.note.localeCompare(b.note));
    });
    if(notes.length)return notes;
    await sleep(750);
  }
  throw new Error('VOTED_NOTES_NOT_PARSED');
}

async function capture(page,target){
  console.log(`\n=== #${target.rank} ${target.code} ${target.name} ===`);
  console.log(`URL ${target.url}`);console.log(`URL_SOURCE ${target.url_source}`);
  await page.goto(target.url,{waitUntil:'domcontentloaded',timeout:60000});await sleep(1800);
  const ranked=await collect(page);const top5=ranked.slice(0,5).map((n,i)=>({rank:i+1,...n}));
  const idMatch=target.url.match(/-(\d+)\.html(?:[?#]|$)/i);
  const payload={schema_version:1,source:'playwright-cdp-real-edge',capture_method:ranked.length<=5?'all-voted-notes-five-or-fewer':'show-votes-top5',captured_at:new Date().toISOString(),rank:target.rank,shobi_code:target.code,fragrantica_id:idMatch?Number(idMatch[1]):null,name:target.name,brand:target.brand,url:target.url,url_source:target.url_source,total_voted_notes:ranked.length,saved_note_count:top5.length,notes:top5};
  fs.writeFileSync(path.join(OUT_DIR,`${String(target.rank).padStart(3,'0')}-${slug(target.code)}.json`),JSON.stringify(payload,null,2)+'\n');
  for(const n of top5)console.log(`#${n.rank} ${n.note} votes=${n.votes} sastojak_id=${n.sastojak_id??''}`);
  return payload;
}

async function main(){
  fs.rmSync(OUT_DIR,{recursive:true,force:true});fs.mkdirSync(OUT_DIR,{recursive:true});
  const targets=fixedTargets();
  fs.writeFileSync(path.join(OUT_DIR,'canonical-targets-41-100.json'),JSON.stringify(targets,null,2)+'\n');
  console.log(`TARGETS ${targets.length}: ${targets.map(x=>`#${x.rank} ${x.code}`).join(' | ')}`);
  for(const t of targets)console.log(`RESOLVE #${t.rank} ${t.code}: ${t.url||'MISSING'} ${t.url_source||''}`);
  const missing=targets.filter(t=>!isFragUrl(t.url));
  fs.writeFileSync(path.join(OUT_DIR,'missing-fragrantica-urls.json'),JSON.stringify(missing,null,2)+'\n');
  if(missing.length){for(const t of missing)console.error(`MISSING_URL #${t.rank} ${t.code} ${t.name}`);throw new Error(`FRAGRANTICA_URLS_MISSING_${missing.length}`);}

  const browser=await chromium.connectOverCDP(CDP_URL,{timeout:15000});
  const context=browser.contexts()[0];if(!context)throw new Error('CDP_NO_BROWSER_CONTEXT');
  const pages=context.pages();const page=pages.find(p=>/fragrantica\.(com|it)/i.test(p.url()))||pages[0]||await context.newPage();
  const results=[],failures=[];
  for(const target of targets){
    let ok=false;
    for(let attempt=1;attempt<=2&&!ok;attempt++){
      try{results.push(await capture(page,target));ok=true;}
      catch(err){console.error(`ATTEMPT_FAIL #${target.rank} attempt=${attempt} ${err.message}`);if(attempt<2)await sleep(5000);else failures.push({rank:target.rank,code:target.code,name:target.name,url:target.url,error:err.message});}
    }
    await sleep(2500);
  }
  const summary={schema_version:1,captured_at:new Date().toISOString(),range:[41,100],success_count:results.length,failure_count:failures.length,results,failures};
  fs.writeFileSync(path.join(OUT_DIR,'batch-41-100.json'),JSON.stringify(summary,null,2)+'\n');
  console.log(`\nBATCH_SUMMARY success=${results.length} failures=${failures.length}`);
  for(const f of failures)console.error(`FAILED #${f.rank} ${f.code}: ${f.error}`);
  await browser.close().catch(()=>{});if(failures.length)process.exit(2);
}
main().catch(err=>{console.error('BATCH_FATAL',err&&err.stack?err.stack:err);process.exit(1);});
