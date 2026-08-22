// Display rule: perfume title must not repeat the brand already shown in its separate badge.
(function(){
  if(typeof window.renderVanillaPrototype!=='function') return;
  const baseRender=window.renderVanillaPrototype;
  window.renderVanillaPrototype=function(p){
    const card=baseRender(p);
    if(!card || !card.querySelector) return card;
    const title=card.querySelector('h3');
    const brandEl=card.querySelector('[data-action="filter-brand"]');
    if(!title || !brandEl) return card;
    const brand=String(brandEl.textContent||'').trim();
    let name=String(title.textContent||'').trim();
    if(!brand || !name) return card;
    const lowerName=name.toLocaleLowerCase();
    const lowerBrand=brand.toLocaleLowerCase();
    for(const sep of [' - ',' – ',' — ']){
      const suffix=(sep+lowerBrand);
      if(lowerName.endsWith(suffix)){
        name=name.slice(0,name.length-(sep.length+brand.length)).trim();
        break;
      }
    }
    title.textContent=name;
    return card;
  };
})();
