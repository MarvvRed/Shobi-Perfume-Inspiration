// Add verified Fragrantica links to Best Seller #1-#20 images without replacing card renderers.
(function(){
  if(typeof renderVanillaPrototype!=='function') return;
  const codes=(window.SHOBI_BESTSELLER_CODES||[]).map(String);
  const fragranticaByRank=[
    'https://www.fragrantica.com/perfume/Kayali/Vanilla-28-52616.html',
    'https://www.fragrantica.com/perfume/By-Kilian/Angels-Share-62615.html',
    'https://www.fragrantica.com/perfume/Byredo/Blanche-6686.html',
    'https://www.fragrantica.com/perfume/Tom-Ford/Tobacco-Vanille-1825.html',
    'https://www.fragrantica.com/perfume/ZARKOPERFUME/The-Muse-60665.html',
    'https://www.fragrantica.com/perfume/Maison-Francis-Kurkdjian/Baccarat-Rouge-540-33519.html',
    'https://www.fragrantica.com/perfume/Creed/Virgin-Island-Water-899.html',
    'https://www.fragrantica.com/perfume/Tom-Ford/Lost-Cherry-51411.html',
    'https://www.fragrantica.com/perfume/Dolce-Gabbana/Devotion-84951.html',
    'https://www.fragrantica.com/perfume/Sol-de-Janeiro/Brazilian-Crush-Cheirosa-62-56062.html',
    'https://www.fragrantica.com/perfume/Tom-Ford/Soleil-Blanc-34893.html',
    'https://www.fragrantica.com/perfume/Byredo/Bal-d-Afrique-6458.html',
    'https://www.fragrantica.com/perfume/Creed/Aventus-9828.html',
    'https://www.fragrantica.com/perfume/By-Kilian/Love-Don-t-Be-Shy-4322.html',
    'https://www.fragrantica.com/perfume/Zadig-Voltaire/This-is-Her-39358.html',
    'https://www.fragrantica.com/perfume/Matiere-Premiere/Vanilla-Powder-84933.html',
    'https://www.fragrantica.com/perfume/Giardini-Di-Toscana/Bianco-Latte-64757.html',
    'https://www.fragrantica.com/perfume/Xerjoff/Naxos-30529.html',
    'https://www.fragrantica.com/perfume/Diptyque/Philosykos-Eau-de-Parfum-3865.html',
    'https://www.fragrantica.com/perfume/Burberry/Goddess-83483.html'
  ];
  const previousRender=renderVanillaPrototype;
  renderVanillaPrototype=function(p){
    const article=previousRender(p);
    if(!article) return article;
    const idx=codes.indexOf(String(p.code||''));
    if(idx<0 || idx>=20) return article;
    const url=fragranticaByRank[idx];
    if(!url) return article;
    const wrap=article.querySelector('.prototype-image-wrap');
    const image=wrap?.querySelector('img');
    if(!wrap || !image || image.closest('.prototype-fragrantica-link')) return article;
    const link=document.createElement('a');
    link.className='prototype-fragrantica-link';
    link.href=url;
    link.target='_blank';
    link.rel='noopener noreferrer';
    link.title='View on Fragrantica';
    link.setAttribute('aria-label','View this perfume on Fragrantica');
    image.parentNode.insertBefore(link,image);
    link.appendChild(image);
    const hint=document.createElement('span');
    hint.className='prototype-fragrantica-hint';
    hint.setAttribute('aria-hidden','true');
    hint.innerHTML='<i class="fa-solid fa-arrow-up-right-from-square"></i><span>Fragrantica</span>';
    link.appendChild(hint);
    return article;
  };
})();
