// Verified Best Seller card support beyond #20.
// IMPORTANT: ranking is independent from shobi-master.csv row order.
// At the moment only #21 has been explicitly verified here.
(function(){
  const ranked=["1644-DRC M"];
  const rankByCode=new Map([["1644-DRC M",21]]);
  if(!ranked.length || typeof isVanilla28!=='function' || typeof renderVanillaPrototype!=='function') return;
  const rankedSet=new Set(ranked.map(String));
  const baseMatch=isVanilla28, baseRender=renderVanillaPrototype;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const genderLabel=g=>g==='female'?'Female':g==='male'?'Male':g==='unisex'?'Unisex':'';
  const seasonMeta=s=>({spring:['🌸','Spring'],summer:['☀️','Summer'],fall:['🍂','Fall'],autumn:['🍂','Autumn'],winter:['❄️','Winter']}[s]||null);
  const allNotes=p=>[...(p.notes?.top||[]),...(p.notes?.heart||[]),...(p.notes?.base||[])].filter((v,i,a)=>v&&a.indexOf(v)===i).slice(0,5);
  const noteBadge=name=>`<button type="button" class="prototype-meta-badge prototype-filter-badge${state.selectedNote===name?' is-active':''}" data-card-filter="note" data-filter-value="${esc(name)}" title="Filter by ${esc(name)}"><span aria-hidden="true" style="width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px;background:var(--color-bg-surface);border:1px solid var(--color-border-light);font-size:10px"><i class="fa-solid fa-droplet"></i></span><span>${esc(name)}</span></button>`;
  isVanilla28=function(p){return baseMatch(p)||rankedSet.has(String(p.code||''));};
  renderVanillaPrototype=function(p){
    if(!rankedSet.has(String(p.code||''))) return baseRender(p);
    const rank=rankByCode.get(String(p.code||''));
    const favorite=state.favorites.includes(p.code), article=document.createElement('article');
    const g=String(p.genderAffinity||'').toLowerCase(), gl=genderLabel(g);
    const s=String((p.seasons||[])[0]||'').toLowerCase(), sm=seasonMeta(s);
    const notes=allNotes(p), noteBadges=notes.map(noteBadge).join('');
    const shopUrl=p.shobiUrl||`https://leparfum.com.gr/en/module/iqitsearch/searchiqit?s=${encodeURIComponent(p.code)}`;
    const image=p.image||'';
    const imageHtml=image?`<img src="${esc(image)}" alt="${esc(p.inspiredBy)} - ${esc(p.brand)}" loading="lazy" decoding="async">`:`<div class="text-tertiary text-sm">Image not verified</div>`;
    const genderHtml=gl?`<button type="button" class="prototype-meta-badge prototype-filter-badge${state.activeFilters.gender.includes(g)?' is-active':''}" data-card-filter="gender" data-filter-value="${g}" title="Filter ${gl}" aria-label="Filter ${gl}"><span style="width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px">${getAudienceIcons(g)}</span><span style="font-size:16px">${gl}</span></button>`:'';
    const seasonHtml=sm?`${genderHtml?'<span class="text-tertiary">|</span>':''}<button type="button" class="prototype-meta-badge prototype-filter-badge${state.activeFilters.season.includes(s)?' is-active':''}" data-card-filter="season" data-filter-value="${s}" title="Filter ${sm[1]}" aria-label="Filter ${sm[1]}"><span style="width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px;font-size:1rem">${sm[0]}</span></button>`:'';
    article.className='perfume-card-prototype bg-surface rounded-xl shadow-lg overflow-hidden flex flex-col';
    article.innerHTML=`<div class="p-4 pb-3 text-left"><h3 class="text-lg font-bold text-primary leading-tight">${esc(p.inspiredBy)}</h3><div class="mt-1 flex flex-wrap items-center gap-2"><button type="button" data-action="filter-brand" data-brand="${esc(p.brand)}" class="font-medium text-secondary text-left" style="font-size:17px">${esc(p.brand)}</button><span class="text-xs text-secondary">Best Seller #${rank}</span></div></div><div class="prototype-image-wrap">${imageHtml}</div><div class="px-4 pt-3 pb-4 flex flex-col gap-3"><div class="text-sm text-secondary text-left flex items-center gap-3">${genderHtml}${seasonHtml}</div><div class="flex flex-wrap gap-2">${noteBadges}</div><button type="button" data-action="show-details" data-code="${esc(p.code)}" class="prototype-details-btn">More details</button><div class="prototype-actions"><button type="button" class="favorite-btn${favorite?' is-favorite':''}" data-code="${esc(p.code)}">${favorite?'<i class="fa-solid fa-heart"></i>':'<i class="fa-regular fa-heart"></i>'}<span> Favorite</span></button><span class="prototype-divider">|</span><button type="button" class="collection-prototype-btn" title="Collection prototype"><i class="fa-solid fa-plus"></i><span> Collection</span></button></div><a href="${esc(shopUrl)}" target="_blank" rel="noopener noreferrer" class="prototype-shop-btn">Shop on Shobi</a></div>`;
    return article;
  };
})();
