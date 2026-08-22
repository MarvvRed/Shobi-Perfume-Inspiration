// Best Seller #41-#100: canonical Fragrantica ID Mapping Rule image/link source.
(function(){
  const SOURCE='Fragrantica ID Database/mappings/bestseller-001-100.json';
  const norm=v=>String(v||'').toUpperCase().replace(/\s+/g,'');
  let byCode=null, loading=null;

  function load(){
    if(byCode) return Promise.resolve(byCode);
    if(loading) return loading;
    loading=fetch(SOURCE,{cache:'no-store'})
      .then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
      .then(data=>{
        byCode=new Map((data.records||[])
          .filter(x=>x&&x.shobi_code&&x.fragrantica_id&&x.fragrantica_url&&x.image_url&&x.rank>=41&&x.rank<=100)
          .map(x=>[norm(x.shobi_code),x]));
        return byCode;
      })
      .catch(()=>{byCode=new Map();return byCode;});
    return loading;
  }

  function apply(){
    load().then(map=>{
      document.querySelectorAll('.perfume-card-prototype').forEach(card=>{
        const details=card.querySelector('[data-action="show-details"][data-code]');
        const code=details?.dataset.code||card.dataset.catcherCode||'';
        const row=map.get(norm(code));
        if(!row) return;
        const wrap=card.querySelector('.prototype-image-wrap');
        if(!wrap) return;

        let img=wrap.querySelector('img');
        if(!img){img=document.createElement('img');wrap.prepend(img);}
        img.src=row.image_url;
        img.loading='lazy';
        img.decoding='async';

        Array.from(wrap.children).forEach(el=>{
          if(el!==img && el.tagName!=='A' && el.textContent.trim()==='Image not verified') el.remove();
        });

        let link=img.closest('a.prototype-fragrantica-link');
        if(!link){
          link=document.createElement('a');
          link.className='prototype-fragrantica-link';
          img.parentNode.insertBefore(link,img);
          link.appendChild(img);
        }
        link.href=row.fragrantica_url;
        link.target='_blank';
        link.rel='noopener noreferrer';
        link.title='View on Fragrantica';
        link.setAttribute('aria-label','View this perfume on Fragrantica');
        if(!link.querySelector('.prototype-fragrantica-hint')){
          const hint=document.createElement('span');
          hint.className='prototype-fragrantica-hint';
          hint.setAttribute('aria-hidden','true');
          hint.innerHTML='<i class="fa-solid fa-arrow-up-right-from-square"></i><span>Fragrantica</span>';
          link.appendChild(hint);
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded',()=>{
    const c=document.getElementById('resultsContainer');
    if(c)new MutationObserver(apply).observe(c,{childList:true,subtree:true});
    apply();
  });
})();
