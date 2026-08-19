// Bestseller #2 card: reuse the approved Vanilla 28 live card structure without changing Vanilla itself.
(function(){
  const code=(window.SHOBI_BESTSELLER_CODES||[])[1];
  if(!code || typeof isVanilla28!=='function' || typeof renderVanillaPrototype!=='function') return;

  const baseIsVanilla=isVanilla28;
  const baseRenderVanilla=renderVanillaPrototype;
  const noteIcons={
    'Cognac':'https://fimgs.net/mdimg/sastojci/t.280.jpg',
    'Cinnamon':'https://fimgs.net/mdimg/sastojci/t.65.jpg',
    'Tonka Bean':'https://fimgs.net/mdimg/sastojci/t.73.jpg',
    'Oak':'https://fimgs.net/mdimg/sastojci/t.326.jpg',
    'Hedione':'https://fimgs.net/mdimg/sastojci/t.640.jpg'
  };

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function cleanTitle(p){
    return String(p.inspiredBy||p.shobiName||'')
      .replace(/\s*[-–—]\s*KILIAN(?:\s+PARIS)?\s*$/i,'')
      .trim();
  }

  isVanilla28=function(p){
    return baseIsVanilla(p) || String(p.code||'')===code;
  };

  renderVanillaPrototype=function(p){
    if(String(p.code||'')!==code) return baseRenderVanilla(p);

    const favorite=state.favorites.includes(p.code);
    const article=document.createElement('article');
    const shopUrl=p.shobiUrl||`https://leparfum.com.gr/en/module/iqitsearch/searchiqit?s=${encodeURIComponent(p.code)}`;
    const rank=(window.SHOBI_BESTSELLER_CODES||[]).indexOf(p.code)+1;
    const title=cleanTitle(p);
    const gender='unisex';
    const season='winter';
    const notes=['Cognac','Cinnamon','Tonka Bean','Oak','Hedione'];
    const noteBadges=notes.map(name=>`<button type="button" class="prototype-meta-badge prototype-filter-badge${state.selectedNote===name?' is-active':''}" data-card-filter="note" data-filter-value="${esc(name)}" title="Filter by ${esc(name)}"><img src="${noteIcons[name]}" alt="" width="22" height="22" loading="lazy" decoding="async" style="width:22px;height:22px;object-fit:cover;border-radius:50%;flex:0 0 22px"><span>${esc(name)}</span></button>`).join('');
    const image=p.image||'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.62615.2x.avif';

    article.className='perfume-card-prototype bg-surface rounded-xl shadow-lg overflow-hidden flex flex-col';
    article.innerHTML=`<div class="p-4 pb-3 text-left"><h3 class="text-lg font-bold text-primary leading-tight">${esc(title)}</h3><div class="mt-1 flex flex-wrap items-center gap-2"><button type="button" data-action="filter-brand" data-brand="${esc(p.brand)}" class="font-medium text-secondary hover:underline text-left" style="font-size:17px">${esc(p.brand)}</button><span class="inline-flex items-center whitespace-nowrap rounded-full border border-base bg-base px-2.5 py-1 text-xs font-semibold text-primary">Best Seller #${rank}</span></div></div><div class="prototype-image-wrap"><img src="${esc(image)}" alt="${esc(title)} - ${esc(p.brand)}" loading="lazy" decoding="async"></div><div class="px-4 pt-3 pb-4 flex flex-col gap-3"><div class="text-sm text-secondary text-left flex items-center gap-3"><button type="button" class="prototype-meta-badge prototype-filter-badge${state.activeFilters.gender.includes(gender)?' is-active':''}" data-card-filter="gender" data-filter-value="${gender}" title="Filter Unisex" aria-label="Filter Unisex"><span style="width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px">${getAudienceIcons(gender)}</span><span style="font-size:16px">Unisex</span></button><span class="text-tertiary">|</span><button type="button" class="prototype-meta-badge prototype-filter-badge${state.activeFilters.season.includes(season)?' is-active':''}" data-card-filter="season" data-filter-value="${season}" title="Filter Winter" aria-label="Filter Winter"><span style="width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px;font-size:1rem">❄️</span></button></div><div class="flex flex-wrap gap-2">${noteBadges}</div><button type="button" data-action="show-details" data-code="${esc(p.code)}" class="prototype-details-btn">More details</button><div class="prototype-actions"><button type="button" class="favorite-btn${favorite?' is-favorite':''}" data-code="${esc(p.code)}">${favorite?'<i class="fa-solid fa-heart"></i>':'<i class="fa-regular fa-heart"></i>'}<span> Favorite</span></button><span class="prototype-divider">|</span><button type="button" class="collection-prototype-btn" title="Collection prototype"><i class="fa-solid fa-plus"></i><span> Collection</span></button></div><a href="${esc(shopUrl)}" target="_blank" rel="noopener noreferrer" class="prototype-shop-btn">Shop on Shobi</a></div>`;
    return article;
  };
})();
