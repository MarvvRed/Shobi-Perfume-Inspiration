import fs from 'node:fs';
import path from 'node:path';

const sources = [
  'Shobi Master Database/bestseller-top100-source-lock.csv',
  'Shobi Master Database/bestseller-top100-source-lock-pass2.csv',
];

function parseCsv(text) {
  const rows=[]; let row=[], field='', q=false;
  for (let i=0;i<text.length;i++) {
    const c=text[i];
    if (c==='"') {
      if (q && text[i+1]==='"') { field+='"'; i++; }
      else q=!q;
    } else if (c===',' && !q) { row.push(field); field=''; }
    else if ((c==='\n' || c==='\r') && !q) {
      if (c==='\r' && text[i+1]==='\n') i++;
      row.push(field); if (row.some(v=>v!=='')) rows.push(row); row=[]; field='';
    } else field+=c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function extractFragranticaId(src) {
  const s=String(src||'').trim();
  if (!/fragrantica\./i.test(s)) return null;
  const m=s.match(/-(\d+)\.html(?:$|[?#])/i) || s.match(/\/p\/(\d+)(?:$|[?#])/i);
  return m ? Number(m[1]) : null;
}

const records = new Map();
for (const file of sources) {
  const rows=parseCsv(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
  const header=rows.shift();
  const ir=header.indexOf('rank'), ic=header.indexOf('shobi_code'), ip=header.indexOf('primary_source'), is=header.indexOf('secondary_source');
  for (const row of rows) {
    const rank=Number(row[ir]);
    if (!Number.isInteger(rank) || rank<1 || rank>100) continue;
    const primary=String(row[ip]||'').trim();
    const secondary=is>=0 ? String(row[is]||'').trim() : '';
    const primaryId=extractFragranticaId(primary);
    const secondaryId=extractFragranticaId(secondary);
    const fragranticaId=primaryId ?? secondaryId;
    if (!fragranticaId) continue;
    const fragranticaSource=primaryId ? primary : secondary;
    records.set(rank,{rank,code:String(row[ic]||'').trim(),fragrantica_id:fragranticaId,fragrantica_source:fragranticaSource});
  }
}

if (records.size !== 100) {
  const missing=[]; for(let r=1;r<=100;r++) if(!records.has(r)) missing.push(r);
  throw new Error(`Expected 100 Fragrantica IDs, got ${records.size}; missing=${missing.join(',')}`);
}

const outDir='artifacts/fragrantica-social-cards-top100';
fs.mkdirSync(outDir,{recursive:true});
const results=[];

for (let rank=1;rank<=100;rank++) {
  const rec=records.get(rank);
  const url=`https://fimgs.net/mdimg/perfume-social-cards/en-p_c_${rec.fragrantica_id}.jpeg`;
  let status=0, ok=false, bytes=0, error='';
  try {
    const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'}});
    status=res.status;
    if (res.ok) {
      const buf=Buffer.from(await res.arrayBuffer());
      bytes=buf.length;
      if (bytes>1000) {
        fs.writeFileSync(path.join(outDir,`${String(rank).padStart(3,'0')}-${rec.fragrantica_id}.jpeg`),buf);
        ok=true;
      } else error=`too-small:${bytes}`;
    } else error=`http-${res.status}`;
  } catch (e) { error=String(e?.message||e); }
  results.push({...rec,url,status,ok,bytes,error});
  console.log(`${String(rank).padStart(3,'0')} id=${rec.fragrantica_id} ${ok?'OK':'FAIL'} status=${status} bytes=${bytes} ${error}`);
}

fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify(results,null,2));
const okCount=results.filter(x=>x.ok).length;
console.log(`SOCIAL_CARDS_FETCHED ${okCount}/100`);
if (okCount<100) process.exitCode=2;
