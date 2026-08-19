/* OFFICIAL CATCHER 0.3.5 — 10 PERFUME SITE TEST */
const __baseLoadEnrichmentForCatcherTest = loadEnrichment;
loadEnrichment = async function(){
  if(enrich)return;
  try{
    const [baseRes,catcherRes]=await Promise.all([
      fetch('./site-enrichment-v2.json?v=6c3406544b1e1a71',{cache:'no-store'}),
      fetch('./fragrantica-main-notes.json?v=catcher-035-test2',{cache:'no-store'})
    ]);
    if(!baseRes.ok)throw Error('base enrichment '+baseRes.status);
    enrich=(await baseRes.json()).e||{};

    let applied=0;
    const appliedRows=[];
    if(catcherRes.ok){
      const catcher=await catcherRes.json();
      const byId=catcher.perfumes||{};
      const clean=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
      const fragIdFromUrl=url=>{const m=String(url||'').match(/-(\d+)\.html(?:[?#]|$)/i);return m?m[1]:''};
      const byName=new Map();
      Object.values(byId).forEach(src=>{
        const key=clean(src&&src.name);
        if(key&&!byName.has(key))byName.set(key,src);
      });
      const perfumeByCode=new Map((perfumes||[]).map(p=>[ck(p.code),p]));

      Object.entries(enrich).forEach(([code,row])=>{
        if(!Array.isArray(row))return;
        const fragId=fragIdFromUrl(row[4]);
        let src=fragId&&byId[fragId];
        let matchedBy=src?'fragrantica-id':'';

        if(!src){
          const p=perfumeByCode.get(ck(code));
          const nameKey=clean(p&&p.name);
          src=nameKey&&byName.get(nameKey);
          if(src)matchedBy='exact-name';
        }

        if(!src||!Array.isArray(src.notes)||!src.notes.length)return;
        row[2]=src.notes.slice().sort((a,b)=>(Number(a.rank)||999)-(Number(b.rank)||999)).slice(0,5).map(n=>String(n.note||'').trim()).filter(Boolean);
        applied++;
        appliedRows.push(`${code}:${src.name}:${matchedBy}`);
      });
    }else console.warn('CATCHER_NOTES_TEST database unavailable',catcherRes.status);

    console.log('CATCHER_NOTES_TEST_APPLIED',applied,appliedRows);
    buildFilters();
    render();
  }catch(e){
    console.warn('CATCHER_NOTES_TEST failed; normal enrichment fallback',e);
    enrich=null;
    return __baseLoadEnrichmentForCatcherTest();
  }
};
