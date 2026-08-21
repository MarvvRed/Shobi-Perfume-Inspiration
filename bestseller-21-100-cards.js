// Generic Best Seller cards for ranks #21-#100, driven by source-locked enrichment.
(function(){
  const norm=v=>String(v||'').toUpperCase().replace(/\s+/g,'');
  const base=v=>{const m=String(v||'').trim().toUpperCase().match(/^(\d+)-([A-Z0-9]+)/);return m?`${m[1]}-${m[2]}`:norm(v);};
  const entries=(window.SHOBI_BESTSELLER_RANKING||[]).filter(x=>Number(x.rank)>20&&Number(x.rank)<=100);
  if(!entries.length || typeof isVanilla28!=='function' || typeof renderVanillaPrototype!=='function') return;

  const rankByCode=new Map(entries.map(x=>[norm(x.code),Number(x.rank)]));
  const rankByBase=new Map(), ambiguousRankBases=new Set();
  entries.forEach(x=>{
    const b=base(x.code), rank=Number(x.rank);
    if(!rankByBase.has(b)) rankByBase.set(b,rank);
    else if(rankByBase.get(b)!==rank){ambiguousRankBases.add(b);rankByBase.delete(b);}
  });
  const rankFor=p=>{
    const exact=rankByCode.get(norm(p.code));
    if(Number.isFinite(exact)) return exact;
    const b=base(p.code);
    return !ambiguousRankBases.has(b)&&rankByBase.has(b)?rankByBase.get(b):null;
  };

  const locked=window.SHOBI_TOP100_ENRICHMENT_BY_CODE||{}, baseMatch=isVanilla28, baseRender=renderVanillaPrototype;
  const lockedByBase=new Map(), ambiguousLockedBases=new Set();
  Object.entries(locked).forEach(([code,row])=>{const b=base(code);if(!lockedByBase.has(b))lockedByBase.set(b,row);else if(lockedByBase.get(b)!==row){ambiguousLockedBases.add(b);lockedByBase.delete(b);}});
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const genderLabel=g=>g==='female'?'Female':g==='male'?'Male':g==='unisex'?'Unisex':'';
  const seasonMeta=s=>({spring:['🌸','Spring'],summer:['☀️','Summer'],fall:['🍂','Fall'],autumn:['🍂','Autumn'],winter:['❄️','Winter']}[s]||null);
  const dataFor=p=>{const exact=locked[norm(p.code)];if(exact)return exact;const b=base(p.code);return !ambiguousLockedBases.has(b)?(lockedByBase.get(b)||null):null;};
  const notesFor=p=>{const d=dataFor(p);if(d&&Array.isArray(d.main_notes)&&d.main_notes.length)return d.main_notes.slice(0,5);return [...(p.notes?.top||[]),...(p.notes?.heart||[]),...(p.notes?.base||[])].filter((v,i,a)=>v&&a.indexOf(v)===i).slice(0,5);};
  const noteBadge=name=>`<button type="button" class="prototype-meta-badge prototype-filter-badge${state.selectedNote===name?' is-active':''}" data-card-filter="note" data-filter-value="${esc(name)}" title="Filter by ${esc(name)}"><span aria-hidden="true" style="width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px;background:var(--color-bg-surface);border:1px solid var(--color-border-light);font-size:10px"><i class="fa-solid fa-droplet"></i></span><span>${esc(name)}</span></button>`;
  isVanilla28=function(p){return baseMatch(p)||Number.isFinite(rankFor(p));};
  renderVanillaPrototype=function(p){
    const rank=rankFor(p); if(!Number.isFinite(rank)) return baseRender(p);
    const d=dataFor(p), favorite=state.favorites.includes(p.code), article=document.createElement('article');
    const g=String(d?.gender||p.genderAffinity||'').toLowerCase(), gl=genderLabel(g);
    const s=String(d?.season||(p.seasons||[])[0]||'').toLowerCase(), sm=seasonMeta(s);
    const notes=notesFor(p), noteBadges=notes.map(noteBadge).join('');
    const shopUrl=d?.shobi_url||p.shobiUrl||`https://leparfum.com.gr/en/module/iqitsearch/searchiqit?s=${encodeURIComponent(p.code)}`;
    const image=d?.image||p.image||'', imageHtml=image?`<img src="${esc(image)}" alt="${esc(p.inspiredBy)} - ${esc(p.brand)}" loading="lazy" decoding="async">`:`<div class="text-tertiary text-sm">Image not verified</div>`;
    const genderHtml=gl?`<button type="button" class="prototype-meta-badge prototype-filter-badge${state.activeFilters.gender.includes(g)?' is-active':''}" data-card-filter="gender" data-filter-value="${g}" title="Filter ${gl}" aria-label="Filter ${gl}"><span style="width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px">${getAudienceIcons(g)}</span><span style="font-size:16px">${gl}</span></button>`:'';
    const seasonHtml=sm?`${genderHtml?'<span class="text-tertiary">|</span>':''}<button type="button" class="prototype-meta-badge prototype-filter-badge${state.activeFilters.season.includes(s)?' is-active':''}" data-card-filter="season" data-filter-value="${s}" title="Filter ${sm[1]}" aria-label="Filter ${sm[1]}"><span style="width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px;font-size:1rem">${sm[0]}</span></button>`:'';
    article.className='perfume-card-prototype bg-surface rounded-xl shadow-lg overflow-hidden flex flex-col';
    article.innerHTML=`<div class="p-4 pb-3 text-left"><h3 class="text-lg font-bold text-primary leading-tight">${esc(p.inspiredBy)}</h3><div class="mt-1 flex flex-wrap items-center gap-2"><button type="button" data-action="filter-brand" data-brand="${esc(p.brand)}" class="font-medium text-secondary text-left" style="font-size:17px">${esc(p.brand)}</button><span class="text-xs text-secondary">Best Seller #${rank}</span></div></div><div class="prototype-image-wrap">${imageHtml}</div><div class="px-4 pt-3 pb-4 flex flex-col gap-3"><div class="text-sm text-secondary text-left flex items-center gap-3">${genderHtml}${seasonHtml}</div><div class="flex flex-wrap gap-2">${noteBadges}</div><button type="button" data-action="show-details" data-code="${esc(p.code)}" class="prototype-details-btn">More details</button><div class="prototype-actions"><button type="button" class="favorite-btn${favorite?' is-favorite':''}" data-code="${esc(p.code)}">${favorite?'<i class="fa-solid fa-heart"></i>':'<i class="fa-regular fa-heart"></i>'}<span> Favorite</span></button><span class="prototype-divider">|</span><button type="button" class="collection-prototype-btn" title="Collection prototype"><i class="fa-solid fa-plus"></i><span> Collection</span></button></div><a href="${esc(shopUrl)}" target="_blank" rel="noopener noreferrer" class="prototype-shop-btn">Shop on Shobi</a></div>`;
    return article;
  };
})();
