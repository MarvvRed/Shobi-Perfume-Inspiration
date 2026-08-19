(() => {
  if (window.__shobiMainNotesPageCatcher) return;
  window.__shobiMainNotesPageCatcher = true;
  const emit=(type,detail={})=>window.postMessage({source:'shobi-main-notes-page',type,...detail},'*');
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  emit('diagnostic',{stage:'page-catcher-boot',detail:`readyState=${document.readyState}`});

  const desc=el=>{
    if(!el)return'null';
    const attrs=[...el.attributes||[]].filter(a=>/vote|note|ingredient|data-|aria-|title|style/i.test(a.name)).slice(0,8).map(a=>`${a.name}=${JSON.stringify(a.value)}`).join(' ');
    return `${el.tagName?.toLowerCase()||'?'} text=${JSON.stringify(clean(el.textContent).slice(0,140))} ${attrs}`;
  };

  function findShowVotes(){
    return [...document.querySelectorAll('button,a,[role="button"],span,div')].filter(el=>{
      const t=clean(el.textContent), a=clean(el.getAttribute?.('aria-label')), title=clean(el.getAttribute?.('title'));
      return /^show\s+votes$/i.test(t)||/show\s+votes/i.test(a)||/show\s+votes/i.test(title);
    });
  }

  function findPyramidRoot(btn){
    let n=btn;
    for(let i=0;n&&i<10;i++,n=n.parentElement){
      const txt=clean(n.textContent).toLowerCase();
      const noteLinks=n.querySelectorAll?.('a[href*="/notes/"]')||[];
      if(noteLinks.length>=2 && (txt.includes('perfume pyramid')||txt.includes('top notes')||txt.includes('base notes'))) return n;
    }
    return btn.closest('section')||btn.parentElement?.parentElement?.parentElement;
  }

  function snapshot(root){
    const rows=[];
    const sels=['a[href*="/notes/"]','[data-vote]','[data-votes]','[data-weight]','[class*="vote"]','[id*="vote"]','[class*="progress"]','[class*="bar"]','[style*="width"]'];
    const seen=new Set();
    for(const sel of sels){
      for(const el of root?.querySelectorAll?.(sel)||[]){
        if(seen.has(el))continue; seen.add(el);
        const text=clean(el.textContent);
        const style=el.getAttribute?.('style')||'';
        const data=[...el.attributes||[]].filter(a=>a.name.startsWith('data-')).map(a=>`${a.name}=${a.value}`).join(',');
        if(text.length>300)continue;
        rows.push(`${sel} => ${desc(el)} data=[${data}] style=${JSON.stringify(style)}`);
        if(rows.length>=60)return rows;
      }
    }
    return rows;
  }

  function noteContexts(root){
    const out=[];
    for(const link of root?.querySelectorAll?.('a[href*="/notes/"]')||[]){
      const name=clean(link.textContent)||clean(link.querySelector('img[alt]')?.alt)||clean(link.getAttribute('title'));
      if(!name)continue;
      let box=link;
      for(let i=0;box&&i<4;i++,box=box.parentElement){
        const txt=clean(box.textContent);
        const nums=txt.match(/\b\d+(?:[.,]\d+)?%?\b/g)||[];
        const voteish=[...box.querySelectorAll?.('[data-vote],[data-votes],[data-weight],[class*="vote"],[class*="progress"],[class*="bar"],[style*="width"]')||[]];
        if(nums.length||voteish.length){
          out.push(`${name} :: box=${desc(box)} nums=${nums.join(',')} voteEls=${voteish.slice(0,6).map(desc).join(' ~~ ')}`);
          break;
        }
      }
    }
    return out;
  }

  async function run(){
    if(document.readyState==='loading')await new Promise(r=>document.addEventListener('DOMContentLoaded',r,{once:true}));
    await sleep(1200);
    const buttons=findShowVotes();
    emit('diagnostic',{stage:'show-votes-found',detail:`count=${buttons.length}; ${buttons.slice(0,4).map(desc).join(' || ')}`});
    if(!buttons.length){emit('diagnostic',{stage:'show-votes-missing',detail:'No Show votes control found'});return;}
    const btn=buttons[0], root=findPyramidRoot(btn);
    emit('diagnostic',{stage:'show-votes-root',detail:desc(root)});
    try{btn.scrollIntoView({block:'center',behavior:'auto'});}catch{}
    await sleep(300);
    const before=snapshot(root);
    emit('diagnostic',{stage:'show-votes-before',detail:before.length?before.slice(0,12).join(' || '):'none'});
    try{btn.click();}catch(e){emit('page-error',{error:`Show votes click: ${String(e)}`});return;}
    emit('diagnostic',{stage:'show-votes-clicked',detail:desc(btn)});
    await sleep(1200);
    const after=snapshot(root), contexts=noteContexts(root);
    emit('diagnostic',{stage:'show-votes-after',detail:after.length?after.slice(0,30).join(' || '):'none'});
    emit('diagnostic',{stage:'show-votes-note-contexts',detail:contexts.length?contexts.join(' || '):'none'});
    emit('diagnostic',{stage:'show-votes-finished',detail:`snapshot=${after.length};contexts=${contexts.length}`});
  }
  run().catch(e=>emit('page-error',{error:`Show votes diagnostic: ${String(e)}`}));
  emit('installed');
})();
