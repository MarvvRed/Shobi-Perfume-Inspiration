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

  const brandByRank={21:'Dior',22:'Frederic Malle',23:'Ariana Grande',24:'Escentric Molecules',25:'Chanel',26:'Carolina Herrera',27:'Byredo',28:'Xerjoff',29:'Yves Saint Laurent',30:'Parfums de Marly',31:'Louis Vuitton',32:'Byredo',33:'Guerlain',34:'Prada',35:'Le Labo',36:'Narciso Rodriguez',37:'Amouage',38:'Jo Malone London',39:'Kayali',40:'Montale'};
  const resolvedBrand=(p,rank)=>{const raw=String(p.brand||'').trim();const unknown=!raw||/^unknown(?: brand)?$/i.test(raw);return unknown&&brandByRank[rank]?brandByRank[rank]:raw;};

  // Verified Fragrantica pages from the Playwright #21-#40 catcher batch.
  const fragranticaByRank={
    21:['68415','https://www.fragrantica.com/perfume/Dior/Sauvage-Elixir-68415.html'],
    22:['91209','https://www.fragrantica.com/perfume/Frederic-Malle/Acne-Studios-91209.html'],
    23:['50384','https://www.fragrantica.com/perfume/Ariana-Grande/Cloud-50384.html'],
    24:['845','https://www.fragrantica.com/perfume/Escentric-Molecules/Molecule-01-845.html'],
    25:['9099','https://www.fragrantica.com/perfume/Chanel/Bleu-de-Chanel-9099.html'],
    26:['39681','https://www.fragrantica.com/perfume/Carolina-Herrera/Good-Girl-39681.html'],
    27:['27040','https://www.fragrantica.com/perfume/Byredo/Mojave-Ghost-27040.html'],
    28:['65383','https://www.fragrantica.com/perfume/Xerjoff/Italica-2021-65383.html'],
    29:['62318','https://www.fragrantica.com/perfume/Yves-Saint-Laurent/Libre-Intense-62318.html'],
    30:['50370','https://www.fragrantica.com/perfume/Parfums-de-Marly/Delina-Exclusif-50370.html'],
    31:['49755','https://www.fragrantica.com/perfume/Louis-Vuitton/Ombre-Nomade-49755.html'],
    32:['3575','https://www.fragrantica.com/perfume/Byredo/Gypsy-Water-3575.html'],
    33:['53806','https://www.fragrantica.com/perfume/Guerlain/Aqua-Allegoria-Coconut-Fizz-53806.html'],
    34:['75668','https://www.fragrantica.com/perfume/Prada/Prada-Paradoxe-75668.html'],
    35:['12201','https://www.fragrantica.com/perfume/Le-Labo/Santal-33-12201.html'],
    36:['53441','https://www.fragrantica.com/perfume/narciso-rodriguez/pure-musc-for-her-53441.html'],
    37:['78656','https://www.fragrantica.com/perfume/Amouage/Guidance-78656.html'],
    38:['25529','https://www.fragrantica.com/perfume/Jo-Malone-London/Wood-Sage-Sea-Salt-25529.html'],
    39:['79846','https://www.fragrantica.com/perfume/Kayali-Fragrances/Yum-Pistachio-Gelato-33-79846.html'],
    40:['57384','https://www.fragrantica.com/perfume/Montale/Arabians-Tonka-57384.html']
  };

  const noteImageIds={
    'Lavender':'1','Licorice':'195','Nutmeg':'59','Cinnamon':'65','Sandalwood':'33','Aldehydes':'165','Peach':'117','Musk':'4','Orange Blossom':'16','Violet':'116','Whipped Cream':'454','Coconut':'138','Praline':'198','Iso E Super':'422','Grapefruit':'76','Incense':'68','Lemon':'77','Ginger':'62','Mint':'160','Tonka Bean':'73','Cacao':'135','Vanilla':'74','Tuberose':'25','Almond':'130','Sapodilla':'645','Magnolia':'147','Ambrette (Musk Mallow)':'107','Toffee':'434','Milk':'199','Bourbon Vanilla':'74','Saffron':'55','Madagascar Vanilla':'74','Tunisian Orange Blossom':'16','Jasmine Sambac':'14','Turkish Rose':'105','Litchi':'194','Pear':'182','Amber':'54','Agarwood (Oud)':'114','Rose':'105','Raspberry':'174','Juniper':'142','Pine needles':'204','Coconut Nectar':'138','Water Fruit':'702','Freesia':'94','Bergamot':'75','Neroli':'17','Leather':'156','Papyrus':'206','Virginia Cedar':'41','Cardamom':'63','Cashmeran':'348','Jasmine':'14','Ylang-Ylang':'24','Hazelnut':'141','Akigalawood':'697','Sea Salt':'231','Sage':'52','Seaweed':'409','Pistachio':'221','Ice cream':'599','Marshmallow':'236','Cotton Candy':'237','Sugar Cane':'200','Bulgarian Rose':'105'
  };
  const noteBadge=name=>{const id=noteImageIds[name]||'';const visual=id?`<img src="https://fimgs.net/mdimg/sastojci/t.${esc(id)}.jpg" alt="" width="22" height="22" loading="lazy" decoding="async" style="width:22px;height:22px;object-fit:cover;border-radius:50%;flex:0 0 22px">`:`<span aria-hidden="true" style="width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px;background:var(--color-bg-surface);border:1px solid var(--color-border-light);font-size:10px"><i class="fa-solid fa-droplet"></i></span>`;return `<button type="button" class="prototype-meta-badge prototype-filter-badge${state.selectedNote===name?' is-active':''}" data-card-filter="note" data-filter-value="${esc(name)}" title="Filter by ${esc(name)}">${visual}<span>${esc(name)}</span></button>`;};

  isVanilla28=function(p){return baseMatch(p)||Number.isFinite(rankFor(p));};
  renderVanillaPrototype=function(p){
    const rank=rankFor(p); if(!Number.isFinite(rank)) return baseRender(p);
    const d=dataFor(p), favorite=state.favorites.includes(p.code), article=document.createElement('article');
    const displayName=String(d?.perfume||p.inspiredBy||p.shobiName||'').trim().toUpperCase();
    const brand=resolvedBrand(p,rank)||'Unknown Brand';
    const g=String(d?.gender||p.genderAffinity||'').toLowerCase(), gl=genderLabel(g);
    const s=String(d?.season||(p.seasons||[])[0]||'').toLowerCase(), sm=seasonMeta(s);
    const notes=notesFor(p), noteBadges=notes.map(noteBadge).join('');
    const shopUrl=d?.shobi_url||p.shobiUrl||`https://leparfum.com.gr/en/module/iqitsearch/searchiqit?s=${encodeURIComponent(p.code)}`;
    const verified=fragranticaByRank[rank]||null;
    const fragranticaUrl=verified?.[1]||d?.fragrantica_url||p.fragranticaUrl||'';
    const image=verified?`https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.${verified[0]}.2x.avif`:(d?.image||p.image||'');
    let imageHtml=image?`<img src="${esc(image)}" alt="${esc(displayName)} - ${esc(brand)}" loading="lazy" decoding="async">`:`<div class="text-tertiary text-sm">Image not verified</div>`;
    if(image&&fragranticaUrl) imageHtml=`<a class="prototype-fragrantica-link" href="${esc(fragranticaUrl)}" target="_blank" rel="noopener noreferrer" title="View on Fragrantica" aria-label="View ${esc(displayName)} on Fragrantica">${imageHtml}<span class="prototype-fragrantica-hint" aria-hidden="true"><i class="fa-solid fa-arrow-up-right-from-square"></i><span>Fragrantica</span></span></a>`;
    const genderHtml=gl?`<button type="button" class="prototype-meta-badge prototype-filter-badge${state.activeFilters.gender.includes(g)?' is-active':''}" data-card-filter="gender" data-filter-value="${g}" title="Filter ${gl}" aria-label="Filter ${gl}"><span style="width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px">${getAudienceIcons(g)}</span><span style="font-size:16px">${gl}</span></button>`:'';
    const seasonHtml=sm?`${genderHtml?'<span class="text-tertiary">|</span>':''}<button type="button" class="prototype-meta-badge prototype-filter-badge${state.activeFilters.season.includes(s)?' is-active':''}" data-card-filter="season" data-filter-value="${s}" title="Filter ${sm[1]}" aria-label="Filter ${sm[1]}"><span style="width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px;font-size:1rem">${sm[0]}</span><span style="font-size:16px">${esc(sm[1])}</span></button>`:'';
    article.className='perfume-card-prototype bg-surface rounded-xl shadow-lg overflow-hidden flex flex-col';
    article.innerHTML=`<div class="p-4 pb-3 text-left"><h3 class="text-lg font-bold text-primary leading-tight">${esc(displayName)}</h3><div class="mt-1 flex flex-wrap items-center gap-2"><button type="button" data-action="filter-brand" data-brand="${esc(brand)}" class="font-medium text-secondary text-left" style="font-size:17px">${esc(brand)}</button><span class="text-xs text-secondary">Best Seller #${rank}</span></div></div><div class="prototype-image-wrap">${imageHtml}</div><div class="px-4 pt-3 pb-4 flex flex-col gap-3"><div class="text-sm text-secondary text-left flex items-center gap-3">${genderHtml}${seasonHtml}</div><div class="flex flex-wrap gap-2">${noteBadges}</div><button type="button" data-action="show-details" data-code="${esc(p.code)}" class="prototype-details-btn">More details</button><div class="prototype-actions"><button type="button" class="favorite-btn${favorite?' is-favorite':''}" data-code="${esc(p.code)}">${favorite?'<i class="fa-solid fa-heart"></i>':'<i class="fa-regular fa-heart"></i>'}<span> Favorite</span></button><span class="prototype-divider">|</span><button type="button" class="collection-prototype-btn" title="Collection prototype"><i class="fa-solid fa-plus"></i><span> Collection</span></button></div><a href="${esc(shopUrl)}" target="_blank" rel="noopener noreferrer" class="prototype-shop-btn">Shop on Shobi</a></div>`;
    return article;
  };
})();
