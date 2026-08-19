/* OFFICIAL CATCHER 0.3.5 — 10 PERFUME SITE TEST */
const __baseLoadEnrichmentForCatcherTest = loadEnrichment;
loadEnrichment = async function(){
  if(enrich)return;
  try{
    const [baseRes,catcherRes]=await Promise.all([
      fetch('./site-enrichment-v2.json?v=6c3406544b1e1a71',{cache:'no-store'}),
      fetch('./fragrantica-main-notes.json?v=catcher-035-test1',{cache:'no-store'})
    ]);
    if(!baseRes.ok)throw Error('base enrichment '+baseRes.status);
    enrich=(await baseRes.json()).e||{};

    let applied=0;
    if(catcherRes.ok){
      const catcher=await catcherRes.json();
      const byId=catcher.perfumes||{};
      const fragIdFromUrl=url=>{const m=String(url||'').match(/-(\d+)\.html(?:[?#]|$)/i);return m?m[1]:''};
      Object.values(enrich).forEach(row=>{
        if(!Array.isArray(row))return;
        const id=fragIdFromUrl(row[4]);
        const src=id&&byId[id];
        if(!src||!Array.isArray(src.notes)||!src.notes.length)return;
        row[2]=src.notes.slice().sort((a,b)=>(Number(a.rank)||999)-(Number(b.rank)||999)).slice(0,5).map(n=>String(n.note||'').trim()).filter(Boolean);
        applied++;
      });
    }else console.warn('CATCHER_NOTES_TEST database unavailable',catcherRes.status);

    console.log('CATCHER_NOTES_TEST_APPLIED',applied);
    buildFilters();
    render();
  }catch(e){
    console.warn('CATCHER_NOTES_TEST failed; normal enrichment fallback',e);
    enrich=null;
    return __baseLoadEnrichmentForCatcherTest();
  }
};
