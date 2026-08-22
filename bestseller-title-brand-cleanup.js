// Display rule: perfume title must not repeat the brand already shown in its separate badge.
(function(){
  if(typeof window.renderVanillaPrototype!=='function') return;
  const baseRender=window.renderVanillaPrototype;
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  window.renderVanillaPrototype=function(p){
    const card=baseRender(p);
    if(!card || !card.querySelector) return card;
    const title=card.querySelector('h3');
    const brandEl=card.querySelector('[data-action="filter-brand"]');
    if(!title || !brandEl) return card;
    const brand=String(brandEl.textContent||'').trim();
    let name=String(title.textContent||'').trim();
    if(!brand || !name) return card;
    const parts=name.split(/\s+[-–—]\s+/);
    if(parts.length>1){
      const tail=parts[parts.length-1].trim();
      const a=norm(tail), b=norm(brand);
      if(a && b && (a===b || a.startsWith(b) || b.startsWith(a))){
        parts.pop();
        name=parts.join(' - ').trim();
      }
    }
    title.textContent=name;
    return card;
  };
})();
