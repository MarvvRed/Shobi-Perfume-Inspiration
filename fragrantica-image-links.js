// Best sellers #1-#6: make the bottle image an explicit link to the matching Fragrantica page.
(function(){
  if(typeof renderVanillaPrototype!=='function') return;

  const fragranticaByRank=[
    'https://www.fragrantica.com/perfume/Kayali/Vanilla-28-52616.html',
    'https://www.fragrantica.com/perfume/By-Kilian/Angels-Share-62615.html',
    'https://www.fragrantica.com/perfume/Byredo/Blanche-6686.html',
    'https://www.fragrantica.com/perfume/Tom-Ford/Tobacco-Vanille-1825.html',
    'https://www.fragrantica.com/perfume/ZARKOPERFUME/The-Muse-60665.html',
    'https://www.fragrantica.com/perfume/Maison-Francis-Kurkdjian/Baccarat-Rouge-540-33519.html'
  ];

  const baseRender=renderVanillaPrototype;
  renderVanillaPrototype=function(p){
    const article=baseRender(p);
    const rank=(window.SHOBI_BESTSELLER_CODES||[]).indexOf(String(p.code||''));
    const url=fragranticaByRank[rank];
    if(!url || !article) return article;

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
