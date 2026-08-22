import fs from 'node:fs';
import path from 'node:path';

const src='Personal Database/bestseller-101-200-fragrantica-resolved.json';
const data=JSON.parse(fs.readFileSync(src,'utf8'));
const records=Array.isArray(data.resolved)?data.resolved:[];
if (!records.length) throw new Error('No resolved Fragrantica records found');

const outDir='artifacts/fragrantica-social-cards-101-200';
fs.mkdirSync(outDir,{recursive:true});
const results=[];
for (const rec of records) {
  const rank=Number(rec.rank), id=Number(rec.fragrantica_id);
  if (!Number.isInteger(rank)||rank<101||rank>200||!Number.isInteger(id)) continue;
  const url=`https://fimgs.net/mdimg/perfume-social-cards/en-p_c_${id}.jpeg`;
  let status=0, ok=false, bytes=0, error='';
  try {
    const res=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'}});
    status=res.status;
    if (res.ok) {
      const buf=Buffer.from(await res.arrayBuffer());
      bytes=buf.length;
      if (bytes>1000) {
        fs.writeFileSync(path.join(outDir,`${String(rank).padStart(3,'0')}-${id}.jpeg`),buf);
        ok=true;
      } else error=`too-small:${bytes}`;
    } else error=`http-${res.status}`;
  } catch(e) { error=String(e?.message||e); }
  results.push({rank,code:rec.code,inspired_by:rec.inspired_by,brand:rec.brand,fragrantica_id:id,fragrantica_url:rec.fragrantica_url,url,status,ok,bytes,error});
  console.log(`${rank} id=${id} ${ok?'OK':'FAIL'} status=${status} bytes=${bytes} ${error}`);
}
fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify(results,null,2)+'\n');
const okCount=results.filter(x=>x.ok).length;
console.log(`SOCIAL_CARDS_FETCHED ${okCount}/${results.length}`);
if (okCount!==results.length) process.exitCode=2;
