const http = require('http');
const https = require('https');

const TOKEN = process.env.GH_TOKEN;
const OWNER = 'MarvvRed';
const REPO = 'Shobi-Perfume-Inspiration';
const BRANCH = 'main';
const DATABASE_PATH = 'Personal Database/fragrantica-main-notes.json';
const TARGETS_PATH = 'tools/fragrantica-main-notes/targets.json';
const RANKING_PATH = 'bestseller-ranking.js';
const RUNTIME_PATH = 'Personal Database/site-runtime-v2.json';
const ENRICHMENT_PATH = 'Personal Database/site-enrichment-v2.json';

if (!TOKEN) { console.error('GH_TOKEN missing'); process.exit(2); }

function gh(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'api.github.com', path, method, headers: {
      'User-Agent': 'shobi-local-bridge', 'Authorization': `Bearer ${TOKEN}`,
      'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    }}, res => {
      let data=''; res.on('data',c=>data+=c); res.on('end',()=>{
        if(res.statusCode>=200&&res.statusCode<300) resolve(data?JSON.parse(data):{});
        else reject(new Error(`GitHub ${res.statusCode}: ${data}`));
      });
    });
    req.on('error',reject); if(body) req.write(JSON.stringify(body)); req.end();
  });
}
function apiPath(filePath){ return `/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(filePath).replace(/%2F/g,'/')}`; }
async function getGithubText(filePath){ const x=await gh('GET',`${apiPath(filePath)}?ref=${BRANCH}`); return {text:Buffer.from(x.content.replace(/\n/g,''),'base64').toString('utf8'),sha:x.sha}; }
async function getGithubJson(filePath){ const x=await getGithubText(filePath); return {json:JSON.parse(x.text),sha:x.sha}; }
async function putGithubJson(filePath,value,message,sha){ await gh('PUT',apiPath(filePath),{message,content:Buffer.from(JSON.stringify(value,null,2)+'\n').toString('base64'),branch:BRANCH,...(sha?{sha}:{})}); }
function codeKey(v){ return String(v||'').toUpperCase().replace(/\s+/g,''); }
function baseCode(v){ const m=String(v||'').match(/^\s*(\d+)/); return m?m[1]:''; }
function slugFromUrl(url){ try{const u=new URL(url);const last=u.pathname.split('/').filter(Boolean).pop()||'capture';return last.replace(/\.html$/i,'').replace(/[^a-z0-9._-]+/gi,'-').toLowerCase();}catch{return `capture-${Date.now()}`;} }
function fragranticaIdFromUrl(url){ const m=String(url||'').match(/-(\d+)\.html(?:[?#]|$)/i); return m?Number(m[1]):null; }

async function buildDynamicTargets(){
  const override=(await getGithubJson(TARGETS_PATH)).json;
  if(Array.isArray(override.targets)&&override.targets.length) return {batch:override.batch||'manual-override',auto_start:override.auto_start!==false,targets:override.targets,missing:[]};

  const [{text:rankingText},{json:runtime},{json:enrichment}] = await Promise.all([
    getGithubText(RANKING_PATH), getGithubJson(RUNTIME_PATH), getGithubJson(ENRICHMENT_PATH)
  ]);
  const m=rankingText.match(/window\.SHOBI_BESTSELLER_RANKING\s*=\s*(\[[\s\S]*?\]);/);
  if(!m) throw new Error('Cannot parse bestseller-ranking.js');
  const ranking=JSON.parse(m[1]).filter(x=>Number(x.rank)>=21&&Number(x.rank)<=40);
  const products=runtime.p||[];
  const byExact=new Map(products.map(p=>[codeKey(p[0]),p]));
  const byBase=new Map();
  for(const p of products){const b=baseCode(p[0]);if(!b)continue;if(!byBase.has(b))byBase.set(b,[]);byBase.get(b).push(p);}
  const e=enrichment.e||{};
  const enrichExact=new Map(Object.entries(e).map(([k,v])=>[codeKey(k),v]));
  const enrichBase=new Map();
  for(const [k,v] of Object.entries(e)){const b=baseCode(k);if(!b)continue;if(!enrichBase.has(b))enrichBase.set(b,[]);enrichBase.get(b).push(v);}
  const targets=[],missing=[];
  for(const r of ranking){
    const exact=codeKey(r.code), b=baseCode(r.code);
    const p=byExact.get(exact) || ((byBase.get(b)||[]).length===1?(byBase.get(b)||[])[0]:null);
    const row=enrichExact.get(exact) || ((enrichBase.get(b)||[]).length===1?(enrichBase.get(b)||[])[0]:null);
    const url=Array.isArray(row)?String(row[4]||''):'';
    if(!p || !/^https:\/\/www\.fragrantica\.com\/perfume\//.test(url)){ missing.push({rank:r.rank,code:r.code,name:p?.[1]||null,reason:!p?'runtime-missing':'fragrantica-url-missing'}); continue; }
    targets.push({rank:Number(r.rank),code:r.code,name:p[1],brand:p[2],url});
  }
  return {batch:'bestsellers-21-40-auto',auto_start:true,targets,missing};
}

async function upsertDatabase(data,normalized){
  const id=fragranticaIdFromUrl(normalized.url); if(!id) throw new Error(`Cannot extract Fragrantica ID from ${normalized.url}`);
  const {json:db,sha}=await getGithubJson(DATABASE_PATH); db.schema_version=1; db.source='official-catcher-automated'; db.perfumes=db.perfumes||{};
  const notes=normalized.notes.map((n,i)=>({rank:n.rank||i+1,note:n.note,sastojak_id:n.sastojak_id??null,votes:n.votes??null}));
  db.perfumes[String(id)]={fragrantica_id:id,name:data.target?.name||normalized.perfume||null,brand:data.target?.brand||null,url:normalized.url,capture_method:normalized.capture_method||null,total_voted_notes:normalized.total_voted_notes??null,saved_note_count:notes.length,notes};
  db.perfume_count=Object.keys(db.perfumes).length; db.updated_at=new Date().toISOString();
  await putGithubJson(DATABASE_PATH,db,`Update main-notes database: ${data.target?.name||normalized.perfume||id}`,sha);
  console.log(`DATABASE_UPDATED ${DATABASE_PATH} ${id}`);
}
async function saveCapture(data){
  const payload=data?.payload; if(!payload?.url||!Array.isArray(payload.notes)||!payload.notes.length) throw new Error('Invalid capture payload');
  if(!payload.url.startsWith('https://www.fragrantica.com/perfume/')) throw new Error('Unexpected source URL');
  const slug=slugFromUrl(payload.url), filePath=`tools/fragrantica-main-notes/results/live/${slug}.json`; let sha;
  try{sha=(await gh('GET',`${apiPath(filePath)}?ref=${BRANCH}`)).sha;}catch(e){if(!String(e.message).includes('GitHub 404'))throw e;}
  const normalized={source:data.source||'firefox-extension',batch:data.batch||null,target:data.target||null,...payload,received_at:new Date().toISOString()};
  await gh('PUT',apiPath(filePath),{message:`Capture Fragrantica Main Notes: ${payload.perfume||slug}`,content:Buffer.from(JSON.stringify(normalized,null,2)+'\n').toString('base64'),branch:BRANCH,...(sha?{sha}:{})});
  await upsertDatabase(data,normalized); return {filePath,databasePath:DATABASE_PATH};
}

const server=http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  if(req.method==='GET'&&req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({ok:true,database:DATABASE_PATH}));}
  if(req.method==='GET'&&req.url==='/targets'){
    try{const q=await buildDynamicTargets();res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({ok:true,...q}));}
    catch(e){res.writeHead(500,{'Content-Type':'application/json'});return res.end(JSON.stringify({ok:false,error:e.message}));}
  }
  if(req.method==='POST'&&req.url==='/capture'){
    let raw='';req.on('data',c=>{raw+=c;if(raw.length>2_000_000)req.destroy();});req.on('end',async()=>{try{const saved=await saveCapture(JSON.parse(raw));res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,file:saved.filePath,database:saved.databasePath}));}catch(e){console.error('CAPTURE_ERROR',e.message);res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,error:e.message}));}});return;
  }
  res.writeHead(404);res.end();
});
server.listen(8765,'127.0.0.1',()=>console.log('SHOBI_LOCAL_BRIDGE_READY http://127.0.0.1:8765'));
setTimeout(()=>{console.log('SHOBI_LOCAL_BRIDGE_TIMEOUT');server.close(()=>process.exit(0));},30*60*1000);
