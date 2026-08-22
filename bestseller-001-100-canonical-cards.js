// Unified Best Seller #1-#100 renderer.
// CANONICAL-TOP100-v1 site consumer.
// Protected Top100 fields (rank, Fragrantica identity/resources, Main Notes, Gender, Season)
// come ONLY from window.SHOBI_FRAGRANTICA_CANONICAL_TOP100, generated from
// Fragrantica ID Database/rebuild-top100/top100-fragrantica-mapped.json.
// Legacy catcher/enrichment scripts must not mutate these cards.
(function(){
  const canonical=window.SHOBI_FRAGRANTICA_CANONICAL_TOP100||{};
  if(!Object.keys(canonical).length || typeof isVanilla28!=='function' || typeof renderVanillaPrototype!=='function') return;

  const norm=v=>String(v||'').toUpperCase().replace(/\s+/g,'');
  const base=v=>{const m=String(v||'').trim().toUpperCase().match(/^(\d+)-([A-Z0-9]+)/);return m?`${m[1]}-${m[2]}`:norm(v);};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const titleCaseGender=g=>g==='female'?'Female':g==='male'?'Male':g==='unisex'?'Unisex':'';
  const seasonMeta=s=>({spring:['🌸','Spring'],summer:['☀️','Summer'],fall:['🍂','Fall'],autumn:['🍂','Autumn'],winter:['❄️','Winter']}[s]||null);

  const byBase=new Map(), ambiguousBases=new Set();
  Object.values(canonical).forEach(row=>{
    const b=base(row.shobi_code);
    if(!byBase.has(b)) byBase.set(b,row);
    else if(byBase.get(b)!==row){ ambiguousBases.add(b); byBase.delete(b); }
  });
  const rowFor=p=>{
    const exact=canonical[norm(p.code)];
    if(exact) return exact;
    const b=base(p.code);
    return !ambiguousBases.has(b)?(byBase.get(b)||null):null;
  };

  // Fragrantica note icon registry compatibility.
  // Prefer an explicit URL map when present; otherwise build the public fimgs URL
  // from the canonical Fragrantica note ID registry.
  const noteIconIdByLower={};
  Object.entries(window.FRAGRANTICA_NOTE_ICON_IDS||{}).forEach(([name,id])=>{
    const key=String(name||'').trim().toLowerCase();
    if(key && id && !noteIconIdByLower[key]) noteIconIdByLower[key]=String(id);
  });
  const noteIconUrl=name=>{
    const key=String(name||'').trim().toLowerCase();
    const direct=(window.SHOBI_FRAGRANTICA_NOTE_ICON_URL_BY_NAME||{})[key];
    if(direct) return direct;
    const id=noteIconIdByLower[key];
    return id?`https://fimgs.net/mdimg/sastojci/m.${encodeURIComponent(id)}.jpg`:'';
  };

  const noteBadge=name=>{
    name=String(name||'').trim();
    if(!name) return '';
    const icon=noteIconUrl(name);
    const visual=icon
      ? `<img src="${esc(icon)}" alt="" width="22" height="22" loading="lazy" decoding="async" style="width:22px;height:22px;object-fit:cover;border-radius:50%;flex:0 0 22px" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'">`+
        `<span aria-hidden="true" style="display:none;width:22px;height:22px;border-radius:50%;align-items:center;justify-content:center;flex:0 0 22px;background:var(--color-bg-surface);border:1px solid var(--color-border-light);font-size:10px"><i class="fa-solid fa-droplet"></i></span>`
      : `<span aria-hidden="true" style="width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px;background:var(--color-bg-surface);border:1px solid var(--color-border-light);font-size:10px"><i class="fa-solid fa-droplet"></i></span>`;
    return `<button type="button" class="prototype-meta-badge prototype-filter-badge${state.selectedNote===name?' is-active':''}" data-card-filter="note" data-filter-value="${esc(name)}" title="Filter by ${esc(name)}" style="max-width:calc(50% - 4px);min-width:0;white-space:nowrap;overflow:hidden">${visual}<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</span></button>`;
  };

  // Layout-only spacer: visible empty badge shell, never part of canonical Main Notes data.
  const emptyNoteBadge=()=>`<span class="prototype-meta-badge canonical-note-placeholder" aria-hidden="true" style="min-width:82px;max-width:calc(50% - 4px);min-height:34px;pointer-events:none;user-select:none"></span>`;
  const noteRowsHtml=notes=>{
    const clean=(Array.isArray(notes)?notes:[]).filter(Boolean);
    const rows=[];
    for(let i=0;i<clean.length;i+=2) rows.push(clean.slice(i,i+2));
    while(rows.length<3) rows.push([]);
    return rows.map(row=>`<div class="canonical-note-row flex gap-2" style="flex-wrap:nowrap;min-width:0">${row.length?row.map(noteBadge).join(''):emptyNoteBadge()}</div>`).join('');
  };

  // Runtime validation is intentionally independent of legacy/canonical origin:
  // green means the rendered canonical record has all required protected fields;
  // red means at least one required field/identity check failed.
  const validateCanonicalRow=(p,row)=>{
    const errors=[];
    const rank=Number(row.rank);
    if(!Number.isInteger(rank) || rank<1 || rank>100) errors.push('invalid rank');
    if(!String(row.shobi_code||'').trim()) errors.push('missing Shobi code');
    if(base(p.code)!==base(row.shobi_code)) errors.push('Shobi identity mismatch');
    if(!String(row.fragrantica_id||'').trim()) errors.push('missing Fragrantica ID');
    if(!/^https?:\/\//i.test(String(row.fragrantica_url||''))) errors.push('missing Fragrantica URL');
    if(!/^https?:\/\//i.test(String(row.image_url||''))) errors.push('missing image');
    if(!Array.isArray(row.main_notes) || !row.main_notes.filter(Boolean).length) errors.push('missing Main Notes');
    if(!['female','male','unisex'].includes(String(row.gender||'').toLowerCase())) errors.push('invalid Gender');
    if(!['spring','summer','fall','autumn','winter'].includes(String(row.season||'').toLowerCase())) errors.push('invalid Season');
    return errors;
  };
  const canonicalStatusBadge=errors=>{
    if(errors.length){
      const title=`Canonical verification error: ${errors.join(', ')}`;
      return `<span class="canonical-status-badge canonical-top100-error-badge" data-validation-status="error" title="${esc(title)}" aria-label="${esc(title)}" style="position:absolute;right:10px;bottom:10px;width:28px;height:28px;border-radius:9999px;display:flex;align-items:center;justify-content:center;background:#dc2626;color:white;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.28);font-size:14px;z-index:2"><i class="fa-solid fa-xmark"></i></span>`;
    }
    return `<span class="canonical-status-badge canonical-top100-verified-badge" data-validation-status="verified" title="CANONICAL-TOP100-v1 verified" aria-label="CANONICAL-TOP100-v1 verified" style="position:absolute;right:10px;bottom:10px;width:28px;height:28px;border-radius:9999px;display:flex;align-items:center;justify-content:center;background:#16a34a;color:white;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.28);font-size:14px;z-index:2"><i class="fa-solid fa-check"></i></span>`;
  };

  const baseMatch=isVanilla28, baseRender=renderVanillaPrototype;
  isVanilla28=function(p){return baseMatch(p)||!!rowFor(p);};
  renderVanillaPrototype=function(p){
    const row=rowFor(p);
    if(!row) return baseRender(p);

    const validationErrors=validateCanonicalRow(p,row);
    const statusBadge=canonicalStatusBadge(validationErrors);
    const favorite=state.favorites.includes(p.code);
    const article=document.createElement('article');
    const displayName=String(row.perfume||p.inspiredBy||p.shobiName||'').trim().toUpperCase();
    const brand=String(p.brand||'').trim()||'Unknown Brand';
    const gender=String(row.gender||'').toLowerCase();
    const genderLabel=titleCaseGender(gender);
    const season=String(row.season||'').toLowerCase();
    const sm=seasonMeta(season);
    const notes=Array.isArray(row.main_notes)?row.main_notes.filter(Boolean):[];
    const noteRows=noteRowsHtml(notes);

    const shopUrl=row.shobi_url||p.shobiUrl||`https://leparfum.com.gr/en/module/iqitsearch/searchiqit?s=${encodeURIComponent(p.code)}`;
    const image=row.image_url||'';
    const fragranticaUrl=row.fragrantica_url||'';
    let imageHtml=image?`<img src="${esc(image)}" alt="${esc(displayName)}" loading="lazy" decoding="async">`:`<div class="text-tertiary text-sm">Image not verified</div>`;
    if(image&&fragranticaUrl){
      imageHtml=`<a class="prototype-fragrantica-link" href="${esc(fragranticaUrl)}" target="_blank" rel="noopener noreferrer" title="View on Fragrantica" aria-label="View ${esc(displayName)} on Fragrantica">${imageHtml}<span class="prototype-fragrantica-hint" aria-hidden="true"><i class="fa-solid fa-arrow-up-right-from-square"></i><span>Fragrantica</span></span></a>`;
    }

    const genderHtml=genderLabel?`<button type="button" class="prototype-meta-badge prototype-filter-badge${state.activeFilters.gender.includes(gender)?' is-active':''}" data-card-filter="gender" data-filter-value="${esc(gender)}" title="Filter ${esc(genderLabel)}" aria-label="Filter ${esc(genderLabel)}"><span style="width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px">${getAudienceIcons(gender)}</span><span style="font-size:16px">${esc(genderLabel)}</span></button>`:'';
    const seasonHtml=sm?`${genderHtml?'<span class="text-tertiary">|</span>':''}<button type="button" class="prototype-meta-badge prototype-filter-badge${state.activeFilters.season.includes(season)?' is-active':''}" data-card-filter="season" data-filter-value="${esc(season)}" title="Filter ${esc(sm[1])}" aria-label="Filter ${esc(sm[1])}"><span style="width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px;font-size:1rem">${sm[0]}</span><span style="font-size:16px">${esc(sm[1])}</span></button>`:'';

    article.className='perfume-card-prototype bg-surface rounded-xl shadow-lg overflow-hidden flex flex-col';
    article.dataset.canonicalFragranticaId=String(row.fragrantica_id||'');
    article.dataset.canonicalRank=String(row.rank||'');
    article.dataset.canonicalTop100='v1';
    article.dataset.validationStatus=validationErrors.length?'error':'verified';
    article.innerHTML=`<div class="p-4 pb-3 text-left"><h3 class="text-lg font-bold text-primary leading-tight">${esc(displayName)}</h3><div class="mt-1 flex flex-wrap items-center gap-2"><button type="button" data-action="filter-brand" data-brand="${esc(brand)}" class="font-medium text-secondary text-left" style="font-size:17px">${esc(brand)}</button><span class="text-xs text-secondary">Best Seller #${row.rank}</span></div></div><div class="prototype-image-wrap" style="position:relative">${imageHtml}${statusBadge}</div><div class="px-4 pt-3 pb-4 flex flex-col gap-3"><div class="text-sm text-secondary text-left flex items-center gap-3">${genderHtml}${seasonHtml}</div><div class="canonical-note-grid flex flex-col gap-2">${noteRows}</div><div class="prototype-actions"><button type="button" class="favorite-btn${favorite?' is-favorite':''}" data-code="${esc(p.code)}">${favorite?'<i class="fa-solid fa-heart"></i>':'<i class="fa-regular fa-heart"></i>'}<span> Favorite</span></button><span class="prototype-divider">|</span><button type="button" class="collection-prototype-btn" title="Collection prototype"><i class="fa-solid fa-plus"></i><span> Collection</span></button></div><a href="${esc(shopUrl)}" target="_blank" rel="noopener noreferrer" class="prototype-shop-btn">Shop on Shobi</a></div>`;
    return article;
  };
})();
